"""Real SQLite/policy/simulation/Ed25519; only external RPC transport is replaced."""

import json
from dataclasses import replace

import pytest
from app.core.auth import hash_password
from app.core.canonical import digest
from app.core.settings import Settings
from app.main import create_app
from app.models.contracts import ActionCertificate
from app.planner.provider import Proposal
from app.verifier.certificates import verify_integrity
from fastapi.testclient import TestClient
from pydantic import SecretStr
from test_pf_029 import RECIPIENT, TOKEN, WALLET, rpc  # noqa: F401
from test_pf_160_access import ORIGIN, PROFILE


@pytest.mark.usefixtures("rpc")
def test_two_guest_signed_verification_and_operator_preservation(database, tmp_path, monkeypatch):
    env = dict(
        RPC_URL="http://isolated.invalid",
        WALLET_ADDRESS=WALLET,
        TEST_TOKEN_ADDRESS=TOKEN,
        APPROVED_RECIPIENT=RECIPIENT,
        OPTIMIZER_GAS_LIMIT="100000",
        OPTIMIZER_MAX_FEE_PER_GAS_WEI="100",
        EXECUTION_ENABLED="true",
    )
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    config = dict(
        wallet_address=WALLET,
        token_address=TOKEN,
        recipient=RECIPIENT,
        token_decimals=6,
        gas_limit=100000,
        max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
    )
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps(config))
    app = create_app(
        Settings(
            _env_file=None,
            database_url=database[0],
            judge_enabled=True,
            judge_directory=str(tmp_path / "judges"),
            demo_password_hash=SecretStr(hash_password("isolated-operator-password")),
        )
    )
    with TestClient(app) as operator, TestClient(app) as a, TestClient(app) as b:
        for client in (operator, a, b):
            client.headers.update(ORIGIN)
        assert (
            operator.post(
                "/auth/login", json={"password": "isolated-operator-password"}
            ).status_code
            == 200
        )
        before = {
            route: operator.get(route).json()
            for route in ["/financial-state", "/audit", "/constitutions/history"]
        }
        for client in (a, b):
            entry = client.post("/auth/judge", json=PROFILE)
            assert entry.status_code == 200
            client.headers["X-CSRF-Token"] = entry.json()["csrf_token"]
        b_before = {route: b.get(route).json() for route in before}
        draft = a.post(
            "/constitutions/drafts",
            json={
                "base_version": None,
                "rules": {"allowed_tokens": [TOKEN], "known_recipients": [RECIPIENT]},
            },
        ).json()
        assert (
            a.post(
                "/constitutions/confirm",
                json={
                    "draft_id": draft["id"],
                    "confirmed": True,
                    "expected_policy_digest": digest(draft["rules"]),
                },
            ).status_code
            == 200
        )
        guest = next(
            g
            for g in app.state.judges.guests.values()
            if g.scope_id == a.get("/auth/access").json()["scope_id"]
        )
        # External provider substitution is confined to this isolated test only.
        guest.app.state.judge_runtime = replace(
            guest.app.state.judge_runtime,
            proposal_provider=lambda goal, context, settings: Proposal(
                obligation_id="tuition",
                ambiguities=[],
                amounts_minor=[10000],
                reason="isolated external-provider reply",
            ),
        )
        plans = a.post("/plans/generate", json={"goal": "invest protecting tuition"})
        assert plans.status_code == 200, plans.text
        action = plans.json()["candidates"][0]
        response = a.post("/verify", json={"action": action})
        assert response.status_code == 200, response.text
        assert response.json()["certificate_id"]
        cert_id = response.json()["certificate_id"]
        cert = ActionCertificate.model_validate(a.get("/certificates/" + cert_id).json())
        keys = guest.app.state.judge_runtime.verification.public_keys()
        assert verify_integrity(cert, keys).signature_valid
        assert not verify_integrity(cert, {}).signature_valid
        assert a.post("/certificates/" + cert_id + "/verify").json()["signature_valid"]
        assert b.get("/certificates/" + cert_id).status_code == 409
        assert operator.get("/certificates/" + cert_id).status_code == 409
        for client in (a, b):
            assert (
                client.post(
                    "/execute",
                    json={
                        "certificate_id": cert_id,
                        "action_digest": cert.payload.action_digest,
                        "idempotency_key": "isolation-proof-identity",
                    },
                ).status_code
                == 403
            )
        assert {route: operator.get(route).json() for route in before} == before
        assert {route: b.get(route).json() for route in before} == b_before
    app.state.engine.dispose()
