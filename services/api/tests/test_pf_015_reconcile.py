"""Real signatures/SQLite and production receipt validation; isolated RPC fixtures only.

All chain receipts/logs below are synthetic test data, never live evidence.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from app.core.errors import DomainError
from app.db.models import AuditRecord, CertificateRecord, ExecutionRecord, FinancialStateRecord
from app.db.state import append_state, read_state
from app.execution import reconcile
from app.execution.rpc import EvmGateway
from hexbytes import HexBytes
from sqlalchemy import func, select
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_015 import broadcast, prepare
from test_pf_015 import transport as transport
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc
from web3 import Web3
from web3.exceptions import TransactionNotFound


@pytest.fixture
def chain(client, issued, transport, monkeypatch, sign_calls):
    execution = prepare(client, issued)
    pending = broadcast(client, issued, execution)
    tx = issued[0]["payload"]["transaction"]
    block_hash = HexBytes("0x" + "ab" * 32)
    tx_hash = HexBytes(pending.tx_hash)
    log = dict(
        address=tx["token_address"],
        topics=[
            Web3.keccak(text="Transfer(address,address,uint256)"),
            HexBytes("0x" + tx["sender"][2:].rjust(64, "0")),
            HexBytes("0x" + tx["recipient"][2:].rjust(64, "0")),
        ],
        data=HexBytes("0x" + f"{int(tx['amount_base_units']):064x}"),
        transactionHash=tx_hash,
        blockHash=block_hash,
        removed=False,
    )

    class Eth:
        chain_id = 84532
        block_number = 11
        canonical = block_hash
        failure = False
        queries = 0
        value = dict(
            transactionHash=tx_hash,
            blockHash=block_hash,
            blockNumber=10,
            status=1,
            logs=[log],
            to=tx["to"],
            **{"from": tx["sender"]},
        )

        def get_transaction_receipt(self, asked_hash):
            self.queries += 1
            assert asked_hash == pending.tx_hash
            if self.failure:
                raise TimeoutError("SECRET provider detail")
            if self.value is None:
                raise TransactionNotFound("isolated missing transaction")
            return self.value

        def get_block(self, number):
            assert number == 10
            return {"hash": self.canonical}

    eth = Eth()
    monkeypatch.setattr(
        reconcile.EvmGateway,
        "from_rpc_url",
        lambda url, policy, n=2: EvmGateway(SimpleNamespace(eth=eth), policy, n),
    )
    return pending, eth


def poll(client, issued, chain, actor="demo-user", confirmations=2):
    return reconcile.reconcile_execution(
        client.app.state.engine,
        issued[2],
        actor,
        policy=issued[1],
        execution_id=chain[0].id,
        confirmations_required=confirmations,
    )


def state(database):
    with database[1]() as session:
        return read_state(session)


def count_events(database, kind):
    with database[1]() as session:
        return sum(a.payload["event_type"] == kind for a in session.scalars(select(AuditRecord)))


def test_confirmation_applies_exact_synthetic_cost_once(
    client, database, issued, chain, transport, sign_calls
):
    before = state(database)
    result = poll(client, issued, chain)
    assert result.status == "CONFIRMED" and result.confirmations == 2 and result.error is None
    after = state(database)
    cost = (
        issued[0]["payload"]["action"]["amount_minor"]
        + issued[0]["payload"]["simulation"]["config"]["fee_minor"]
    )
    assert after.snapshot.version == before.snapshot.version + 1
    assert after.snapshot.assets[0].amount_minor == before.snapshot.assets[0].amount_minor - cost
    position = after.snapshot.assets[-1]
    assert position.amount_minor == issued[0]["payload"]["action"]["amount_minor"]
    assert position.high_risk and not position.liquid and position.source == "synthetic"
    assert after.snapshot.expected_income == before.snapshot.expected_income
    assert poll(client, issued, chain) == result
    assert state(database) == after
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 1
    assert count_events(database, "EXECUTION_RECONCILED") == 1
    assert len(transport.sent) == len(sign_calls) == 1


def test_concurrent_poll_applies_only_once(client, database, issued, chain):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: poll(client, issued, chain).status, range(2)))
    assert results == ["CONFIRMED", "CONFIRMED"]
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 1
    assert state(database).snapshot.version == issued[0]["payload"]["state_version"] + 1


@pytest.mark.parametrize("outcome", ["absent", "insufficient_depth", "reverted", "noncanonical"])
def test_no_ledger_effect_before_canonical_confirmed_transfer(
    client, database, issued, chain, outcome
):
    before = state(database)
    _, eth = chain
    if outcome == "absent":
        eth.value = None
    if outcome == "insufficient_depth":
        eth.block_number = 10
    if outcome == "reverted":
        eth.value = {**eth.value, "status": 0, "logs": []}
    if outcome == "noncanonical":
        eth.canonical = HexBytes("0x" + "cd" * 32)
    result = poll(client, issued, chain)
    assert result.status == {"reverted": "FAILED", "noncanonical": "REORGED"}.get(
        outcome, "PENDING"
    )
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 0


def test_receipt_can_be_reconciled_after_expiry_without_signing(
    client, database, issued, chain, transport, sign_calls, monkeypatch
):
    expiry = datetime.fromisoformat(issued[0]["payload"]["expires_at"].replace("Z", "+00:00"))

    class Clock:
        @staticmethod
        def now(tz=None):
            return expiry + timedelta(days=1)

    monkeypatch.setattr(reconcile, "datetime", Clock)
    assert poll(client, issued, chain).status == "CONFIRMED"
    assert len(sign_calls) == len(transport.sent) == 1


@pytest.mark.parametrize(
    "change",
    [
        "hash",
        "sender",
        "token",
        "amount",
        "recipient",
        "missing_log",
        "duplicate_log",
        "removed_log",
        "log_hash",
        "block_hash",
        "boolean_status",
        "negative_block",
        "short_block_hash",
        "wrong_chain",
    ],
)
def test_malformed_or_unbound_receipt_never_changes_state(client, database, issued, chain, change):
    before = state(database)
    _, eth = chain
    r = dict(eth.value)
    log = dict(r["logs"][0])
    if change == "hash":
        r["transactionHash"] = HexBytes("0x" + "00" * 32)
    if change == "sender":
        r["from"] = "0x" + "00" * 20
    if change == "token":
        log["address"] = "0x" + "00" * 20
    if change == "amount":
        log["data"] = HexBytes("0x" + "00" * 32)
    if change == "recipient":
        log["topics"] = [*log["topics"][:2], HexBytes("0x" + "00" * 32)]
    if change == "removed_log":
        log["removed"] = True
    if change == "log_hash":
        log["transactionHash"] = HexBytes("0x" + "00" * 32)
    if change == "block_hash":
        log["blockHash"] = HexBytes("0x" + "00" * 32)
    if change == "boolean_status":
        r["status"] = True
    if change == "negative_block":
        r["blockNumber"] = -1
    if change == "short_block_hash":
        r["blockHash"] = HexBytes("0x01")
    if change == "wrong_chain":
        eth.chain_id = 1
    r["logs"] = (
        [] if change == "missing_log" else [log, log] if change == "duplicate_log" else [log]
    )
    eth.value = r
    with pytest.raises(DomainError):
        poll(client, issued, chain)
    assert state(database) == before
    with database[1]() as session:
        assert session.get(ExecutionRecord, chain[0].id).status == "PENDING"


def test_rpc_failure_preserves_previous_confirmation_and_ledger(client, database, issued, chain):
    confirmed = poll(client, issued, chain)
    before = state(database)
    chain[1].failure = True
    with pytest.raises(DomainError) as failure:
        poll(client, issued, chain)
    assert "SECRET" not in failure.value.message
    assert state(database) == before
    with database[1]() as session:
        assert session.get(ExecutionRecord, chain[0].id).payload == confirmed.model_dump(
            mode="json"
        )


def test_reorg_reverses_only_own_unchanged_effect_and_reconfirmation_is_idempotent(
    client, database, issued, chain
):
    original = state(database)
    poll(client, issued, chain)
    receipt = chain[1].value
    chain[1].value = None
    assert poll(client, issued, chain).status == "REORGED"
    reversed_state = state(database)
    assert reversed_state.snapshot.assets == original.snapshot.assets
    assert reversed_state.snapshot.version == original.snapshot.version + 2
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 1
    poll(client, issued, chain)
    assert state(database) == reversed_state
    chain[1].value = receipt
    assert poll(client, issued, chain).status == "CONFIRMED"
    poll(client, issued, chain)
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 2
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 1
    assert state(database).snapshot.version == original.snapshot.version + 3


def test_reorg_never_overwrites_later_financial_state(client, database, issued, chain):
    poll(client, issued, chain)
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(
                update={"version": current.snapshot.version + 1, "realized_expense_minor": 500}
            ),
            current.snapshot.version,
        )
    later = state(database)
    chain[1].value = None
    result = poll(client, issued, chain)
    assert result.status == "REORGED" and result.error.code == "CONFLICT"
    assert state(database) == later
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 0


def test_confirmed_transfer_does_not_invent_missing_cash(client, database, issued, chain):
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(
                update={
                    "version": current.snapshot.version + 1,
                    "assets": [
                        a.model_copy(update={"amount_minor": 0}) for a in current.snapshot.assets
                    ],
                }
            ),
            current.snapshot.version,
        )
    before = state(database)
    result = poll(client, issued, chain)
    assert result.status == "CONFIRMED" and result.error.code == "CONFLICT"
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 0


@pytest.mark.parametrize("change", ["actor", "certificate", "audit"])
def test_corrupt_history_or_wrong_actor_never_queries_or_updates(
    client, database, issued, chain, change
):
    before = state(database)
    with database[1].begin() as session:
        if change == "certificate":
            row = session.get(CertificateRecord, issued[2].certificate_id)
            row.payload = {**row.payload, "verifier_signature": "00" * 64}
        if change == "audit":
            row = session.scalar(select(AuditRecord).order_by(AuditRecord.sequence))
            row.payload = {**row.payload, "actor": "tampered"}
    with pytest.raises(DomainError):
        poll(client, issued, chain, actor="wrong-user" if change == "actor" else "demo-user")
    assert state(database) == before
    assert chain[1].queries == 0


def test_ledger_and_receipt_roll_back_together_when_audit_fails(
    client, database, issued, chain, monkeypatch
):
    before = state(database)
    original = reconcile.append_event

    def fail(session, **kwargs):
        if kwargs["event_type"] == "EXECUTION_RECONCILED":
            raise RuntimeError("SECRET audit detail")
        return original(session, **kwargs)

    monkeypatch.setattr(reconcile, "append_event", fail)
    with pytest.raises(DomainError):
        poll(client, issued, chain)
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 0
    with database[1]() as session:
        assert session.get(ExecutionRecord, chain[0].id).status == "PENDING"
        assert session.scalar(select(func.count()).select_from(FinancialStateRecord)) == 2


def test_confirmation_threshold_cannot_be_softened_to_one(client, database, issued, chain):
    before = state(database)
    with pytest.raises(DomainError):
        poll(client, issued, chain, confirmations=1)
    assert state(database) == before


def test_confirmation_depth_loss_is_reorg_and_reverses_unchanged_effect(
    client, database, issued, chain
):
    original = state(database)
    assert poll(client, issued, chain).status == "CONFIRMED"
    chain[1].block_number = 10
    result = poll(client, issued, chain)
    assert result.status == "REORGED" and result.confirmations == 1
    assert state(database).snapshot.assets == original.snapshot.assets


def test_ledger_conflict_rolls_back_savepoint_but_keeps_real_receipt_outcome(
    client, database, issued, chain, monkeypatch
):
    from app.models.contracts import ErrorCode

    before = state(database)
    original = reconcile._apply

    def conflicted(*args, **kwargs):
        original(*args, **kwargs)
        raise DomainError(ErrorCode.CONFLICT, "isolated injected late ledger conflict", 409)

    monkeypatch.setattr(reconcile, "_apply", conflicted)
    result = poll(client, issued, chain)
    assert result.status == "CONFIRMED" and result.error.code == "CONFLICT"
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 0
    assert count_events(database, "EXECUTION_RECONCILED") == 1


def test_transfer_debits_cash_and_explicit_synthetic_fee_without_creating_position(
    client, database, action, configured, rpc, monkeypatch, transport
):
    import json

    from app.execution.signer import TestnetPolicy as OperationalPolicy
    from app.models.contracts import ExecuteRequest
    from eth_account import Account

    key = "0x" + "44" * 32  # Public isolated test-only key.
    wallet = Account.from_key(key).address.lower()
    operational = {**configured[1], "wallet_address": wallet}
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps(operational))
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", key)
    transfer = {**action, "id": "transfer-only-fixture", "action_type": "TRANSFER"}
    response = client.post("/verify", json={"action": transfer})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    policy = OperationalPolicy(
        wallet_address=wallet,
        token_address=operational["token_address"],
        recipient=operational["recipient"],
        token_decimals=6,
        max_gas_limit=100000,
        max_fee_per_gas_wei="100",
    )
    request = ExecuteRequest(
        certificate_id=cert["payload"]["id"],
        action_digest=cert["payload"]["action_digest"],
        idempotency_key="transfer-ledger-fixture",
    )
    issued = (cert, policy, request)
    before = state(database)
    execution = prepare(client, issued)
    execution = broadcast(client, issued, execution)
    observation = dict(
        status="CONFIRMED",
        block_number=10,
        block_hash="0x" + "ab" * 32,
        confirmations=2,
        receipt_status=1,
    )
    # Ledger arithmetic focus only; production raw-receipt checking is covered separately.
    monkeypatch.setattr(reconcile, "_observe", lambda *args: observation)
    result = poll(client, issued, (execution, None))
    assert result.status == "CONFIRMED"
    after = state(database)
    assert len(after.snapshot.assets) == len(before.snapshot.assets)
    assert after.snapshot.assets[0].amount_minor == before.snapshot.assets[0].amount_minor - 10100


def test_current_state_metadata_corruption_refuses_ledger_write(client, database, issued, chain):
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
            current.snapshot.version,
        )
    before = state(database)
    with database[1].begin() as session:
        session.get(FinancialStateRecord, before.id).version = 99
    with pytest.raises(DomainError):
        poll(client, issued, chain)
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 0


def test_canonical_block_changes_during_observation_are_reorged(
    client, database, issued, chain, monkeypatch
):
    before = state(database)
    reads = []

    def changed(number):
        reads.append(number)
        return {"hash": HexBytes("0x" + ("ab" if len(reads) == 1 else "cd") * 32)}

    monkeypatch.setattr(chain[1], "get_block", changed)
    result = poll(client, issued, chain)
    assert result.status == "REORGED" and result.confirmations == 0
    assert state(database) == before


def test_larger_confirmation_requirement_is_honored(client, database, issued, chain):
    before = state(database)
    result = poll(client, issued, chain, confirmations=3)
    assert result.status == "PENDING" and result.confirmations == 2
    assert state(database) == before
    chain[1].block_number = 12
    assert poll(client, issued, chain, confirmations=3).status == "CONFIRMED"
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 1


def test_recovery_conflict_blocks_new_internal_signing(client, database, issued, chain, sign_calls):
    poll(client, issued, chain)
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
            current.snapshot.version,
        )
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    before = len(sign_calls)
    with pytest.raises(DomainError) as failure:
        prepare(client, issued)
    assert failure.value.code == "CONFLICT"
    assert len(sign_calls) == before


def test_recovery_conflict_racing_prepared_attempt_blocks_dispatch(
    client, database, issued, chain, rpc, transport, monkeypatch, sign_calls
):
    from app.models.contracts import ExecuteRequest

    assert poll(client, issued, chain).status == "CONFIRMED"
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
            current.snapshot.version,
        )
    rpc.nonce = 8
    action = {**issued[0]["payload"]["action"], "id": "recovery-race-second-action"}
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    request = ExecuteRequest(
        certificate_id=cert["payload"]["id"],
        action_digest=cert["payload"]["action_digest"],
        idempotency_key="recovery-race-second-attempt",
    )
    second = (cert, issued[1], request)
    prepared = prepare(client, second)
    before = state(database)
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    assert state(database) == before  # No stale-state change can incidentally block the send.

    def counted_send(raw):
        transport.sent.append(raw)
        return "0x" + Web3.keccak(raw).hex().removeprefix("0x")

    monkeypatch.setattr(transport, "broadcast", counted_send)
    monkeypatch.setattr(reconcile.EvmGateway, "from_rpc_url", lambda *a, **kw: transport)
    with pytest.raises(DomainError) as failure:
        broadcast(client, second, prepared)
    assert failure.value.code == "CONFLICT"
    assert len(transport.sent) == 1 and len(sign_calls) == 2


def test_pending_attempt_blocks_new_signing_at_a_different_nonce(
    client, issued, chain, rpc, sign_calls
):
    from app.models.contracts import ExecuteRequest

    rpc.nonce = 8
    action = {**issued[0]["payload"]["action"], "id": "pending-second-nonce"}
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    request = ExecuteRequest(
        certificate_id=cert["payload"]["id"],
        action_digest=cert["payload"]["action_digest"],
        idempotency_key="pending-next-nonce",
    )
    with pytest.raises(DomainError) as failure:
        prepare(client, (cert, issued[1], request))
    assert failure.value.code == "CONFLICT" and len(sign_calls) == 1


def test_confirmation_threshold_cannot_change_after_first_observation(
    client, database, issued, chain
):
    assert poll(client, issued, chain, confirmations=3).status == "PENDING"
    before = state(database)
    with pytest.raises(DomainError) as failure:
        poll(client, issued, chain, confirmations=2)
    assert failure.value.code == "POLICY_DENIED"
    assert state(database) == before


def test_recovery_inspection_is_read_only_and_excludes_signing_capability(
    client, database, issued, chain
):
    before = state(database)
    with database[1]() as session:
        audit_count = session.scalar(select(func.count()).select_from(AuditRecord))
    result = reconcile.inspect_recovery(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1], execution_id=chain[0].id
    )
    assert result["status"] == "PENDING"
    assert result["next_action"] == "QUERY_EXISTING_HASH"
    assert result["tx_hash"] == chain[0].tx_hash
    assert "raw_transaction" not in result
    assert chain[1].queries == 0
    assert state(database) == before
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(AuditRecord)) == audit_count


def test_recovery_inspection_identifies_manual_ledger_conflict(client, database, issued, chain):
    poll(client, issued, chain)
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
            current.snapshot.version,
        )
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    queries = chain[1].queries
    result = reconcile.inspect_recovery(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1], execution_id=chain[0].id
    )
    assert result["next_action"] == "MANUAL_LEDGER_REVIEW"
    assert result["ledger_effect_active"] is True
    assert result["automatic_reversal_safe"] is False
    assert chain[1].queries == queries


def test_recovery_inspection_refuses_wrong_actor(client, issued, chain):
    with pytest.raises(DomainError):
        reconcile.inspect_recovery(
            client.app.state.engine,
            issued[2],
            "wrong-user",
            policy=issued[1],
            execution_id=chain[0].id,
        )
    assert chain[1].queries == 0


def test_explicit_recovery_preserves_later_edits_and_reverses_untouched_assets(
    client, database, issued, chain
):
    original = state(database)
    poll(client, issued, chain)
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(
                update={"version": current.snapshot.version + 1, "realized_expense_minor": 500}
            ),
            current.snapshot.version,
        )
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    inspected = state(database)
    result = reconcile.recover_unchanged_assets(
        client.app.state.engine,
        issued[2],
        "demo-user",
        policy=issued[1],
        execution_id=chain[0].id,
        expected_state_hash=inspected.snapshot_hash,
    )
    assert result.status == "REORGED" and result.error is None
    recovered = state(database)
    assert recovered.snapshot.assets == original.snapshot.assets
    assert recovered.snapshot.realized_expense_minor == 500
    assert recovered.snapshot.version == inspected.snapshot.version + 1
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 1
    with pytest.raises(DomainError):
        reconcile.recover_unchanged_assets(
            client.app.state.engine,
            issued[2],
            "demo-user",
            policy=issued[1],
            execution_id=chain[0].id,
            expected_state_hash=recovered.snapshot_hash,
        )
    assert state(database) == recovered


@pytest.mark.parametrize("change", ["cash", "position", "stale_hash", "reconfirmed"])
def test_explicit_recovery_refuses_changed_effect_or_chain(client, database, issued, chain, change):
    poll(client, issued, chain)
    receipt = chain[1].value
    with database[1].begin() as session:
        current = read_state(session)
        assets = list(current.snapshot.assets)
        if change in ("cash", "position"):
            index = 0 if change == "cash" else -1
            assets[index] = assets[index].model_copy(
                update={"amount_minor": assets[index].amount_minor + 1}
            )
        append_state(
            session,
            current.snapshot.model_copy(
                update={"version": current.snapshot.version + 1, "assets": assets}
            ),
            current.snapshot.version,
        )
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    before = state(database)
    if change == "reconfirmed":
        chain[1].value = receipt
    with pytest.raises(DomainError):
        reconcile.recover_unchanged_assets(
            client.app.state.engine,
            issued[2],
            "demo-user",
            policy=issued[1],
            execution_id=chain[0].id,
            expected_state_hash="0" * 64 if change == "stale_hash" else before.snapshot_hash,
        )
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 0


@pytest.mark.parametrize("failure", ["rpc", "audit", "actor"])
def test_explicit_recovery_failure_preserves_state_and_conflict(
    client, database, issued, chain, monkeypatch, failure
):
    poll(client, issued, chain)
    with database[1].begin() as session:
        current = read_state(session)
        append_state(
            session,
            current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
            current.snapshot.version,
        )
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    before = state(database)
    if failure == "rpc":
        chain[1].failure = True
    if failure == "audit":
        original = reconcile.append_event

        def fail(session, **kwargs):
            if kwargs["event_type"] == "EXECUTION_RECONCILED":
                raise RuntimeError("SECRET audit detail")
            return original(session, **kwargs)

        monkeypatch.setattr(reconcile, "append_event", fail)
    with pytest.raises(DomainError) as error:
        reconcile.recover_unchanged_assets(
            client.app.state.engine,
            issued[2],
            "wrong-user" if failure == "actor" else "demo-user",
            policy=issued[1],
            execution_id=chain[0].id,
            expected_state_hash=before.snapshot_hash,
        )
    assert "SECRET" not in error.value.message
    assert state(database) == before
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 0
