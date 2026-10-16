"""Real policy + seeded simulation; explicit assumptions only in fixtures."""

from dataclasses import replace
from unittest.mock import Mock

import pytest
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import FinancialStateRecord
from app.models.contracts import ErrorCode
from app.optimizer import chain as chain_module
from app.optimizer import router as optimizer_router
from app.optimizer import service
from app.optimizer.service import ChainBounds, optimize
from test_pf_007 import evidence as evidence
from test_pf_009 import configured as configured
from test_pf_009 import trusted as trusted


@pytest.fixture
def bounds():
    return ChainBounds(2000000, 10000000, 100000, 10)


@pytest.fixture
def funded(trusted):
    snapshot = trusted.state.snapshot.model_dump(mode="json")
    snapshot["assets"][0]["amount_minor"] = 2000000
    from app.models.contracts import StateSnapshot

    snapshot = StateSnapshot.model_validate(snapshot)
    return trusted.model_copy(
        update={
            "state": trusted.state.model_copy(
                update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
            )
        }
    )


def test_real_search_finds_concentration_boundary_without_mutation(funded, bounds):
    before = funded.model_dump_json()
    result = optimize(funded, bounds)
    assert result.status == "SAFE_ACTION"
    assert result.max_amount_minor == 275000
    assert result.action.amount_minor == 275000
    assert result.action.id != funded.action.id
    assert result.action.id.startswith("optimized-")
    assert result.next_cent_rejected
    assert "HIGH_RISK_CONCENTRATION_EXCEEDED" in result.limiting_checks
    assert result.verifier_calls <= 30
    assert funded.model_dump_json() == before
    assert optimize(funded, bounds) == result


def test_chain_token_balance_is_exact_cent_cap(funded, bounds):
    result = optimize(funded, replace(bounds, token_balance_minor=12345))
    assert result.max_amount_minor == 12345
    assert result.limiting_checks == ["CHAIN_TOKEN_BALANCE"]
    assert result.next_cent_rejected


def test_baseline_preserves_no_safe_action(trusted, bounds):
    result = optimize(trusted, bounds)
    assert result.status == "NO_SAFE_ACTION"
    assert result.max_amount_minor == 0 and result.action is None
    assert result.verifier_calls == 1
    assert "RESERVE_BREACH_RISK_EXCEEDED" in result.limiting_checks
    assert any(reason.startswith("STRESS_") for reason in result.limiting_checks)


@pytest.mark.parametrize(
    "changes,reason",
    [
        ({"token_balance_minor": 0}, "CHAIN_TOKEN_BALANCE"),
        ({"native_balance_wei": 999999}, "CHAIN_GAS_BALANCE"),
    ],
)
def test_chain_balance_and_worst_case_gas_fail(funded, bounds, changes, reason):
    result = optimize(funded, replace(bounds, **changes))
    assert result.status == "NO_SAFE_ACTION"
    assert reason in result.limiting_checks


def test_exact_native_gas_boundary_is_allowed(funded, bounds):
    result = optimize(funded, replace(bounds, native_balance_wei=1000000, token_balance_minor=1))
    assert result.status == "SAFE_ACTION" and result.max_amount_minor == 1


def test_approval_threshold_does_not_cap_safe_amount(funded, bounds):
    result = optimize(funded, replace(bounds, token_balance_minor=15001))
    assert result.max_amount_minor == 15001
    assert result.max_amount_minor > funded.constitution.rules.autonomy_limit_minor


def test_borrowed_funding_is_never_rescued(funded, bounds):
    value = funded.model_copy(
        update={"action": funded.action.model_copy(update={"funding_source": "borrowed"})}
    )
    result = optimize(value, bounds)
    assert result.status == "NO_SAFE_ACTION"
    assert "BORROWED_FUNDING_FORBIDDEN" in result.limiting_checks


def test_unknown_model_is_explicitly_non_monotonic(funded, bounds):
    value = funded.model_copy(
        update={"config": funded.config.model_copy(update={"model_version": "future"})}
    )
    result = optimize(value, bounds)
    assert result.status == "NON_MONOTONIC_FEASIBILITY"
    assert not result.next_cent_rejected and result.verifier_calls == 0


def test_unavailable_simulator_is_not_no_safe_action(funded, bounds, monkeypatch):
    def fail(_):
        raise ValueError("unavailable")

    monkeypatch.setattr(service.verifier, "simulate", fail)
    with pytest.raises(DomainError) as exc:
        optimize(funded, bounds)
    assert exc.value.code == ErrorCode.UNAVAILABLE


