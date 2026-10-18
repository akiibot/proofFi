"""The parity ledger must name every canonical operation, including maintenance."""
import json
from pathlib import Path


def test_frontend_inventory_covers_every_http_operation():
    root = Path(__file__).resolve().parents[3]
    contract = json.loads((root / "contracts/openapi.json").read_text())
    ledger = (root / "docs/FRONTEND_PARITY.md").read_text()
    for route, methods in contract["paths"].items():
        for method in methods:
            if method in {"get", "post"}:
                assert f"| {method.upper()} | `{route}` |" in ledger
    assert "MISSING" not in ledger
