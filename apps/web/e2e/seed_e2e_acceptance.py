"""Append funded test state only after the pristine-baseline browser checks.

The reviewed production provisioner is create-only. This explicitly isolated
fixture uses the real state repository on .local/e2e.db, retains baseline/history
and the already explicit test policy, and never touches a demo/runtime database.
"""

from datetime import UTC, datetime

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.settings import Settings
from app.db.models import ApprovalRecord, AuditRecord, ExecutionRecord
from app.db.session import make_engine, sessions
from app.db.state import append_state, read_state
from app.models.contracts import StateSnapshot
from sqlalchemy import func, select

url = Settings().database_url
if url != "sqlite:///./.local/e2e.db":
    raise SystemExit("Only the isolated .local/e2e.db fixture is allowed")
engine = make_engine(url)
with sessions(engine).begin() as session:
    current = read_state(session)
    stages = [event for event in session.scalars(select(AuditRecord)) if event.payload["event_type"] == "ISOLATED_TEST_SCENARIO_STAGED"]
    if stages:
        # Playwright restarts a worker after a failure. Recognize only our exact
        # unchanged pre-expense fixture; never reset/replay after a money effect.
        if (
            len(stages) != 1
            or stages[0].payload["details"]["funded_state_id"] != current.id
            or current.snapshot.version != 2
            or current.snapshot.realized_expense_minor != 0
            or sum(a.amount_minor for a in current.snapshot.assets) != 1700000
            or session.scalar(select(func.count()).select_from(ApprovalRecord))
            or session.scalar(select(func.count()).select_from(ExecutionRecord))
        ):
            raise SystemExit("Refusing changed fixture authority or financial effects")
        raise SystemExit(0)
    if current.snapshot.version != 1 or sum(a.amount_minor for a in current.snapshot.assets) != 1200000:
        raise SystemExit("Expected untouched baseline fixture version1")
    snapshot = StateSnapshot.model_validate({
        **current.snapshot.model_dump(), "version": 2,
        "assets": [current.snapshot.assets[0].model_copy(update={"amount_minor": 1700000})],
        "assumptions": [*current.snapshot.assumptions, "ISOLATED E2E FIXTURE: extra $5,000 synthetic cash; no income; not live financial approval"],
    })
    funded = append_state(session, snapshot, 1)
    append_event(session, actor="demo-user", event_type="ISOLATED_TEST_SCENARIO_STAGED", artifact_digest=digest(funded), details={"original_state_id": current.id, "funded_state_id": funded.id}, now=datetime.now(UTC))
engine.dispose()
