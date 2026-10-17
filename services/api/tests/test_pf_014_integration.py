"""Internal integration only; genuine signatures/SQLite, isolated RPC fixtures."""

import pytest
from app.core.errors import DomainError
from app.execution import reconcile
from app.execution import router as entry
from app.models.contracts import ExecuteRequest
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_015 import transport as transport
from test_pf_015_reconcile import chain as chain
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


def execute(client, issued):
    return entry.execute_internal(client.app.state.engine, issued[2], "demo-user", policy=issued[1])


def test_new_internal_request_prepares_once_and_returns_pending(
    client, issued, transport, sign_calls, monkeypatch
):
    # No receipt fixture: this test isolates the new composition, not receipt validation.
    monkeypatch.setattr(reconcile, "_observe", lambda *args: None)
    first = execute(client, issued)
    assert first.status == "PENDING" and first.tx_hash is not None
    assert execute(client, issued) == first
    assert len(sign_calls) == len(transport.sent) == 1
    assert client.post("/execute", json=issued[2].model_dump(mode="json")).status_code == 501


def test_existing_attempt_only_reconciles_real_validated_receipt(
    client, issued, chain, transport, sign_calls
):
    result = execute(client, issued)
    assert result.status == "CONFIRMED" and result.error is None
    assert execute(client, issued) == result
    assert len(sign_calls) == len(transport.sent) == 1


def test_mismatched_existing_idempotency_is_not_a_resume(client, issued, chain, sign_calls):
    request = ExecuteRequest(
        **{**issued[2].model_dump(), "idempotency_key": "different-integration-key"}
    )
    with pytest.raises(DomainError):
        execute(client, (*issued[:2], request))
    assert len(sign_calls) == 1


def test_stranded_claim_is_never_automatically_signed_again(client, issued, sign_calls):
    from app.execution.gate import sign_authorized_once

    sign_authorized_once(client.app.state.engine, issued[2], "demo-user", policy=issued[1])
    with pytest.raises(DomainError):
        execute(client, issued)
    assert len(sign_calls) == 1


def test_ambiguous_send_still_reconciles_without_retry(
    client, issued, transport, sign_calls, monkeypatch
):
    transport.failure = True
    monkeypatch.setattr(reconcile, "_observe", lambda *args: None)
    result = execute(client, issued)
    assert result.status == "PENDING"
    assert execute(client, issued) == result
    assert len(sign_calls) == len(transport.sent) == 1
