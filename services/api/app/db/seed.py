"""Idempotent baseline only. No automatic policy confirmation or invented income."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.core.canonical import digest
from app.core.settings import Settings
from app.db.models import ConstitutionDraftRecord, FinancialStateRecord, User, UserHead
from app.db.session import make_engine, sessions
from app.models.contracts import ConstitutionDraft, ConstitutionRules, StateSnapshot


def baseline() -> StateSnapshot:
    return StateSnapshot.model_validate(
        {
            "user_id": "demo-user",
            "version": 1,
            "as_of": "2026-10-15T00:00:00Z",
            "assets": [
                {
                    "id": "cash",
                    "asset": "USD_DEMO",
                    "amount_minor": 1200000,
                    "liquid": True,
                    "high_risk": False,
                }
            ],
            "obligations": [
                {
                    "id": "tuition",
                    "name": "Tuition",
                    "amount_minor": 700000,
                    "due_day": 120,
                    "protected": True,
                }
            ],
            "recurring_expenses": [
                {
                    "id": "living",
                    "name": "Living costs",
                    "amount_minor": 80000,
                    "due_days": [30, 60, 90, 120],
                }
            ],
            "expected_income": [],
            "goal": {
                "id": "tuition-goal",
                "text": "Invest as much as possible without risking my tuition.",
                "objective": "maximize_investment_subject_to_policies",
                "obligation_id": "tuition",
            },
            "assumptions": [
                "Synthetic USD planning ledger; not actual wallet purchasing power.",
                "Four months represented as 120 days.",
                "Expected income unspecified: no income assumed.",
                "$12,000 minus $7,000 tuition minus $2,000 reserve minus $3,200 living costs = -$200 before fees and shocks.",
                "A positive Scenario A needs an explicitly approved assumption change; no safe amount has been calculated.",
            ],
        }
    )


def seed(session):
    if session.scalar(select(User.id).where(User.id == "demo-user")):
        return False
    state = baseline()
    session.add(User(id="demo-user", display_name="Demo student"))
    session.flush()
    session.add(
        FinancialStateRecord(
            id="state-v1",
            user_id="demo-user",
            version=1,
            snapshot_hash=digest(state),
            payload=state.model_dump(mode="json"),
        )
    )
    draft = ConstitutionDraft(
        id="draft-initial",
        user_id="demo-user",
        rules=ConstitutionRules(allowed_tokens=[], known_recipients=[]),
        base_version=None,
        created_at=datetime(2026, 10, 15, tzinfo=UTC),
    )
    session.add(
        ConstitutionDraftRecord(
            id=draft.id,
            user_id=draft.user_id,
            base_version=None,
            payload=draft.model_dump(mode="json"),
        )
    )
    session.flush()
    session.add(UserHead(user_id="demo-user", state_id="state-v1", constitution_id=None))
    return True


if __name__ == "__main__":
    engine = make_engine(Settings().database_url)
    with sessions(engine).begin() as session:
        changed = seed(session)
    print("Seed created (policy draft only)" if changed else "Existing state preserved")
