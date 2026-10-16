"""E2E-only: stores one clearly labeled simulation config in the throwaway browser-test database.

The real seed deliberately selects no simulation config (docs/DECISIONS.md D12), so /simulate refuses to run.
Browser tests still need real engine output to check the Time Machine screen, the same way the backend's
own tests insert a fixture config (services/api/tests/test_pf_009.py). The values below are invented test
inputs, never an approved financial assumption, and this script refuses to touch any database except
.local/e2e.db.
"""

import sys

from app.core.canonical import digest
from app.core.settings import Settings
from app.db.models import SimulationConfigRecord
from app.db.session import make_engine, sessions
from app.models.contracts import SimulationConfig

url = Settings().database_url
if not url.endswith("/.local/e2e.db"):
    sys.exit(f"Refusing to add a test simulation config to {url}; only .local/e2e.db is allowed")

config = SimulationConfig(
    id="e2e-test-fixture-config",
    model_version="pf-monte-carlo-v1",
    daily_volatility_bps=100,
    income_delay_probability_bps=1000,
    emergency_probability_bps=1000,
    fee_minor=100,
    model_assumptions=[
        "E2E TEST FIXTURE: invented values used only by browser tests; not an approved financial assumption",
    ],
)
with sessions(make_engine(url)).begin() as session:
    session.add(
        SimulationConfigRecord(
            id=config.id, config_digest=digest(config), payload=config.model_dump(mode="json")
        )
    )
print("E2E test simulation config stored in .local/e2e.db")
