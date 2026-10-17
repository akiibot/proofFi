from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Record:
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class User(Record, Base):
    __tablename__ = "users"
    display_name: Mapped[str] = mapped_column(String(100))


class FinancialStateRecord(Record, Base):
    __tablename__ = "financial_states"
    __table_args__ = (UniqueConstraint("user_id", "version"), CheckConstraint("version > 0"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer)
    snapshot_hash: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class UserHead(Base):
    """CAS pointers; advance in same transaction as an immutable snapshot/version."""

    __tablename__ = "user_heads"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    state_id: Mapped[str] = mapped_column(ForeignKey("financial_states.id"))
    constitution_id: Mapped[str | None] = mapped_column(ForeignKey("constitution_versions.id"))


class ConstitutionDraftRecord(Record, Base):
    __tablename__ = "constitution_drafts"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    base_version: Mapped[str | None] = mapped_column(
        ForeignKey("constitution_versions.id", use_alter=True, name="fk_draft_base_version")
    )
    payload: Mapped[dict] = mapped_column(JSON)


class ConstitutionVersionRecord(Record, Base):
    __tablename__ = "constitution_versions"
    __table_args__ = (UniqueConstraint("user_id", "version"), CheckConstraint("version > 0"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    draft_id: Mapped[str] = mapped_column(ForeignKey("constitution_drafts.id"), unique=True)
    version: Mapped[int] = mapped_column(Integer)
    policy_digest: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)


class CandidateRecord(Record, Base):
    __tablename__ = "candidates"
    state_id: Mapped[str] = mapped_column(ForeignKey("financial_states.id"))
    action_digest: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)


class SimulationConfigRecord(Record, Base):
    __tablename__ = "simulation_configs"
    config_digest: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class SimulationRecord(Record, Base):
    __tablename__ = "simulation_runs"
    action_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"))
    state_id: Mapped[str] = mapped_column(ForeignKey("financial_states.id"))
    config_id: Mapped[str] = mapped_column(ForeignKey("simulation_configs.id"))
    payload: Mapped[dict] = mapped_column(JSON)


class VerificationRecord(Record, Base):
    __tablename__ = "verifications"
    action_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"))
    simulation_id: Mapped[str | None] = mapped_column(ForeignKey("simulation_runs.id"))
    constitution_id: Mapped[str] = mapped_column(
        ForeignKey("constitution_versions.id", use_alter=True, name="fk_draft_base_version")
    )
    payload: Mapped[dict] = mapped_column(JSON)


class CertificateRecord(Record, Base):
    __tablename__ = "certificates"
    action_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"))
    state_id: Mapped[str] = mapped_column(ForeignKey("financial_states.id"))
    constitution_id: Mapped[str] = mapped_column(ForeignKey("constitution_versions.id"))
    verification_id: Mapped[str] = mapped_column(ForeignKey("verifications.id"), unique=True)
    nonce: Mapped[str] = mapped_column(String(64), unique=True)
    certificate_hash: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class ApprovalRecord(Record, Base):
    __tablename__ = "approvals"
    certificate_id: Mapped[str] = mapped_column(ForeignKey("certificates.id"), unique=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    payload: Mapped[dict] = mapped_column(JSON)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExecutionRecord(Record, Base):
    __tablename__ = "executions"
    __table_args__ = (
        CheckConstraint("status IN ('CLAIMED','PENDING','CONFIRMED','FAILED','REORGED')"),
    )
    certificate_id: Mapped[str] = mapped_column(ForeignKey("certificates.id"), unique=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True)
    status: Mapped[str] = mapped_column(String(30))
    tx_hash: Mapped[str | None] = mapped_column(String(66), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class AuditRecord(Record, Base):
    __tablename__ = "audit_events"
    sequence: Mapped[int] = mapped_column(Integer, unique=True)
    previous_hash: Mapped[str | None] = mapped_column(String(64))
    event_hash: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)


class ExecutionEnvelopeRecord(Record, Base):
    """Private immutable bytes, not broadcast/receipt or signing authority.

    PF-015 must independently bind raw bytes/hash/certificate before insertion
    and every use. SQL constraints enforce storage shape, not cryptography.
    SQLite migration triggers prohibit replacing or deleting an envelope.
    """

    __tablename__ = "execution_envelopes"
    __table_args__ = (
        CheckConstraint(
            "typeof(raw_transaction) = 'blob' AND length(raw_transaction) BETWEEN 1 AND 4096",
            name="ck_envelope_byte_bound",
        ),
        CheckConstraint(
            "length(transaction_hash) = 66 AND substr(transaction_hash, 1, 2) = '0x' "
            "AND substr(transaction_hash, 3) NOT GLOB '*[^0-9a-f]*'",
            name="ck_envelope_hash_shape",
        ),
    )
    execution_id: Mapped[str] = mapped_column(ForeignKey("executions.id"), unique=True)
    raw_transaction: Mapped[bytes] = mapped_column(LargeBinary)
    transaction_hash: Mapped[str] = mapped_column(String(66), unique=True)
