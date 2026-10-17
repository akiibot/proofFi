"""Explicit offline scenario selection; never a public request or policy approval."""

from datetime import UTC, datetime

from sqlalchemy import select

from app.audit.append import append_event
from app.core.canonical import digest
from app.db.models import SimulationConfigRecord, User
from app.db.seed import seed
from app.db.state import append_state, read_state
from app.models.contracts import SimulationConfig, StateSnapshot


def provision_funded_demo(session, config: SimulationConfig):
    """Caller owns a transaction in a NEW database and accepted the exact config.

    Keep baseline v1, append labeled funded v2, and leave Constitution unconfirmed.
    Refuse any existing user/config rather than modifying an operational database.
    """
    config = SimulationConfig.model_validate_json(config.model_dump_json())
    if config.model_version != "pf-monte-carlo-v1" or config.horizon_days != 120:
        raise ValueError("Demo requires the reviewed model and 120-day horizon")
    if config.path_count * 120 * 6 * 26 > 50_000_000:
        raise ValueError("Configuration exceeds the optimizer workload budget")
    if session.scalar(select(User.id).limit(1)) or session.scalar(
        select(SimulationConfigRecord.id).limit(1)
    ):
        raise ValueError("Provisioning requires a new empty database")
    if not config.model_assumptions or not any(
        "synthetic" in text.lower() for text in config.model_assumptions
    ):
        raise ValueError("Explicit synthetic model assumptions required")
    seed(session)
    original = read_state(session)
    snapshot = StateSnapshot.model_validate(
        {
            **original.snapshot.model_dump(),
            "version": 2,
            "assets": [
                original.snapshot.assets[0].model_copy(update={"amount_minor": 1700000})
            ],
            "assumptions": [
                "Explicitly selected synthetic funded alternative; not actual assets or income.",
                "Original $12,000 baseline is preserved as immutable state version 1.",
                "Additional $5,000 synthetic starting cash; total $17,000.",
                "No expected income. Tuition, reserve and living costs remain unchanged.",
                "$4,800 arithmetic margin before fees/shocks is not a safe allocation.",
                "Scenario C's realized expense does not replace the additional future emergency stress.",
            ],
        }
    )
    funded = append_state(session, snapshot, 1)
    session.add(
        SimulationConfigRecord(
            id=config.id, config_digest=digest(config), payload=config.model_dump(mode="json")
        )
    )
    append_event(
        session,
        actor="demo-user",
        event_type="SYNTHETIC_DEMO_PROVISIONED",
        artifact_digest=digest({"state": funded.model_dump(mode="json"), "config": config.model_dump(mode="json")}),
        details={
            "original_state_id": original.id,
            "funded_state_id": funded.id,
            "synthetic_cash_added_minor": 500000,
            "config_digest": digest(config),
            "constitution_confirmed": False,
        },
        now=datetime.now(UTC),
    )
    return funded
