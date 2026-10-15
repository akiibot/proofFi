"""Canonical v1 contracts. Changes require a lead-reviewed contract-change PR."""

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    SecretStr,
    StringConstraints,
    model_validator,
)

Minor = Annotated[int, Field(strict=True, ge=0, le=9_000_000_000_000)]
PositiveMinor = Annotated[int, Field(strict=True, gt=0, le=9_000_000_000_000)]
Bps = Annotated[int, Field(strict=True, ge=0, le=10000)]
Address = Annotated[str, StringConstraints(pattern=r"^0x[0-9a-f]{40}$")]
Digest = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
UInt256 = Annotated[str, StringConstraints(pattern=r"^(0|[1-9][0-9]{0,77})$")]
Identifier = Annotated[str, StringConstraints(min_length=1, max_length=100)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ErrorCode(StrEnum):
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    UNAVAILABLE = "UNAVAILABLE"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    RATE_LIMITED = "RATE_LIMITED"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    STATE_NOT_INITIALIZED = "STATE_NOT_INITIALIZED"
    INVALID_CERTIFICATE = "INVALID_CERTIFICATE"
    STALE_STATE = "STALE_STATE"
    STALE_POLICY = "STALE_POLICY"
    EXPIRED = "EXPIRED"
    ALREADY_USED = "ALREADY_USED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    CHAIN_NOT_CONFIGURED = "CHAIN_NOT_CONFIGURED"
    NO_SAFE_ACTION = "NO_SAFE_ACTION"
    NON_MONOTONIC_FEASIBILITY = "NON_MONOTONIC_FEASIBILITY"
    POLICY_DENIED = "POLICY_DENIED"
    CONFLICT = "CONFLICT"


class ApiError(Contract):
    code: ErrorCode
    message: str
    reasons: list[str] = []


class Health(Contract):
    status: Literal["ok"]
    contract_version: Literal["1.1.0"] = "1.1.0"
    database: Literal["ready"] = "ready"


class AssetBalance(Contract):
    id: Identifier
    asset: str
    amount_minor: Minor
    liquid: bool
    high_risk: bool
    source: Literal["synthetic"] = "synthetic"


class Obligation(Contract):
    id: Identifier
    name: str
    amount_minor: PositiveMinor
    due_day: Annotated[int, Field(strict=True, ge=1, le=366)]
    protected: bool


class RecurringExpense(Contract):
    id: Identifier
    name: str
    amount_minor: PositiveMinor
    due_days: list[Annotated[int, Field(strict=True, ge=1, le=366)]]


class ExpectedIncome(Contract):
    id: Identifier
    name: str
    amount_minor: PositiveMinor
    due_day: Annotated[int, Field(strict=True, ge=1, le=366)]
    assumption: Literal[True] = True


class Goal(Contract):
    id: Identifier
    text: str
    objective: Literal["maximize_investment_subject_to_policies"]
    obligation_id: Identifier


class StateSnapshot(Contract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    user_id: Identifier
    version: Annotated[int, Field(strict=True, ge=1)]
    as_of: AwareDatetime
    assets: list[AssetBalance]
    obligations: list[Obligation]
    recurring_expenses: list[RecurringExpense]
    expected_income: list[ExpectedIncome]
    goal: Goal
    realized_expense_minor: Minor = 0
    assumptions: list[str]


class FinancialState(Contract):
    id: Identifier
    snapshot: StateSnapshot
    snapshot_hash: Digest
    active_constitution_version: Identifier | None


class ConstitutionRules(Contract):
    tuition_reserve_minor: Minor = 700000
    emergency_floor_minor: Minor = 200000
    autonomy_limit_minor: Minor = 15000
    new_recipient_requires_approval: Literal[True] = True
    allowed_chain_id: Literal[84532] = 84532
    allowed_tokens: list[Address]
    known_recipients: list[Address]
    blocked_recipients: list[Address] = []
    high_risk_concentration_bps: Bps = 2500
    goal_satisfaction_min_bps: Bps = 9500
    reserve_breach_max_bps: Bps = 500
    borrowed_funding_forbidden: Literal[True] = True

    @model_validator(mode="after")
    def disjoint_recipients(self):
        if set(self.known_recipients) & set(self.blocked_recipients):
            raise ValueError("A blocked recipient cannot also be known")
        return self


class ConstitutionDraft(Contract):
    id: Identifier
    user_id: Identifier
    rules: ConstitutionRules
    base_version: Identifier | None
    created_at: AwareDatetime


class ConstitutionVersion(Contract):
    id: Identifier
    user_id: Identifier
    version: Annotated[int, Field(strict=True, ge=1)]
    rules: ConstitutionRules
    policy_digest: Digest
    confirmed_at: AwareDatetime
    confirmed_by: Identifier


class CandidateAction(Contract):
    id: Identifier
    action_type: Literal["TEST_TOKEN_ALLOCATION", "TRANSFER"]
    amount_minor: PositiveMinor
    chain_id: Literal[84532]
    token_address: Address
    recipient: Address
    funding_source: Literal["owned", "borrowed"]
    planner_reason_untrusted: Annotated[str, StringConstraints(max_length=2000)]
    planner_mode: Literal["live_llm", "deterministic_demo", "attack_fixture"]


class ChainTransaction(Contract):
    chain_id: Literal[84532]
    sender: Address
    to: Address
    token_address: Address
    recipient: Address
    token_decimals: Annotated[int, Field(strict=True, ge=2, le=18)]
    amount_base_units: UInt256
    value_wei: Literal["0"] = "0"
    data: Annotated[str, StringConstraints(pattern=r"^0xa9059cbb[0-9a-f]{128}$")]
    nonce: Annotated[int, Field(strict=True, ge=0)]
    gas_limit: Annotated[int, Field(strict=True, gt=0)]
    max_fee_per_gas_wei: UInt256
    max_priority_fee_per_gas_wei: UInt256
    intention: Literal["test allocation to an approved demo destination"]

    @model_validator(mode="after")
    def exact_transfer(self):
        amount = int(self.amount_base_units)
        if not 0 < amount < 2**256:
            raise ValueError("Invalid uint256 amount")
        if self.to != self.token_address:
            raise ValueError("ERC20 transaction target must be token contract")
        expected = "0xa9059cbb" + self.recipient[2:].rjust(64, "0") + f"{amount:064x}"
        if self.data != expected:
            raise ValueError("Calldata must encode the exact recipient and amount")
        for field in (self.max_fee_per_gas_wei, self.max_priority_fee_per_gas_wei):
            if int(field) >= 2**256:
                raise ValueError("Fee outside uint256")
        if int(self.max_priority_fee_per_gas_wei) > int(self.max_fee_per_gas_wei):
            raise ValueError("Priority fee exceeds maximum fee")
        return self


class SimulationConfig(Contract):
    id: Identifier
    model_version: Identifier
    seed: Annotated[int, Field(strict=True, ge=0, le=2**32 - 1)] = 18421
    path_count: Annotated[int, Field(strict=True, ge=100, le=100000)] = 1000
    horizon_days: Annotated[int, Field(strict=True, ge=1, le=366)] = 120
    daily_volatility_bps: Bps
    income_delay_probability_bps: Bps
    emergency_probability_bps: Bps
    emergency_expense_minor: Minor = 200000
    fee_minor: Minor
    model_assumptions: list[str]


class RuleOutcome(Contract):
    rule: Identifier
    status: Literal["PASS", "FAIL", "REQUIRES_APPROVAL"]
    reason_code: Identifier
    measured: dict[str, int | str | bool]


class PolicyVerdict(Contract):
    decision: Literal["PASS", "DENY", "REQUIRES_APPROVAL"]
    checks: list[RuleOutcome]


class StressResult(Contract):
    name: Literal["market_shock", "income_delay", "emergency_expense", "fee_shock"]
    parameters: dict[str, int | str]
    passed: bool
    minimum_liquidity_minor: int
    goal_funded: bool


class SimulationMetrics(Contract):
    goal_satisfaction_probability_bps: Bps
    reserve_breach_probability_bps: Bps
    p05_terminal_liquidity_minor: Annotated[int, Field(strict=True)]
    expected_terminal_value_minor: Annotated[int, Field(strict=True)]


class TrustedSimulationInput(Contract):
    state: FinancialState
    constitution: ConstitutionVersion
    action: CandidateAction
    config: SimulationConfig


class SimulationRun(Contract):
    id: Identifier
    action_id: Identifier
    state_snapshot_hash: Digest
    config: SimulationConfig
    config_digest: Digest
    metrics: SimulationMetrics
    stress_results: list[StressResult]
    sampled_liquidity_paths_minor: list[list[int]]
    created_at: AwareDatetime


class ApprovalRequirement(Contract):
    required: bool
    reasons: list[str]


class CertificatePayload(Contract):
    schema_version: Literal["1.0.0"] = "1.0.0"
    id: Identifier
    action: CandidateAction
    action_digest: Digest
    transaction: ChainTransaction
    state_version: Annotated[int, Field(strict=True, ge=1)]
    state_snapshot_hash: Digest
    constitution_version: Identifier
    policy_digest: Digest
    verdict: PolicyVerdict
    simulation: SimulationRun
    approval: ApprovalRequirement
    issued_at: AwareDatetime
    expires_at: AwareDatetime
    nonce: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]

    @model_validator(mode="after")
    def consistent_authorization(self):
        if self.expires_at <= self.issued_at:
            raise ValueError("Expiry must follow issuance")
        if self.verdict.decision == "DENY" or any(x.status == "FAIL" for x in self.verdict.checks):
            raise ValueError("Denied actions cannot be certified")
        if (
            self.verdict.decision == "REQUIRES_APPROVAL"
            or any(x.status == "REQUIRES_APPROVAL" for x in self.verdict.checks)
        ) and not self.approval.required:
            raise ValueError("Approval requirement cannot be removed")
        a, t = self.action, self.transaction
        if (a.chain_id, a.token_address, a.recipient) != (t.chain_id, t.token_address, t.recipient):
            raise ValueError("Candidate and transaction mismatch")
        if a.amount_minor * 10 ** (t.token_decimals - 2) != int(t.amount_base_units):
            raise ValueError("Synthetic cents must map exactly to token base units")
        if (
            self.simulation.action_id != a.id
            or self.simulation.state_snapshot_hash != self.state_snapshot_hash
        ):
            raise ValueError("Simulation binding mismatch")
        return self


class ActionCertificate(Contract):
    payload: CertificatePayload
    certificate_hash: Digest
    verifier_signature: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{128}$")]
    key_id: Identifier


class Approval(Contract):
    id: Identifier
    certificate_id: Identifier
    action_digest: Digest
    state_version: int
    constitution_version: Identifier
    actor_id: Identifier
    decision: Literal["APPROVE", "DENY"]
    created_at: AwareDatetime
    consumed_at: AwareDatetime | None


class Execution(Contract):
    id: Identifier
    certificate_id: Identifier
    status: Literal["CLAIMED", "PENDING", "CONFIRMED", "FAILED", "REORGED"]
    tx_hash: Annotated[str, StringConstraints(pattern=r"^0x[0-9a-f]{64}$")] | None
    block_number: int | None
    confirmations: int
    error: ApiError | None


class AuditEvent(Contract):
    id: Identifier
    sequence: int
    created_at: AwareDatetime
    event_type: str
    actor: str
    artifact_digest: Digest | None
    details: dict[str, str | int | bool]
    previous_hash: Digest | None
    event_hash: Digest


class IntentRequest(Contract):
    goal: Annotated[str, StringConstraints(min_length=1, max_length=2000)]


class ParsedIntent(Contract):
    objective: Literal["maximize_investment_subject_to_policies"]
    obligation_id: Identifier | None
    ambiguities: list[str]


class PlanResponse(Contract):
    mode: Literal["live_llm", "deterministic_demo"]
    candidates: list[CandidateAction]
    clarification: list[str]


class ActionRequest(Contract):
    action: CandidateAction


class VerificationResult(Contract):
    id: Identifier
    action_id: Identifier
    verdict: PolicyVerdict
    simulation_id: Identifier | None
    certificate_id: Identifier | None
    reasons: list[str]


class ApprovalRequest(Contract):
    certificate_id: Identifier
    action_digest: Digest
    decision: Literal["APPROVE", "DENY"]


class ExecuteRequest(Contract):
    certificate_id: Identifier
    action_digest: Digest
    idempotency_key: Annotated[str, StringConstraints(min_length=16, max_length=100)]


class CertificateStatus(Contract):
    certificate_id: Identifier
    status: Literal[
        "VALID", "SIGNED_BUT_STALE", "TAMPERED", "EXPIRED", "ALREADY_USED", "APPROVAL_REQUIRED"
    ]
    signature_valid: bool
    reasons: list[str]


class DraftRequest(Contract):
    rules: ConstitutionRules
    base_version: Identifier | None


class ConfirmRequest(Contract):
    draft_id: Identifier
    expected_policy_digest: Digest
    confirmed: Literal[True]


class OptimizerResult(Contract):
    status: Literal["SAFE_ACTION", "NO_SAFE_ACTION", "NON_MONOTONIC_FEASIBILITY"]
    action: CandidateAction | None
    max_amount_minor: Minor
    precision_minor: Literal[1] = 1
    verifier_calls: int
    limiting_checks: list[str]
    next_cent_rejected: bool


class WorkflowResult(Contract):
    plan: PlanResponse
    optimization: OptimizerResult
    verification: VerificationResult | None


class EmergencyRequest(Contract):
    expected_state_version: Annotated[int, Field(strict=True, ge=1)]
    amount_minor: Literal[200000] = 200000


class EmergencyResponse(Contract):
    state: FinancialState
    optimization: OptimizerResult


class AttackResponse(Contract):
    candidate: CandidateAction
    verification: VerificationResult
    execution_error: ApiError
    signer_called: Literal[False]
    tx_hash: None = None


class ChainStatus(Contract):
    chain_id: Literal[84532] = 84532
    status: Literal["CHAIN_NOT_CONFIGURED", "UNAVAILABLE", "READY"]
    reason: str
    wallet_address: Address | None = None
    token_balance_base_units: UInt256 | None = None
    native_balance_wei: UInt256 | None = None


class LoginRequest(Contract):
    password: Annotated[SecretStr, Field(min_length=12, max_length=200)]


class SessionInfo(Contract):
    user_id: Literal["demo-user"] = "demo-user"
    csrf_token: Annotated[str, StringConstraints(min_length=32, max_length=100)]
    expires_at: AwareDatetime


class LogoutResult(Contract):
    logged_out: Literal[True] = True
