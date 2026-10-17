"""Authenticated executor integration; real authority/signing/store, isolated RPC only."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from app.execution import reconcile
from test_pf_014_signing import execution_count
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_015 import transport as transport
from test_pf_015_reconcile import chain as chain
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture(autouse=True)
def enabled(monkeypatch):
    # Test-process-only setting; never edits the operator's .env or runtime configuration.
    monkeypatch.setenv("EXECUTION_ENABLED", "true")


def submit(client, issued, **updates):
    return client.post("/execute", json={**issued[2].model_dump(mode="json"), **updates})


def test_http_execution_signs_once_and_resumes_pending(
    client, issued, transport, sign_calls, monkeypatch
):
    monkeypatch.setattr(reconcile, "_observe", lambda *args: None)
    first = submit(client, issued)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "PENDING"
    assert submit(client, issued).json() == first.json()
    assert len(sign_calls) == len(transport.sent) == 1


def test_http_existing_receipt_reconciles_without_resigning(client, issued, chain, sign_calls):
    first = submit(client, issued)
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "CONFIRMED"
    assert submit(client, issued).json() == first.json()
    assert len(sign_calls) == 1


def test_operator_disable_refuses_without_claim_or_signer(
    client, database, issued, sign_calls, monkeypatch
):
    monkeypatch.setenv("EXECUTION_ENABLED", "false")
    assert submit(client, issued).status_code == 501
    assert execution_count(database) == 0 and not sign_calls


@pytest.mark.parametrize("setting", ["EXECUTION_ENABLED", "VERIFIER_TRANSACTION_CONFIG_JSON", "RPC_URL"])
def test_invalid_server_configuration_is_sanitized_before_claim(
    client, database, issued, sign_calls, monkeypatch, setting
):
    monkeypatch.setenv(setting, "PRIVATE_INVALID_CONFIGURATION")
    response = submit(client, issued)
    assert response.status_code == 503
    assert "PRIVATE_INVALID_CONFIGURATION" not in response.text
    assert execution_count(database) == 0 and not sign_calls


@pytest.mark.parametrize("failure", ["session", "csrf", "actor", "digest", "enable", "policy"])
def test_public_bypass_is_rejected_without_signing(
    client, database, issued, sign_calls, failure
):
    changes = {}
    if failure == "session":
        client.cookies.clear()
    elif failure == "csrf":
        client.headers.pop("X-CSRF-Token")
    elif failure == "actor":
        changes["actor_id"] = "another-user"
    elif failure == "enable":
        changes["execution_enabled"] = True
    elif failure == "policy":
        changes["policy"] = {"chain_id": 84532}
    else:
        changes["action_digest"] = "0" * 64
    response = submit(client, issued, **changes)
    assert response.status_code in (401, 403, 409, 422)
    assert execution_count(database) == 0 and not sign_calls


def test_concurrent_http_requests_sign_and_dispatch_at_most_once(
    client, issued, transport, sign_calls, monkeypatch
):
    monkeypatch.setattr(reconcile, "_observe", lambda *args: None)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: submit(client, issued), range(2)))
    assert any(r.status_code == 200 for r in responses)
    assert all(r.status_code in (200, 409) for r in responses)
    assert len(sign_calls) == len(transport.sent) == 1
    assert submit(client, issued).status_code == 200
    assert len(sign_calls) == len(transport.sent) == 1


def test_http_ambiguous_dispatch_only_reconciles_existing_hash(
    client, issued, transport, sign_calls, monkeypatch
):
    transport.failure = True
    monkeypatch.setattr(reconcile, "_observe", lambda *args: None)
    first = submit(client, issued)
    assert first.status_code == 200
    assert first.json()["status"] == "PENDING"
    assert submit(client, issued).json() == first.json()
    assert len(sign_calls) == len(transport.sent) == 1


def test_http_stranded_claim_never_signs_again(client, issued, sign_calls):
    from app.execution.gate import sign_authorized_once

    sign_authorized_once(client.app.state.engine, issued[2], "demo-user", policy=issued[1])
    response = submit(client, issued)
    assert response.status_code == 409
    assert response.json()["code"] == "ALREADY_USED"
    assert len(sign_calls) == 1


def test_http_resume_still_rejects_wrong_action_digest(client, issued, chain, sign_calls):
    response = submit(client, issued, action_digest="0" * 64)
    assert response.status_code == 409
    assert len(sign_calls) == 1


def test_execution_setting_defaults_off(monkeypatch):
    from app.execution.router import ExecutionSettings

    monkeypatch.delenv("EXECUTION_ENABLED", raising=False)
    assert ExecutionSettings(_env_file=None).execution_enabled is False
