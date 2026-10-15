import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/api"))
from app.core.canonical import digest  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.db.seed import baseline  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.contracts import FinancialState, TrustedSimulationInput  # noqa: E402

app = create_app(Settings(_env_file=None, database_url="sqlite://", demo_mode=True))
schema = app.openapi()
# Internal trusted input is documented separately; never an HTTP input.
(ROOT / "contracts/trusted-simulation-input.schema.json").write_text(
    json.dumps(TrustedSimulationInput.model_json_schema(), indent=2, sort_keys=True) + "\n"
)
(ROOT / "contracts/openapi.json").write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n")
state = baseline()
(ROOT / "contracts/financial-state.example.json").write_text(
    FinancialState(
        id="state-v1", snapshot=state, snapshot_hash=digest(state), active_constitution_version=None
    ).model_dump_json(indent=2)
    + "\n"
)
