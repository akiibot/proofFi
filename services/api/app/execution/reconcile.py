"""Read-only chain reconciliation and atomic synthetic-ledger effects.

Never signs, sends, replaces, or renews authority. Expired certificates may be
checked at their historical claim time solely to identify an existing attempt.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    AuditRecord,
    ConstitutionVersionRecord,
    ExecutionRecord,
    FinancialStateRecord,
    SimulationConfigRecord,
)
from app.db.state import append_state, read_state
from app.execution import gate, service
from app.execution.rpc import EvmGateway, hash_hex
from app.execution.signer import TestnetPolicy
from app.models.contracts import (
    ApiError,
    AssetBalance,
    AuditEvent,
    ErrorCode,
    ExecuteRequest,
    Execution,
    FinancialState,
    SimulationConfig,
    StateSnapshot,
    TrustedSimulationInput,
)
from app.policy.service import checked_version
from app.verifier.service import RuntimeSettings, recompute


def _history(session, body, actor_id, policy, execution_id):
    record = session.get(ExecutionRecord, execution_id)
    if record is None:
        gate.invalid("Execution not found")
    execution = Execution.model_validate(record.payload)
    if (
        record.id != execution.id
        or record.certificate_id != execution.certificate_id
        or record.certificate_id != body.certificate_id
        or record.idempotency_key != body.idempotency_key
        or record.status != execution.status
        or record.tx_hash != execution.tx_hash
        or execution.status == "CLAIMED"
        or execution.tx_hash is None
    ):
        gate.invalid("Stored execution binding mismatch")
    claimed_at = gate.utc_time(record.created_at)
    if claimed_at is None or claimed_at > datetime.now(UTC):
        gate.invalid("Claim time is invalid")
    row, cert = gate.load_certificate(session, body, claimed_at)
    p = cert.payload
    old = session.get(FinancialStateRecord, row.state_id)
    snapshot = StateSnapshot.model_validate(old.payload)
    if (
        old.user_id != actor_id
        or snapshot.user_id != actor_id
        or old.version != snapshot.version
        or snapshot.version != p.state_version
        or old.snapshot_hash != digest(snapshot)
        or old.snapshot_hash != p.state_snapshot_hash
    ):
        gate.invalid("Historical financial state binding mismatch")
    constitution = checked_version(
        session.get(ConstitutionVersionRecord, p.constitution_version), actor_id
    )
    config_row = session.get(SimulationConfigRecord, p.simulation.config.id)
    config = SimulationConfig.model_validate(config_row.payload)
    if (
        constitution.policy_digest != p.policy_digest
        or config.id != config_row.id
        or digest(config) != config_row.config_digest
        or config != p.simulation.config
    ):
        gate.invalid("Historical policy/config binding mismatch")
    rules, action = constitution.rules, p.action
    if (
        action.chain_id != rules.allowed_chain_id
        or action.token_address not in rules.allowed_tokens
        or action.recipient in rules.blocked_recipients
        or (action.funding_source == "borrowed" and rules.borrowed_funding_forbidden)
    ):
        gate.invalid("Historical hard policy refuses action")
    required = (
        p.approval.required
        or action.amount_minor > rules.autonomy_limit_minor
        or action.recipient not in rules.known_recipients
    )
    gate.check_approval(session, cert, actor_id, required, claimed_at, consumed_at=claimed_at)
    gate.check_artifacts(session, row, cert)
    trusted = TrustedSimulationInput(
        state=FinancialState(
            id=old.id,
            snapshot=snapshot,
            snapshot_hash=old.snapshot_hash,
            active_constitution_version=constitution.id,
        ),
        constitution=constitution,
        config=config,
        action=action,
    )
    gate.check_recomputed(cert, trusted, recompute)
    gate.check_persisted_audit(session, p.simulation, actor_id)
    events = [
        AuditEvent.model_validate(a.payload)
        for a in session.scalars(select(AuditRecord).order_by(AuditRecord.sequence))
    ]
    original = execution.model_copy(
        update={
            "status": "CLAIMED",
            "tx_hash": None,
            "block_number": None,
            "confirmations": 0,
            "error": None,
        }
    )
    claim_event = service._require_event(
        events, "EXECUTION_CLAIMED", execution_id, actor_id, digest(original), p.id
    )
    if claim_event.created_at != claimed_at or (
        claim_event.details.get("certificate_hash") != cert.certificate_hash
        or claim_event.details.get("action_digest") != p.action_digest
    ):
        gate.invalid("Historical claim audit binding mismatch")
    transaction = policy.validate_transaction(p.transaction)
    service._checked_envelope(session, execution, transaction, events, actor_id)
    pending = original.model_copy(update={"status": "PENDING", "tx_hash": execution.tx_hash})
    service._require_event(
        events, "EXECUTION_DISPATCH_RESERVED", execution_id, actor_id, digest(pending), p.id
    )
    observations = [
        a
        for a in events
        if a.event_type == "EXECUTION_RECONCILED" and a.details.get("execution_id") == execution_id
    ]
    if observations:
        if observations[-1].actor != actor_id or observations[-1].artifact_digest != digest(
            execution
        ):
            gate.invalid("Execution observation audit mismatch")
    elif execution != pending:
        gate.invalid("Execution changed without receipt audit")
    return record, execution, cert, transaction, events, observations


def _hash32(value):
    encoded = hash_hex(value)
    if len(encoded) != 66:
        raise ValueError("Expected 32-byte chain hash")
    return encoded


def _observe(gateway, tx_hash, transaction):
    """Validate raw receipt, canonical block and exact ERC20 Transfer evidence."""
    gateway._assert_chain()
    eth = gateway.web3.eth
    try:
        receipt = eth.get_transaction_receipt(tx_hash)
    except TransactionNotFound:
        return None
    block, status = receipt["blockNumber"], receipt["status"]
    block_hash = _hash32(receipt["blockHash"])
    if (
        type(block) is not int
        or block < 0
        or type(status) is not int
        or status not in (0, 1)
        or _hash32(receipt["transactionHash"]) != tx_hash
        or receipt["from"].lower() != transaction.sender
        or receipt["to"].lower() != transaction.to
    ):
        raise ValueError("Receipt does not identify the signed transaction")
    canonical = _hash32(eth.get_block(block)["hash"])
    latest = eth.block_number
    if type(latest) is not int or latest < 0:
        raise ValueError("Invalid chain height")
    confirmations = max(0, latest - block + 1)
    if canonical != block_hash or block > latest:
        result, confirmations = "REORGED", 0
    else:
        if status == 1:
            expected_topics = [
                hash_hex(Web3.keccak(text="Transfer(address,address,uint256)")),
                "0x" + transaction.sender[2:].rjust(64, "0"),
                "0x" + transaction.recipient[2:].rjust(64, "0"),
            ]
            matches = []
            for log in receipt["logs"]:
                if (
                    log["address"].lower() == transaction.token_address
                    and [hash_hex(t) for t in log["topics"]] == expected_topics
                ):
                    if (
                        hash_hex(log["data"]) != "0x" + f"{int(transaction.amount_base_units):064x}"
                        or _hash32(log["transactionHash"]) != tx_hash
                        or _hash32(log["blockHash"]) != block_hash
                        or log.get("removed", False) is not False
                    ):
                        raise ValueError("Transfer log binding mismatch")
                    matches.append(log)
            if len(matches) != 1:
                raise ValueError("Exact token transfer evidence required")
        result = (
            "FAILED"
            if status == 0
            else "CONFIRMED"
            if confirmations >= gateway.confirmations_required
            else "PENDING"
        )
    # Observe canonical identity again after reading height/logs. Future reorgs
    # remain possible and must be detected by subsequent reconciliation.
    if _hash32(eth.get_block(block)["hash"]) != canonical:
        result, confirmations = "REORGED", 0
    gateway._assert_chain()
    return dict(
        status=result,
        block_number=block,
        block_hash=block_hash,
        confirmations=confirmations,
        receipt_status=status,
    )


def _active_effect(events, execution_id):
    active = None
    for event in events:
        if event.details.get("execution_id") != execution_id:
            continue
        if event.event_type == "EXECUTION_LEDGER_APPLIED":
            if active is not None:
                gate.invalid("Duplicate active execution ledger effect")
            active = event
        elif event.event_type == "EXECUTION_LEDGER_REVERSED":
            if active is None or event.details.get("applied_event_id") != active.id:
                gate.invalid("Execution ledger reversal binding mismatch")
            active = None
    return active


def _current_state(session, actor_id):
    current = read_state(session, actor_id)
    row = session.get(FinancialStateRecord, current.id)
    if (
        row.user_id != actor_id
        or current.snapshot.user_id != actor_id
        or row.version != current.snapshot.version
    ):
        gate.invalid("Current financial state metadata mismatch")
    return current


def _apply(session, cert, execution, actor_id):
    current = _current_state(session, actor_id)
    snapshot = current.snapshot
    ids = [a.id for a in snapshot.assets]
    position_id = "allocation-" + execution.id
    if len(ids) != len(set(ids)) or position_id in ids:
        raise DomainError(ErrorCode.CONFLICT, "Planning ledger asset identity conflict", 409)
    remaining = cert.payload.action.amount_minor + cert.payload.simulation.config.fee_minor
    assets = []
    # Deterministic integer-cent debit, matching the approved risk model's pool.
    debits = {}
    for asset in sorted(snapshot.assets, key=lambda a: a.id):
        debit = min(asset.amount_minor, remaining) if asset.liquid and not asset.high_risk else 0
        debits[asset.id] = debit
        remaining -= debit
    if remaining:
        raise DomainError(
            ErrorCode.CONFLICT,
            "Confirmed transfer needs manual ledger recovery: insufficient synthetic cash",
            409,
        )
    for asset in snapshot.assets:
        assets.append(
            asset.model_copy(update={"amount_minor": asset.amount_minor - debits[asset.id]})
        )
    if cert.payload.action.action_type == "TEST_TOKEN_ALLOCATION":
        assets.append(
            AssetBalance(
                id=position_id,
                asset="TEST_TOKEN_ALLOCATION",
                amount_minor=cert.payload.action.amount_minor,
                liquid=False,
                high_risk=True,
            )
        )
    updated = StateSnapshot.model_validate_json(
        snapshot.model_copy(
            update={"version": snapshot.version + 1, "assets": assets}
        ).model_dump_json()
    )
    after = append_state(session, updated, snapshot.version)
    return append_event(
        session,
        actor=actor_id,
        event_type="EXECUTION_LEDGER_APPLIED",
        artifact_digest=after.snapshot_hash,
        now=datetime.now(UTC),
        details={
            "execution_id": execution.id,
            "tx_hash": execution.tx_hash,
            "before_state_id": current.id,
            "after_state_id": after.id,
            "amount_minor": cert.payload.action.amount_minor,
            "synthetic_fee_minor": cert.payload.simulation.config.fee_minor,
        },
    )


def _reverse(session, effect, actor_id):
    current = _current_state(session, actor_id)
    if (
        current.id != effect.details["after_state_id"]
        or current.snapshot_hash != effect.artifact_digest
    ):
        raise DomainError(
            ErrorCode.CONFLICT,
            "Reorg needs manual ledger recovery: later financial state exists",
            409,
        )
    before = session.get(FinancialStateRecord, effect.details["before_state_id"])
    snapshot = StateSnapshot.model_validate(before.payload)
    if (
        before.user_id != actor_id
        or snapshot.user_id != actor_id
        or before.version != snapshot.version
        or digest(snapshot) != before.snapshot_hash
    ):
        gate.invalid("Pre-execution ledger state integrity failed")
    restored = StateSnapshot.model_validate_json(
        snapshot.model_copy(update={"version": current.snapshot.version + 1}).model_dump_json()
    )
    after = append_state(session, restored, current.snapshot.version)
    append_event(
        session,
        actor=actor_id,
        event_type="EXECUTION_LEDGER_REVERSED",
        artifact_digest=after.snapshot_hash,
        now=datetime.now(UTC),
        details={
            "execution_id": effect.details["execution_id"],
            "applied_event_id": effect.id,
            "after_state_id": after.id,
        },
    )


def reconcile_execution(
    engine,
    body: ExecuteRequest,
    actor_id: str,
    *,
    policy: TestnetPolicy,
    execution_id: str,
    confirmations_required: int = 2,
) -> Execution:
    """Poll an existing hash only; atomically update outcome, ledger and linked audit.

    Never restores an old snapshot over later financial edits. Such a conflict
    remains visible on the execution for manual recovery, without invented funds.
    """
    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    try:
        if type(confirmations_required) is not int or confirmations_required < 2:
            raise DomainError(ErrorCode.POLICY_DENIED, "At least two confirmations required", 403)
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            record, execution, cert, transaction, events, observations = _history(
                session, body, actor_id, policy, execution_id
            )
            if observations and any(
                event.details.get("required_confirmations") != confirmations_required
                for event in observations
            ):
                raise DomainError(
                    ErrorCode.POLICY_DENIED,
                    "Confirmation threshold is fixed for this execution",
                    403,
                )
            gateway = EvmGateway.from_rpc_url(
                RuntimeSettings().rpc_url.get_secret_value(), policy, confirmations_required
            )
            observation = _observe(gateway, execution.tx_hash, transaction)
            previously_included = any(a.details.get("block_number", -1) >= 0 for a in observations)
            if observation is None:
                observation = dict(
                    status="REORGED" if previously_included else "PENDING",
                    block_number=None,
                    block_hash="",
                    confirmations=0,
                    receipt_status=-1,
                )
            if execution.status == "CONFIRMED" and observation["status"] == "PENDING":
                observation["status"] = "REORGED"
            active = _active_effect(events, execution_id)
            error = None
            try:
                with session.begin_nested():
                    if observation["status"] == "CONFIRMED" and active is None:
                        _apply(session, cert, execution, actor_id)
                    elif observation["status"] != "CONFIRMED" and active is not None:
                        _reverse(session, active, actor_id)
            except DomainError as failure:
                if failure.code != ErrorCode.CONFLICT:
                    raise
                error = ApiError(code=failure.code, message=failure.message)
            updated = Execution.model_validate(
                {
                    **execution.model_dump(mode="json"),
                    "status": observation["status"],
                    "block_number": observation["block_number"],
                    "confirmations": observation["confirmations"],
                    "error": error.model_dump(mode="json") if error else None,
                }
            )
            changed_evidence = not observations or any(
                observations[-1].details.get(key) != observation[key]
                for key in ("block_hash", "receipt_status")
            )
            if updated != execution or changed_evidence:
                record.status = updated.status
                record.payload = updated.model_dump(mode="json")
                append_event(
                    session,
                    actor=actor_id,
                    event_type="EXECUTION_RECONCILED",
                    artifact_digest=digest(updated),
                    now=datetime.now(UTC),
                    details={
                        "execution_id": execution_id,
                        "certificate_id": cert.payload.id,
                        "tx_hash": execution.tx_hash,
                        "block_number": observation["block_number"]
                        if observation["block_number"] is not None
                        else -1,
                        "block_hash": observation["block_hash"],
                        "receipt_status": observation["receipt_status"],
                        "required_confirmations": confirmations_required,
                    },
                )
            return updated
    except DomainError:
        raise
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE,
            "Receipt reconciliation unavailable; preserve existing execution and hash",
        ) from None