def test_invalid_bounds_and_corrupt_state_refuse(funded, bounds):
    with pytest.raises(ValueError):
        optimize(funded, replace(bounds, token_balance_minor=True))
    with pytest.raises(ValueError):
        optimize(
            funded.model_copy(
                update={"state": funded.state.model_copy(update={"snapshot_hash": "f" * 64})}
            ),
            bounds,
        )


def test_api_real_checks_no_writes(client, database, configured, bounds, monkeypatch):
    monkeypatch.setattr(optimizer_router, "load_chain_bounds", lambda _: bounds)
    first = client.post("/optimize", json={"action": configured})
    assert first.status_code == 200
    assert first.json()["status"] == "NO_SAFE_ACTION"
    assert client.post("/optimize", json={"action": configured}).json() == first.json()
    from app.db.models import CandidateRecord, SimulationRecord
    from sqlalchemy import func, select

    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(CandidateRecord)) == 0
        assert session.scalar(select(func.count()).select_from(SimulationRecord)) == 0
        assert session.get(FinancialStateRecord, "state-v1").version == 1


def test_api_without_policy_is_unavailable(client, trusted):
    response = client.post("/optimize", json={"action": trusted.action.model_dump(mode="json")})
    assert response.status_code == 503 and response.json()["code"] == "UNAVAILABLE"


def test_api_rejects_client_authority_and_requires_session(client, configured):
    assert (
        client.post(
            "/optimize", json={"action": configured, "chain": {"token_balance_minor": 999999}}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/optimize", json={"action": configured}, headers={"X-CSRF-Token": "bad"}
        ).status_code
        == 403
    )
    client.cookies.clear()
    assert client.post("/optimize", json={"action": configured}).status_code == 401


def test_api_chain_unavailable_never_fabricates_result(client, configured, monkeypatch):
    def fail(_):
        raise DomainError(ErrorCode.UNAVAILABLE, "Chain unavailable")

    monkeypatch.setattr(optimizer_router, "load_chain_bounds", fail)
    response = client.post("/optimize", json={"action": configured})
    assert response.status_code == 503 and "max_amount_minor" not in response.json()


@pytest.fixture
def rpc(funded, monkeypatch):
    settings = Mock()
    settings.rpc_url.get_secret_value.return_value = "https://rpc.invalid"
    settings.wallet_address = "0x" + "3" * 40
    settings.test_token_address = funded.action.token_address
    settings.approved_recipient = funded.action.recipient
    settings.optimizer_gas_limit = 100000
    settings.optimizer_max_fee_per_gas_wei = 10
    monkeypatch.setattr(chain_module, "ChainSettings", lambda: settings)
    provider = Mock()
    provider.eth.chain_id = 84532
    provider.eth.block_number = 42
    provider.eth.get_code.return_value = b"contract"
    provider.eth.call.side_effect = [(6).to_bytes(32, "big"), (123456789).to_bytes(32, "big")]
    provider.eth.get_balance.return_value = 1000000
    provider.eth.get_block.return_value = {"baseFeePerGas": 5}
    monkeypatch.setattr(chain_module, "Web3", Mock(return_value=provider))
    return provider


def test_chain_reads_exact_units_at_one_block(funded, rpc):
    result = chain_module.load_chain_bounds(funded.action)
    assert result.token_balance_minor == 12345
    assert result.native_balance_wei == 1000000
    assert rpc.eth.get_balance.call_args.kwargs["block_identifier"] == 42
    assert all(call.kwargs["block_identifier"] == 42 for call in rpc.eth.call.call_args_list)


@pytest.mark.parametrize("change", ["network", "no-code", "malformed", "fee", "rpc"])
def test_bad_chain_reads_fail_closed(funded, rpc, change):
    if change == "network":
        rpc.eth.chain_id = 1
    elif change == "no-code":
        rpc.eth.get_code.return_value = b""
    elif change == "malformed":
        rpc.eth.call.side_effect = [b"bad"]
    elif change == "fee":
        rpc.eth.get_block.return_value = {"baseFeePerGas": 11}
    else:
        rpc.eth.get_balance.side_effect = RuntimeError("secret RPC URL")
    with pytest.raises(DomainError) as exc:
        chain_module.load_chain_bounds(funded.action)
    assert "secret" not in exc.value.message


def test_emergency_stress_limits_amount_to_exact_cent(funded, bounds):
    from app.models.contracts import ConstitutionRules

    rules = ConstitutionRules.model_validate(
        {**funded.constitution.rules.model_dump(), "high_risk_concentration_bps": 10000}
    )
    policy = funded.constitution.model_copy(update={"rules": rules, "policy_digest": digest(rules)})
    value = funded.model_copy(update={"constitution": policy})
    result = optimize(value, bounds)
    assert result.max_amount_minor == 579900
    assert result.limiting_checks == ["STRESS_EMERGENCY_EXPENSE"]


