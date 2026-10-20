"""Server-derived capabilities; request input never chooses an engine or role."""

from datetime import UTC, datetime

from app.core.errors import DomainError
from app.models.contracts import ErrorCode, SessionAccess

PROFILE_DIGEST = "69f1faf7aed9c279e88745675bfbc807f6d3d1528284e0a79c3d8cd88739acbb"
CAPABILITIES = ["read", "rules", "plan", "simulate", "verify", "expense"]
READS = {
    "/health",
    "/financial-state",
    "/constitutions/drafts",
    "/constitutions/history",
    "/audit",
    "/chain/status",
    "/auth/session",
    "/auth/access",
}
WRITES = {
    "/auth/logout",
    "/constitutions/drafts",
    "/constitutions/confirm",
    "/intent/parse",
    "/plans/generate",
    "/simulate",
    "/optimize",
    "/verify",
    "/workflows/goal",
    "/demo/emergency",
}
EXPENSIVE = {
    "/intent/parse",
    "/plans/generate",
    "/simulate",
    "/optimize",
    "/verify",
    "/workflows/goal",
    "/demo/emergency",
}
DENIED = {"/approvals", "/execute", "/demo/reset", "/demo/attack"}


def allowed(method, path):
    # Normalize exactly as Starlette's route redirect; no execution aliases allowed.
    path = path.rstrip("/") or "/"
    if path in DENIED or path.startswith("/executions/"):
        raise DomainError(
            ErrorCode.FORBIDDEN, "Judge demo cannot approve or send transactions", 403
        )
    parts = path.split("/")
    certificate = (
        len(parts) in (3, 4)
        and parts[1] == "certificates"
        and 0 < len(parts[2]) <= 100
        and all(c.isascii() and (c.isalnum() or c in "_-") for c in parts[2])
    )
    if method == "GET" and (path in READS or certificate and len(parts) == 3):
        return
    if method == "POST" and (
        path in WRITES or certificate and len(parts) == 4 and parts[3] == "verify"
    ):
        return
    raise DomainError(ErrorCode.NOT_IMPLEMENTED, "Route not available in judge demo", 501)


def access(expires, scope_id=None):
    judge = scope_id is not None
    enabled = False
    if not judge:
        try:
            from app.execution.router import ExecutionSettings

            enabled = ExecutionSettings().execution_enabled
        except Exception:
            pass
    return SessionAccess(
        mode="judge" if judge else "operator",
        execution_enabled=enabled,
        capabilities=CAPABILITIES
        if judge
        else CAPABILITIES + ["approve", "execute", "attack", "reset"],
        expires_at=datetime.fromtimestamp(expires, UTC),
        scope_id=scope_id,
        profile_id="synthetic-funded-demo-v1" if judge else None,
        profile_digest=PROFILE_DIGEST if judge else None,
    )
