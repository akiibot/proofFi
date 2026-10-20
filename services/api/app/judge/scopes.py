"""Bounded in-process registry: fixed database/app per guest, leased until completion."""

import hashlib
import secrets
import shutil
import threading
import time
from collections import deque
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import event

from app.core.auth import COOKIE_NAME, Session
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.session import make_engine, sessions
from app.demo.provision import provision_funded_demo
from app.judge.access import PROFILE_DIGEST
from app.models.contracts import ErrorCode, JudgeSessionInfo, SimulationConfig

MIGRATION_LOCK = threading.Lock()
REPO = Path(__file__).resolve().parents[4]


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest() if token and len(token) <= 100 else None


def limited(queue, maximum, now, seconds=60):
    while queue and queue[0] <= now - seconds:
        queue.popleft()
    if len(queue) >= maximum:
        raise DomainError(ErrorCode.RATE_LIMITED, "Judge demo capacity reached; retry later", 429)


@dataclass
class Guest:
    key: str
    scope_id: str
    directory: Path
    engine: object
    app: object
    expires: float
    refs: int = 0
    revoked: bool = False
    requests: deque = field(default_factory=deque)
    planner_calls: int = 0


class JudgeRegistry:
    def __init__(self, settings, operator_auth, build_app, clock=time.time):
        self.settings, self.operator_auth, self.build_app = settings, operator_auth, build_app
        self.clock = clock
        self.root = Path(settings.judge_directory).absolute()
        self.lock = threading.RLock()
        self.guests = {}
        self.reserved = 0
        self.retiring = 0
        self.starts, self.requests, self.provider_calls = deque(), deque(), deque()
        self.entry_requests = deque()
        self.expensive = threading.BoundedSemaphore(2)
        self.closed = False
        self.directory_lock = None
        # Do not touch the filesystem when the public feature is disabled.
        if settings.judge_enabled:
            if self.root.is_symlink():
                raise ValueError("Judge directory cannot be a symlink")
            # Reject the configured leaf before resolving trusted platform aliases.
            self.root = self.root.resolve()
            from app.judge.storage import DirectoryLock

            self.directory_lock = DirectoryLock(self.root)
            # Dedicated private root only. Old process sessions cannot survive restart.
            for path in self.root.glob("judge-*"):
                if path.is_dir() and not path.is_symlink():
                    shutil.rmtree(path)

    def token_reserved(self, token):
        with self.lock:
            return token_digest(token) in self.guests

    def cleanup(self):
        retired = []
        with self.lock:
            now = self.clock()
            for key, guest in list(self.guests.items()):
                if guest.expires <= now or guest.revoked:
                    guest.revoked = True
                    if not guest.refs:
                        retired.append(self.guests.pop(key))
                        self.retiring += 1
        for guest in retired:
            try:
                guest.engine.dispose()
                shutil.rmtree(guest.directory)
            finally:
                with self.lock:
                    self.retiring -= 1
        with self.lock:
            if (
                self.closed
                and not self.guests
                and not self.reserved
                and not self.retiring
                and self.directory_lock
            ):
                self.directory_lock.close()

    def close(self):
        with self.lock:
            self.closed = True
            for guest in self.guests.values():
                guest.revoked = True
        self.cleanup()

    def revoke(self, token):
        with self.lock:
            guest = self.guests.get(token_digest(token))
            if guest:
                guest.revoked = True
        self.cleanup()

    @contextmanager
    def lease(self, token):
        key = token_digest(token)
        with self.lock:
            guest = self.guests.get(key)
            if guest and (guest.revoked or self.clock() >= guest.expires):
                raise DomainError(ErrorCode.UNAUTHORIZED, "Judge session expired", 401)
            if guest:
                guest.refs += 1
        try:
            yield guest
        finally:
            if guest:
                with self.lock:
                    guest.refs -= 1
                    if key not in guest.app.state.auth._sessions:
                        guest.revoked = True
                self.cleanup()

    def entry_admit(self, request):
        self.operator_auth.require_origin(request)
        with self.lock:
            limited(self.entry_requests, 240, self.clock())
            self.entry_requests.append(self.clock())

    def admit(self, guest, path):
        with self.lock:
            now = self.clock()
            limited(guest.requests, 120, now)
            limited(self.requests, 240, now)
            guest.requests.append(now)
            self.requests.append(now)
            total = sum(
                p.stat().st_size
                for g in self.guests.values()
                for p in g.directory.iterdir()
                if p.is_file()
            )
            if total > 128 * 1024 * 1024:
                raise DomainError(ErrorCode.RATE_LIMITED, "Judge storage capacity reached", 429)

    @contextmanager
    def computation(self, expensive):
        acquired = False
        if expensive:
            acquired = self.expensive.acquire(blocking=False)
            if not acquired:
                raise DomainError(ErrorCode.RATE_LIMITED, "Judge computation capacity reached", 429)
        try:
            yield
        finally:
            if acquired:
                self.expensive.release()

    def reserve_provider(self, key):
        with self.lock:
            guest = self.guests.get(key)
            if not guest or guest.revoked or self.clock() >= guest.expires:
                raise DomainError(ErrorCode.UNAUTHORIZED, "Judge session expired", 401)
            limited(self.provider_calls, 18, self.clock(), 3600)
            if guest.planner_calls >= 3:
                raise DomainError(ErrorCode.RATE_LIMITED, "Judge planner budget reached", 429)
            guest.planner_calls += 1
            self.provider_calls.append(self.clock())

    def create(self, response, old_token=None):
        if not self.settings.judge_enabled:
            raise DomainError(ErrorCode.UNAVAILABLE, "Judge demo is not enabled")
        self.cleanup()
        with self.lock:
            if self.closed or len(self.guests) + self.reserved + self.retiring >= 8:
                raise DomainError(ErrorCode.RATE_LIMITED, "Judge session capacity reached", 429)
            limited(self.starts, 3, self.clock())
            self.starts.append(self.clock())
            self.reserved += 1
        directory = None
        engine = None
        published = False
        try:
            scope_id = "judge-" + secrets.token_hex(16)
            token = secrets.token_urlsafe(32)
            key = token_digest(token)
            directory = self.root / scope_id
            directory.mkdir(mode=0o700)
            url = "sqlite:///" + str(directory / "sandbox.db")
            engine = make_engine(url)

            @event.listens_for(engine, "connect")
            def bound_sqlite(connection, _):
                connection.execute("PRAGMA page_size=4096")
                connection.execute("PRAGMA max_page_count=1856")
                connection.execute("PRAGMA journal_mode=DELETE")
                connection.execute("PRAGMA temp_store=MEMORY")

            with MIGRATION_LOCK, engine.begin() as connection:
                config = Config(str(REPO / "alembic.ini"))
                config.set_main_option("script_location", str(REPO / "services/api/migrations"))
                config.attributes["connection"] = connection
                command.upgrade(config, "head")
            profile = SimulationConfig.model_validate_json(
                (REPO / "docs/funded-demo-config.json").read_text()
            )
            if digest(profile) != PROFILE_DIGEST:
                raise ValueError("Unreviewed judge profile")
            with sessions(engine).begin() as session:
                provision_funded_demo(session, profile)
            from app.judge.runtime import guest_runtime

            runtime = guest_runtime(self, key)
            app = self.build_app(url, scope_id, runtime, engine)
            now = self.clock()
            auth_session = Session(csrf=secrets.token_urlsafe(32), expires=now + 1800)
            app.state.auth.clock = lambda: self.clock()
            app.state.auth._sessions[key] = auth_session
            guest = Guest(key, scope_id, directory, engine, app, auth_session.expires)
            with self.operator_auth._lock, self.lock:
                if self.closed:
                    raise DomainError(ErrorCode.UNAVAILABLE, "Judge service is closing")
                if key in self.guests or key in self.operator_auth._sessions:
                    raise ValueError("Session collision")
                self.guests[key] = guest
                self.reserved -= 1
                published = True
            # Publish before replacing prior authority; failed creation leaves it intact.
            self.revoke(old_token)
            if old_token:
                with self.operator_auth._lock:
                    self.operator_auth._sessions.pop(token_digest(old_token), None)
            response.set_cookie(
                COOKIE_NAME,
                token,
                max_age=1800,
                httponly=True,
                secure=self.settings.cookie_secure,
                samesite="strict",
                path="/",
            )
            response.headers["Cache-Control"] = "no-store"
            return JudgeSessionInfo(
                csrf_token=auth_session.csrf,
                expires_at=datetime.fromtimestamp(auth_session.expires, UTC),
                profile_digest=PROFILE_DIGEST,
                scope_id=scope_id,
            )
        except Exception as exc:
            with self.lock:
                if not published:
                    self.reserved -= 1
                else:
                    self.guests.pop(key, None)
            if engine:
                engine.dispose()
            if directory and directory.exists():
                shutil.rmtree(directory)
            self.cleanup()
            if isinstance(exc, DomainError):
                raise
            raise DomainError(ErrorCode.UNAVAILABLE, "Judge sandbox creation unavailable") from None
