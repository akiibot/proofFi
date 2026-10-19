"""Opt-in extension transport; identity headers are not authentication credentials."""

import hashlib
import secrets
from datetime import UTC, datetime

from fastapi import Depends, Request, Response

from app.core.auth import COOKIE_NAME, SESSION_SECONDS, Session, password_matches
from app.core.errors import DomainError
from app.models.contracts import (
    ErrorCode,
    ExtensionSessionInfo,
    LoginRequest,
    LogoutResult,
    SessionInfo,
)


def register_extension_auth(router, manager):
    @router.post("/auth/extension/login", response_model=ExtensionSessionInfo,
                 operation_id="extension_login")
    def login(body: LoginRequest, request: Request, response: Response):
        identity = manager.require_extension(request)
        if request.cookies.get(COOKIE_NAME) or request.headers.get("x-prooffi-extension-session"):
            raise DomainError(ErrorCode.FORBIDDEN, "Login requires a single new session", 403)
        now = manager.clock()
        with manager._lock:
            manager._check_limit(manager._login_attempts, 5, now)
        encoded = manager.settings.demo_password_hash.get_secret_value()
        if not encoded:
            raise DomainError(ErrorCode.UNAVAILABLE, "Demo authentication is not configured")
        if not password_matches(body.password.get_secret_value(), encoded):
            with manager._lock:
                manager._limit(manager._login_attempts, 5, now)
            raise DomainError(ErrorCode.UNAUTHORIZED, "Invalid demo credentials", 401)
        token = secrets.token_urlsafe(32)
        session = Session(csrf=secrets.token_urlsafe(32), expires=now + SESSION_SECONDS,
                          extension_id=identity)
        with manager._lock:
            manager._sessions = {k: v for k, v in manager._sessions.items() if v.expires > now}
            if len(manager._sessions) >= 32:
                raise DomainError(ErrorCode.RATE_LIMITED, "Demo session capacity reached", 429)
            manager._sessions[hashlib.sha256(token.encode()).hexdigest()] = session
        response.headers["Cache-Control"] = "no-store"
        return ExtensionSessionInfo(session_token=token, csrf_token=session.csrf,
                                    expires_at=datetime.fromtimestamp(session.expires, UTC))

    def extension_session(request):
        token = request.headers.get("x-prooffi-extension-session")
        if not token:
            raise DomainError(ErrorCode.UNAUTHORIZED, "Extension session required", 401)
        return manager._lookup(token)

    @router.get("/auth/extension/session", response_model=SessionInfo,
                operation_id="extension_session", dependencies=[Depends(manager.authenticate)])
    def info(request: Request, response: Response):
        with manager._lock:
            _, session = extension_session(request)
        response.headers["Cache-Control"] = "no-store"
        return SessionInfo(csrf_token=session.csrf,
                           expires_at=datetime.fromtimestamp(session.expires, UTC))

    @router.post("/auth/extension/logout", response_model=LogoutResult,
                 operation_id="extension_logout", dependencies=[Depends(manager.authenticate)])
    def logout(request: Request, response: Response):
        with manager._lock:
            key, _ = extension_session(request)
            manager._sessions.pop(key, None)
        response.headers["Cache-Control"] = "no-store"
        return LogoutResult()
