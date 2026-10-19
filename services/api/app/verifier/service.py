"""Trusted issuance; no transaction signer, broadcast, or public authority input.

SQLite serializes financial/policy reads and all artifact writes. RPC is read-only;
its bounded observations grant no execution authority. The executor must repeat
validation and atomically claim before invoking its separate transaction signer.
"""

import secrets
from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from pydantic import Field, SecretStr, TypeAdapter, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session
from web3 import Web3

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    CandidateRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    FinancialStateRecord,
    SimulationConfigRecord,
    SimulationRecord,
    VerificationRecord,
)
from app.db.postgres import acquire_authority_lock
from app.db.state import read_state
from app.models.contracts import (
    ActionRequest,
    Address,
    ApprovalRequirement,
    CertificatePayload,
    ChainTransaction,
    Contract,
    ErrorCode,
    Identifier,
    PolicyVerdict,
    RuleOutcome,
    SimulationConfig,
    SimulationRun,
    TrustedSimulationInput,
    UInt256,
    VerificationResult,
)
from app.policy.engine import evaluate
from app.policy.service import checked_version
from app.simulation.engine import simulate
from app.simulation.router import check_persisted_audit
from app.verifier.certificates import (
    MAX_LIFETIME,
    public_keys_from_environment,
    sign_certificate,
    verify_integrity,
)


