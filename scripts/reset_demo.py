"""Demo-only reset: stage the seeded baseline again as a NEW financial-state version.

Run from the repository root with the project virtualenv:
    .venv/bin/python scripts/reset_demo.py          (Windows: .venv\\Scripts\\python.exe scripts\\reset_demo.py)

Nothing is deleted. Earlier snapshots, Constitution versions, certificates, approvals, executions and the
audit chain all stay, so on-chain history and nonces are never invalidated; older certificates simply become
stale because the state changed. The active Constitution is left as the person confirmed it.

Refuses unless DEMO_MODE is true, and refuses while any execution is still CLAIMED, PENDING or REORGED.
Records a DEMO_RESET audit event. Only someone with access to this machine's database can run it; the
HTTP route POST /demo/reset stays unfinished until the lead reviews wiring it to the same function.
"""

import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.audit.append import append_event  # noqa: E402
from app.core.canonical import digest  # noqa: E402
from app.core.errors import DomainError  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.db.models import ExecutionRecord  # noqa: E402
from app.db.seed import baseline  # noqa: E402
from app.db.session import make_engine  # noqa: E402
from app.db.state import append_state, read_state  # noqa: E402
from app.models.contracts import ErrorCode, FinancialState  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

UNSETTLED = ("CLAIMED", "PENDING", "REORGED")
ACTOR = "demo-user"


def reset_demo(engine, actor_id: str = ACTOR) -> FinancialState:
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Demo reset supports SQLite only")
    with Session(engine) as session, session.begin():
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        unsettled = session.scalar(
            select(ExecutionRecord.id).where(ExecutionRecord.status.in_(UNSETTLED)).limit(1)
        )
        if unsettled is not None:
            raise DomainError(
                ErrorCode.CONFLICT,
                "An execution is still claimed or pending; reset refused until it settles",
                409,
            )
        current = read_state(session, actor_id)
        snapshot = baseline().model_copy(update={"version": current.snapshot.version + 1})
        result = append_state(session, snapshot, current.snapshot.version)
        append_event(
            session,
            actor=actor_id,
            event_type="DEMO_RESET",
            artifact_digest=digest(result.snapshot),
            now=datetime.now(UTC),
            details={
                "from_state_version": current.snapshot.version,
                "to_state_version": result.snapshot.version,
                "state_id": result.id,
            },
        )
        return result


def main() -> int:
    settings = Settings()
    if not settings.demo_mode:
        print("Refusing: DEMO_MODE is not true, so this is not a demo database.", file=sys.stderr)
        return 2
    engine = make_engine(settings.database_url)
    try:
        state = reset_demo(engine)
    except DomainError as error:
        print(f"Reset refused: {error.message}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    print(f"Demo state reset to the seeded baseline as version {state.snapshot.version} ({state.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