def test_zero_fee_is_preserved(funded, bounds):
    value = funded.model_copy(update={"config": funded.config.model_copy(update={"fee_minor": 0})})
    result = optimize(value, replace(bounds, token_balance_minor=100))
    assert result.max_amount_minor == 100


def test_changed_final_evaluation_returns_non_monotonic(funded, bounds, monkeypatch):
    original = service.verifier.evaluate

    def unstable(value, simulation):
        verdict = original(value, simulation)
        # A changing engine denies the final repeated maximum after accepting it earlier.
        if value.action.amount_minor == 100:
            unstable.calls += 1
            if unstable.calls > 1:
                from app.models.contracts import RuleOutcome

                return verdict.model_copy(
                    update={
                        "decision": "DENY",
                        "checks": [
                            RuleOutcome(
                                rule="test", status="FAIL", reason_code="CHANGED", measured={}
                            )
                        ],
                    }
                )
        return verdict

    unstable.calls = 0
    monkeypatch.setattr(service.verifier, "evaluate", unstable)
    result = optimize(funded, replace(bounds, token_balance_minor=100))
    assert result.status == "NON_MONOTONIC_FEASIBILITY"
    assert result.action is None and not result.next_cent_rejected


@pytest.mark.parametrize("kind", ["missing", "duplicate", "corrupt"])
def test_api_invalid_config_refuses(client, database, configured, kind):
    from app.db.models import SimulationConfigRecord
    from sqlalchemy import select

    with database[1].begin() as session:
        row = session.scalar(select(SimulationConfigRecord))
        if kind == "missing":
            session.delete(row)
        elif kind == "duplicate":
            payload = {**row.payload, "id": "second-config"}
            session.add(
                SimulationConfigRecord(
                    id="second-config", config_digest=digest(payload), payload=payload
                )
            )
        else:
            row.config_digest = "f" * 64
    response = client.post("/optimize", json={"action": configured})
    assert response.status_code == 503 and response.json()["code"] == "UNAVAILABLE"


def test_api_positive_result_uses_real_policy_and_simulation(
    client, database, configured, bounds, funded, monkeypatch
):
    from app.db.state import append_state

    snapshot = funded.state.snapshot.model_copy(update={"version": 2})
    with database[1].begin() as session:
        append_state(session, snapshot, 1)
    monkeypatch.setattr(
        optimizer_router, "load_chain_bounds", lambda _: replace(bounds, token_balance_minor=12345)
    )
    response = client.post("/optimize", json={"action": configured})
    assert response.status_code == 200
    assert response.json()["max_amount_minor"] == 12345
    assert response.json()["next_cent_rejected"] is True


def test_missing_chain_configuration_is_sanitized(funded, monkeypatch):
    def fail():
        raise ValueError("sensitive setting contents")

    monkeypatch.setattr(chain_module, "ChainSettings", fail)
    with pytest.raises(DomainError) as exc:
        chain_module.load_chain_bounds(funded.action)
    assert exc.value.code == ErrorCode.UNAVAILABLE
    assert "sensitive" not in exc.value.message


def test_operational_recipient_mismatch_is_denied(funded, rpc):
    action = funded.action.model_copy(update={"recipient": "0x" + "4" * 40})
    with pytest.raises(DomainError) as exc:
        chain_module.load_chain_bounds(action)
    assert exc.value.code == ErrorCode.POLICY_DENIED
    rpc.eth.get_balance.assert_not_called()


def test_all_search_checks_use_production_verifier(funded, bounds, monkeypatch):
    original = service.verifier.recompute
    checked = []

    def observe(value):
        checked.append(value.action.amount_minor)
        return original(value)

    monkeypatch.setattr(service.verifier, "recompute", observe)
    result = optimize(funded, replace(bounds, token_balance_minor=100))
    assert result.status == "SAFE_ACTION"
    assert len(checked) == result.verifier_calls
    assert checked[-2:] == [100, 101]


def test_verifier_missing_stress_evidence_fails_closed(funded, bounds, monkeypatch):
    original = service.verifier.simulate

    def incomplete(value):
        simulation = original(value)
        return simulation.model_copy(update={"stress_results": simulation.stress_results[:-1]})

    monkeypatch.setattr(service.verifier, "simulate", incomplete)
    with pytest.raises(DomainError) as exc:
        optimize(funded, bounds)
    assert exc.value.code == ErrorCode.UNAVAILABLE