class RuntimeSettings(BaseSettings):
    """Server-only configuration; no defaults grant financial or signing authority."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    verifier_private_key: SecretStr = SecretStr("")
    verifier_key_id: str = ""
    verifier_transaction_config_json: SecretStr = SecretStr("")
    rpc_url: SecretStr = SecretStr("")


class TransactionConfiguration(Contract):
    """Explicit operator ceilings and independently approved demo destination."""

    wallet_address: Address
    token_address: Address
    recipient: Address
    token_decimals: Annotated[int, Field(strict=True, ge=2, le=18)]
    gas_limit: Annotated[int, Field(strict=True, ge=21000, le=1000000)]
    max_fee_per_gas_wei: UInt256
    max_priority_fee_per_gas_wei: UInt256

    @model_validator(mode="after")
    def bounded(self):
        if any(
            a == "0x" + "0" * 40 for a in (self.wallet_address, self.token_address, self.recipient)
        ):
            raise ValueError("Zero address is not approved")
        if not 0 < int(self.max_fee_per_gas_wei) < 2**256 or not 0 <= int(
            self.max_priority_fee_per_gas_wei
        ) <= int(self.max_fee_per_gas_wei):
            raise ValueError("Invalid fee ceilings")
        return self


def signing_configuration(settings, *, public_keys=None):
    try:
        key_id = checked_key_id(settings.verifier_key_id)
        encoded = settings.verifier_private_key.get_secret_value()
        # Exact 32-byte hex seed, not PEM, a chain private key, or an implicit test key.
        if len(encoded) != 64 or any(c not in "0123456789abcdef" for c in encoded):
            raise ValueError("Invalid Ed25519 seed")
        key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(encoded))
        keys = public_keys_from_environment() if public_keys is None else public_keys
        public = key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        if (
            key_id not in keys
            or keys[key_id].public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
            != public
        ):
            raise ValueError("Signing key does not match trusted public keyring")
        return key, key_id, keys
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Verifier signing configuration unavailable"
        ) from None


def checked_key_id(value):
    # Reuse canonical validation without adding any public model or contract.
    return TypeAdapter(Identifier).validate_python(value)


def chain_transaction(action, settings):
    try:
        config = TransactionConfiguration.model_validate_json(
            settings.verifier_transaction_config_json.get_secret_value()
        )
        url = settings.rpc_url.get_secret_value()
        if not url.startswith(("https://", "http://")):
            raise ValueError("HTTP RPC URL required")
    except Exception:
        raise DomainError(
            ErrorCode.CHAIN_NOT_CONFIGURED, "Trusted transaction configuration unavailable"
        ) from None
    if (action.chain_id, action.token_address, action.recipient) != (
        84532,
        config.token_address,
        config.recipient,
    ):
        raise DomainError(
            ErrorCode.POLICY_DENIED, "Action outside operational testnet allowlist", 403
        )
    try:
        web3 = Web3(
            Web3.HTTPProvider(
                url, request_kwargs={"timeout": 5}, exception_retry_configuration=None
            )
        )
        eth = web3.eth
        if eth.chain_id != 84532:
            raise ValueError("Wrong RPC chain")
        wallet = Web3.to_checksum_address(config.wallet_address)
        token = Web3.to_checksum_address(config.token_address)
        if not eth.get_code(token):
            raise ValueError("Token has no code")
        decimals_raw = eth.call({"to": token, "data": "0x313ce567"})
        balance_raw = eth.call(
            {"to": token, "data": "0x70a08231" + config.wallet_address[2:].rjust(64, "0")}
        )
        if len(decimals_raw) != 32 or len(balance_raw) != 32:
            raise ValueError("Malformed ERC20 response")
        if int.from_bytes(decimals_raw, "big") != config.token_decimals:
            raise ValueError("Token decimals changed")
        amount = action.amount_minor * 10 ** (config.token_decimals - 2)
        if int.from_bytes(balance_raw, "big") < amount:
            raise ValueError("Insufficient token balance")
        nonce = eth.get_transaction_count(wallet, "pending")
        transaction = ChainTransaction(
            chain_id=84532,
            sender=config.wallet_address,
            to=config.token_address,
            token_address=config.token_address,
            recipient=config.recipient,
            token_decimals=config.token_decimals,
            amount_base_units=str(amount),
            data="0xa9059cbb" + config.recipient[2:].rjust(64, "0") + f"{amount:064x}",
            nonce=nonce,
            gas_limit=config.gas_limit,
            max_fee_per_gas_wei=config.max_fee_per_gas_wei,
            max_priority_fee_per_gas_wei=config.max_priority_fee_per_gas_wei,
            intention="test allocation to an approved demo destination",
        )
        ceiling = int(config.max_fee_per_gas_wei)
        if eth.get_balance(wallet, "pending") < config.gas_limit * ceiling:
            raise ValueError("Insufficient gas balance")
        base_fee = eth.get_block("latest")["baseFeePerGas"]
        if (
            type(base_fee) is not int
            or base_fee < 0
            or base_fee + int(config.max_priority_fee_per_gas_wei) > ceiling
        ):
            raise ValueError("Fee ceiling below current base fee and priority cap")
        gas = eth.estimate_gas(
            {
                "from": wallet,
                "to": token,
                "value": 0,
                "data": transaction.data,
                "maxFeePerGas": ceiling,
                "maxPriorityFeePerGas": int(config.max_priority_fee_per_gas_wei),
            },
            "pending",
        )
        if type(gas) is not int or not 0 < gas <= config.gas_limit:
            raise ValueError("Gas estimate exceeds configured ceiling")
        # A second network read catches a changed endpoint during the observation.
        if eth.chain_id != 84532:
            raise ValueError("RPC chain changed")
        return transaction
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Independent testnet transaction checks failed"
        ) from None


def recompute(trusted):
    """Production risk recheck seam usable by a future independent executor."""
    simulation = simulate(trusted)
    verdict = evaluate(trusted, simulation)
    names = sorted(s.name for s in simulation.stress_results)
    if names != ["emergency_expense", "fee_shock", "income_delay", "market_shock"]:
        raise ValueError("Incomplete named stress evidence")
    failed = [s.name for s in simulation.stress_results if not s.passed or not s.goal_funded]
    check = RuleOutcome(
        rule="named_stresses",
        status="FAIL" if failed else "PASS",
        reason_code="NAMED_STRESS_FAILED" if failed else "NAMED_STRESSES_PASSED",
        measured={"failed_stresses": ",".join(failed)},
    )
    verdict = PolicyVerdict(
        decision="DENY" if failed else verdict.decision, checks=[*verdict.checks, check]
    )
    return verdict, simulation


def load_trusted(session, action, actor_id):
    state = read_state(session, actor_id)
    row = session.get(FinancialStateRecord, state.id)
    if (row.user_id, row.version, state.snapshot.user_id) != (
        actor_id,
        state.snapshot.version,
        actor_id,
    ):
        raise ValueError("State metadata mismatch")
    if state.active_constitution_version is None:
        raise DomainError(ErrorCode.UNAVAILABLE, "Confirmed Constitution required")
    policy = checked_version(
        session.get(ConstitutionVersionRecord, state.active_constitution_version), actor_id
    )
    rows = list(session.scalars(select(SimulationConfigRecord).limit(2)))
    if len(rows) != 1:
        raise DomainError(
            ErrorCode.UNAVAILABLE,
            "Exactly one explicitly selected trusted simulation configuration required",
        )
    config = SimulationConfig.model_validate(rows[0].payload)
    if config.id != rows[0].id or digest(config) != rows[0].config_digest:
        raise ValueError("Config binding failed")
    return TrustedSimulationInput(state=state, constitution=policy, action=action, config=config)


def persist_simulation(session, trusted, simulation, actor_id):
    action = trusted.action
    candidate = session.get(CandidateRecord, action.id)
    if candidate is not None and (
        candidate.state_id != trusted.state.id
        or candidate.action_digest != digest(action)
        or candidate.payload != action.model_dump(mode="json")
    ):
        raise DomainError(
            ErrorCode.CONFLICT, "Candidate ID already binds different authority or action", 409
        )
    identifier = "sim-" + digest(trusted)
    existing = session.get(SimulationRecord, identifier)
    if existing is not None:
        stored = SimulationRun.model_validate(existing.payload)
        if (
            candidate is None
            or (existing.action_id, existing.state_id, existing.config_id, stored.id)
            != (action.id, trusted.state.id, trusted.config.id, identifier)
            or stored.model_dump(exclude={"id", "created_at"})
            != simulation.model_dump(exclude={"id", "created_at"})
        ):
            raise ValueError("Stored simulation integrity failed")
        check_persisted_audit(session, stored, actor_id)
        return stored
    if candidate is None:
        session.add(
            CandidateRecord(
                id=action.id,
                state_id=trusted.state.id,
                action_digest=digest(action),
                payload=action.model_dump(mode="json"),
            )
        )
        session.flush()
    result = simulation.model_copy(update={"id": identifier})
    session.add(
        SimulationRecord(
            id=result.id,
            action_id=action.id,
            state_id=trusted.state.id,
            config_id=trusted.config.id,
            payload=result.model_dump(mode="json"),
        )
    )
    session.flush()
    append_event(
        session,
        actor=actor_id,
        event_type="SIMULATION_COMPLETED",
        artifact_digest=digest(result),
        now=result.created_at,
        details={
            "simulation_id": result.id,
            "action_id": action.id,
            "config_digest": result.config_digest,
            "policy_digest": trusted.constitution.policy_digest,
        },
    )
    # Validate the entire existing chain, not just the last event, before issuing.
    check_persisted_audit(session, result, actor_id)
    return result


def verify_action(engine, body: ActionRequest, actor_id: str, *, runtime=None):
    body = ActionRequest.model_validate_json(body.model_dump_json())
    if engine.dialect.name not in ("sqlite", "postgresql"):
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Trusted issuance requires reviewed SQLite or PostgreSQL storage"
        )
    with Session(engine) as session, session.begin():
        acquire_authority_lock(session)
        try:
            trusted = load_trusted(session, body.action, actor_id)
            verdict, simulated = recompute(trusted)
            simulation = persist_simulation(session, trusted, simulated, actor_id)
            certificate = None
            if verdict.decision != "DENY":
                settings = RuntimeSettings() if runtime is None else runtime.settings
                key, key_id, keys = (
                    signing_configuration(settings)
                    if runtime is None
                    else signing_configuration(settings, public_keys=runtime.public_keys())
                )
                transaction = chain_transaction(body.action, settings)
                now = datetime.now(UTC)
                certificate = sign_certificate(
                    CertificatePayload(
                        id="cert-" + str(uuid4()),
                        action=body.action,
                        action_digest=digest(body.action),
                        transaction=transaction,
                        state_version=trusted.state.snapshot.version,
                        state_snapshot_hash=trusted.state.snapshot_hash,
                        constitution_version=trusted.constitution.id,
                        policy_digest=trusted.constitution.policy_digest,
                        verdict=verdict,
                        simulation=simulation,
                        approval=ApprovalRequirement(
                            required=verdict.decision == "REQUIRES_APPROVAL",
                            reasons=[
                                c.reason_code
                                for c in verdict.checks
                                if c.status == "REQUIRES_APPROVAL"
                            ],
                        ),
                        issued_at=now,
                        expires_at=now + MAX_LIFETIME,
                        nonce=secrets.token_hex(32),
                    ),
                    key,
                    key_id,
                )
                if verify_integrity(certificate, keys, now=datetime.now(UTC)).status != "VALID":
                    raise ValueError("Issuance integrity/time check failed")
            result = VerificationResult(
                id="verify-" + str(uuid4()),
                action_id=body.action.id,
                verdict=verdict,
                simulation_id=simulation.id,
                certificate_id=certificate.payload.id if certificate else None,
                reasons=[c.reason_code for c in verdict.checks if c.status != "PASS"],
            )
            session.add(
                VerificationRecord(
                    id=result.id,
                    action_id=body.action.id,
                    simulation_id=simulation.id,
                    constitution_id=trusted.constitution.id,
                    payload=result.model_dump(mode="json"),
                )
            )
            session.flush()
            append_event(
                session,
                actor=actor_id,
                event_type="ACTION_REJECTED" if certificate is None else "ACTION_VERIFIED",
                artifact_digest=digest(result),
                now=datetime.now(UTC),
                details={
                    "verification_id": result.id,
                    "action_id": body.action.id,
                    "simulation_id": simulation.id,
                },
            )
            if certificate is not None:
                p = certificate.payload
                session.add(
                    CertificateRecord(
                        id=p.id,
                        action_id=body.action.id,
                        state_id=trusted.state.id,
                        constitution_id=trusted.constitution.id,
                        verification_id=result.id,
                        nonce=p.nonce,
                        certificate_hash=certificate.certificate_hash,
                        payload=certificate.model_dump(mode="json"),
                    )
                )
                session.flush()
                append_event(
                    session,
                    actor=actor_id,
                    event_type="CERTIFICATE_ISSUED",
                    artifact_digest=certificate.certificate_hash,
                    now=p.issued_at,
                    details={
                        "certificate_id": p.id,
                        "verification_id": result.id,
                        "action_id": body.action.id,
                    },
                )
            return result
        except DomainError:
            raise
        except Exception:
            # Database/RPC/crypto exception messages can contain keys, URLs or SQL parameters.
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Trusted verification unavailable; no authorization granted"
            ) from None
