"""Single-user, single-process demo sessions. Restart invalidates all sessions."""

import hashlib
import hmac
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie, APIKeyHeader

from app.core.errors import DomainError
from app.core.settings import Settings
from app.models.contracts import ErrorCode, LoginRequest, LogoutResult, SessionInfo

COOKIE_NAME = "prooffi_session"
SESSION_SECONDS = 1800
cookie = APIKeyCookie(name=COOKIE_NAME, auto_error=False)
extension_header = APIKeyHeader(name="X-ProofFi-Extension-Session", auto_error=False)


def hash_password(password: str) -> str:
    if not 12 <= len(password) <= 200:
        raise ValueError("Demo password must have 12..200 characters")
    salt = secrets.token_bytes(16)
    value = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return salt.hex() + ":" + value.hex()


def password_matches(password: str, encoded: str) -> bool:
    try:
        salt, expected = (bytes.fromhex(x) for x in encoded.split(":"))
        if len(salt) != 16 or len(expected) != 32:
            raise ValueError("Invalid hash shape")
        actual = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(actual, expected)
    except ValueError:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Demo password hash is not configured correctly"
        ) from None


@dataclass
class Session:
    csrf: str = field(repr=False)
    expires: float
    writes: deque = field(default_factory=deque, repr=False)
    extension_id: str | None = None


class SessionManager:
    def __init__(self, settings: Settings, clock=time.time, factory=None):
        self.settings = settings
        self.factory = factory
        self.clock = clock
        self._sessions: dict[str, Session] = {}
        self._login_attempts = deque()
        self._lock = threading.Lock()

    def require_origin(self, request: Request):
        if request.headers.get("origin") not in self.settings.trusted_origins:
            raise DomainError(ErrorCode.FORBIDDEN, "Trusted browser origin required", 403)

    def require_extension(self, request: Request) -> str:
        # Host-permission service-worker reads may omit Origin. The ID is routing
        # context, never authentication; the password/session credential is required.
        from app.core.pairing import connection_allowed, extension_identity
        identity = extension_identity(request)
        if not connection_allowed(self, identity):
            raise DomainError(ErrorCode.FORBIDDEN, "Connect this extension in local Vallet first", 403)
        return identity

    def _check_limit(self, attempts: deque, maximum: int, now: float):
        while attempts and attempts[0] <= now - 60:
            attempts.popleft()
        if len(attempts) >= maximum:
            raise DomainError(
                ErrorCode.RATE_LIMITED, "Too many requests; retry after one minute", 429
            )

    def _limit(self, attempts: deque, maximum: int, now: float):
        self._check_limit(attempts, maximum, now)
        attempts.append(now)

    def _lookup(self, token: str | None) -> tuple[str, Session]:
        if not token or len(token) > 100:
            raise DomainError(ErrorCode.UNAUTHORIZED, "Authenticated demo session required", 401)
        key = hashlib.sha256(token.encode()).hexdigest()
        session = self._sessions.get(key)
        if session is None or self.clock() >= session.expires:
            self._sessions.pop(key, None)
            raise DomainError(ErrorCode.UNAUTHORIZED, "Session missing, expired or revoked", 401)
        return key, session

    def authenticate(
        self, request: Request, token: str | None = Depends(cookie),
        extension_token: str | None = Depends(extension_header),
    ) -> str:
        with self._lock:
            if extension_token and token:
                raise DomainError(ErrorCode.FORBIDDEN, "Conflicting session transports", 403)
            session_digest, session = self._lookup(extension_token or token)
            if extension_token:
                identity = self.require_extension(request)
                if session.extension_id != identity:
                    raise DomainError(ErrorCode.FORBIDDEN, "Extension session binding mismatch", 403)
            elif session.extension_id is not None:
                raise DomainError(ErrorCode.FORBIDDEN, "Extension session requires extension transport", 403)
            if request.method not in ("GET", "HEAD", "OPTIONS"):
                if not extension_token:
                    self.require_origin(request)
                supplied = request.headers.get("x-csrf-token", "")
                if not hmac.compare_digest(supplied.encode("utf-8"), session.csrf.encode("utf-8")):
                    raise DomainError(ErrorCode.FORBIDDEN, "Matching CSRF token required", 403)
                self._limit(session.writes, 120, self.clock())
            request.state.actor_id = "demo-user"
            request.state.session_digest = session_digest
        return "demo-user"

    def router(self) -> APIRouter:
        router = APIRouter()

        @router.post("/auth/login", response_model=SessionInfo, operation_id="login")
        def login(body: LoginRequest, request: Request, response: Response):
            self.require_origin(request)
            now = self.clock()
            with self._lock:
                self._check_limit(self._login_attempts, 5, now)
            encoded = self.settings.demo_password_hash.get_secret_value()
            if not encoded:
                raise DomainError(
                    ErrorCode.UNAVAILABLE, "Demo authentication is not configured; run bootstrap"
                )
            if not password_matches(body.password.get_secret_value(), encoded):
                with self._lock:
                    self._limit(self._login_attempts, 5, now)
                raise DomainError(ErrorCode.UNAUTHORIZED, "Invalid demo credentials", 401)
            token = secrets.token_urlsafe(32)
            session = Session(csrf=secrets.token_urlsafe(32), expires=now + SESSION_SECONDS)
            with self._lock:
                self._sessions = {
                    key: value for key, value in self._sessions.items() if value.expires > now
                }
                old = request.cookies.get(COOKIE_NAME)
                if old:
                    self._sessions.pop(hashlib.sha256(old.encode()).hexdigest(), None)
                if len(self._sessions) >= 32:
                    raise DomainError(ErrorCode.RATE_LIMITED, "Demo session capacity reached", 429)
                self._sessions[hashlib.sha256(token.encode()).hexdigest()] = session
            response.set_cookie(
                COOKIE_NAME,
                token,
                max_age=SESSION_SECONDS,
                httponly=True,
                secure=self.settings.cookie_secure,
                samesite="strict",
                path="/",
            )
            response.headers["Cache-Control"] = "no-store"
            return SessionInfo(
                csrf_token=session.csrf, expires_at=datetime.fromtimestamp(session.expires, UTC)
            )

        @router.get(
            "/auth/session",
            response_model=SessionInfo,
            operation_id="session_info",
            dependencies=[Depends(self.authenticate)],
        )
        def info(request: Request, response: Response):
            with self._lock:
                _, session = self._lookup(request.cookies.get(COOKIE_NAME))
            response.headers["Cache-Control"] = "no-store"
            return SessionInfo(
                csrf_token=session.csrf, expires_at=datetime.fromtimestamp(session.expires, UTC)
            )

        @router.post(
            "/auth/logout",
            response_model=LogoutResult,
            operation_id="logout",
            dependencies=[Depends(self.authenticate)],
        )
        def logout(request: Request, response: Response):
            with self._lock:
                key, _ = self._lookup(request.cookies.get(COOKIE_NAME))
                self._sessions.pop(key, None)
            response.delete_cookie(
                COOKIE_NAME,
                path="/",
                httponly=True,
                secure=self.settings.cookie_secure,
                samesite="strict",
            )
            response.headers["Cache-Control"] = "no-store"
            return LogoutResult()

        from app.core.extension_auth import register_extension_auth
        register_extension_auth(router, self)
        from app.core.pairing import register_pairing
        register_pairing(router, self)
        return router
