"""Local, website-approved installation pairing. IDs alone never authenticate."""
import hashlib
import hmac
import re
import secrets
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, Request, Response
from sqlalchemy import select

from app.core.errors import DomainError
from app.db.auth_models import ExtensionConnectionRecord
from app.models.contracts import (
    ErrorCode,
    ExtensionConnection,
    PairingApproval,
    PairingCreated,
    PairingDetails,
    PairingPoll,
    PairingStatus,
)


def extension_identity(request):
    identity = request.headers.get("x-prooffi-extension-id", "")
    origin = request.headers.get("origin")
    if not re.fullmatch("[a-p]{32}", identity) or (
        origin is not None and origin != "chrome-extension://" + identity
    ):
        raise DomainError(ErrorCode.FORBIDDEN, "Matching extension context required", 403)
    return identity


def connection_allowed(manager, identity):
    # Legacy direct SessionManager fixtures have no database; configured IDs retain behavior.
    if manager.factory is not None and manager.settings.database_url.startswith("sqlite:"):
        with manager.factory() as session:
            row = session.get(ExtensionConnectionRecord, identity)
            if row is not None:
                if row.revoked_at is not None:
                    return False
                if manager.settings.deployment_mode == "local" and row.approved_at is not None:
                    return True
    return identity in manager.settings.extension_ids


@dataclass
class Pending:
    identity: str
    secret_hash: bytes
    code_hash: bytes
    expires: float
    attempts: int = 0
    approved: bool = False
    revoked: bool = False


def register_pairing(router, manager):
    pending: dict[str, Pending] = {}
    creations = deque()
    manager._pairings = pending

    def local():
        if manager.settings.deployment_mode != "local" or manager.factory is None or not manager.settings.database_url.startswith("sqlite:"):
            raise DomainError(ErrorCode.UNAVAILABLE, "Pairing requires the local SQLite companion")

    def website(request: Request):
        if request.headers.get("x-prooffi-extension-session") or request.headers.get("x-prooffi-extension-id"):
            raise DomainError(ErrorCode.FORBIDDEN, "Approve connections from the local website only", 403)
        actor = manager.authenticate(request, request.cookies.get("prooffi_session"), None)
        local()
        return actor

    def no_store(response: Response):
        response.headers["Cache-Control"] = "no-store"

    def get_pending(identifier):
        item = pending.get(identifier)
        if item is None:
            raise DomainError(ErrorCode.CONFLICT, "Pairing missing; start a new connection", 409)
        return item

    def status(item):
        if item.revoked:
            return "REVOKED"
        if manager.clock() >= item.expires:
            return "EXPIRED"
        if item.attempts >= 5:
            return "EXHAUSTED"
        return "APPROVED" if item.approved else "PENDING"

    @router.post("/auth/extension/pairings", response_model=PairingCreated, operation_id="create_extension_pairing")
    def create(request: Request, response: Response):
        local()
        identity = extension_identity(request)
        if request.cookies.get("prooffi_session") or request.headers.get("x-prooffi-extension-session"):
            raise DomainError(ErrorCode.FORBIDDEN, "Pairing requires a new connection", 403)
        with manager._lock:
            now = manager.clock()
            manager._limit(creations, 5, now)
            for key in list(pending):
                if now >= pending[key].expires:
                    del pending[key]
            if len(pending) >= 32:
                raise DomainError(ErrorCode.RATE_LIMITED, "Too many pending connections", 429)
            identifier = "pair-" + secrets.token_hex(16)
            secret = secrets.token_urlsafe(32)
            code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
            pending[identifier] = Pending(identity, hashlib.sha256(secret.encode()).digest(), hashlib.sha256(code.encode()).digest(), now + 300)
            no_store(response)
            return PairingCreated(request_id=identifier, code=code, polling_secret=secret, expires_at=datetime.fromtimestamp(now + 300, UTC))

    @router.post("/auth/extension/pairings/status", response_model=PairingStatus, operation_id="extension_pairing_status")
    def poll(body: PairingPoll, request: Request, response: Response):
        local()
        identity = extension_identity(request)
        if request.cookies.get("prooffi_session") or request.headers.get("x-prooffi-extension-session"):
            raise DomainError(ErrorCode.FORBIDDEN, "Pairing requires its polling credential", 403)
        with manager._lock:
            item = get_pending(body.request_id)
            if item.identity != identity or not hmac.compare_digest(item.secret_hash, hashlib.sha256(body.polling_secret.get_secret_value().encode()).digest()):
                raise DomainError(ErrorCode.FORBIDDEN, "Invalid pairing credential", 403)
            no_store(response)
            return PairingStatus(status=status(item), expires_at=datetime.fromtimestamp(item.expires, UTC))

    @router.get("/auth/extension/pairings/{request_id}", response_model=PairingDetails, operation_id="extension_pairing_details")
    def details(request_id: str, response: Response, actor=Depends(website)):
        with manager._lock:
            item = get_pending(request_id)
            no_store(response)
            return PairingDetails(request_id=request_id, extension_id=item.identity, status=status(item), expires_at=datetime.fromtimestamp(item.expires, UTC))

    @router.post("/auth/extension/pairings/{request_id}/approve", response_model=PairingStatus, operation_id="approve_extension_pairing")
    def approve(request_id: str, body: PairingApproval, response: Response, actor=Depends(website)):
        with manager._lock:
            item = get_pending(request_id)
            if status(item) != "PENDING":
                raise DomainError(ErrorCode.CONFLICT, "Pairing cannot be approved again; start a new connection", 409)
            if not hmac.compare_digest(item.code_hash, hashlib.sha256(body.code.get_secret_value().encode()).digest()):
                item.attempts += 1
                raise DomainError(ErrorCode.FORBIDDEN, "Pairing code does not match", 403)
            with manager.factory.begin() as session:
                row = session.get(ExtensionConnectionRecord, item.identity)
                if row is None:
                    row = ExtensionConnectionRecord(extension_id=item.identity, owner_id=actor)
                    session.add(row)
                row.owner_id = actor
                row.approved_at = datetime.fromtimestamp(manager.clock(), UTC)
                row.revoked_at = None
            item.approved = True
            no_store(response)
            return PairingStatus(status="APPROVED", expires_at=datetime.fromtimestamp(item.expires, UTC))

    @router.get("/auth/extension/connections", response_model=list[ExtensionConnection], operation_id="extension_connections")
    def connections(response: Response, actor=Depends(website)):
        with manager._lock, manager.factory() as session:
            rows = {r.extension_id: r for r in session.scalars(select(ExtensionConnectionRecord).where(ExtensionConnectionRecord.owner_id == actor))}
            ids = sorted(set(rows) | set(manager.settings.extension_ids))
            def utc(value):
                return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value
            no_store(response)
            return [ExtensionConnection(extension_id=identity, approved_at=utc(rows[identity].approved_at) if identity in rows else None, revoked_at=utc(rows[identity].revoked_at) if identity in rows else None, configured=identity in manager.settings.extension_ids) for identity in ids]

    @router.post("/auth/extension/connections/{extension_id}/revoke", response_model=ExtensionConnection, operation_id="revoke_extension_connection")
    def revoke(extension_id: str, response: Response, actor=Depends(website)):
        if not re.fullmatch("[a-p]{32}", extension_id):
            raise DomainError(ErrorCode.VALIDATION_ERROR, "Invalid extension ID", 422)
        with manager._lock:
            with manager.factory.begin() as session:
                row = session.get(ExtensionConnectionRecord, extension_id)
                if row is None:
                    if extension_id not in manager.settings.extension_ids:
                        raise DomainError(ErrorCode.CONFLICT, "Connection not found", 409)
                    row = ExtensionConnectionRecord(extension_id=extension_id, owner_id=actor)
                    session.add(row)
                row.revoked_at = datetime.fromtimestamp(manager.clock(), UTC)
                result = ExtensionConnection(extension_id=extension_id, approved_at=row.approved_at.replace(tzinfo=UTC) if row.approved_at else None, revoked_at=row.revoked_at, configured=extension_id in manager.settings.extension_ids)
            manager._sessions = {key: value for key, value in manager._sessions.items() if value.extension_id != extension_id}
            for item in pending.values():
                if item.identity == extension_id:
                    item.revoked = True
            no_store(response)
            return result
