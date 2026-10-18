"""PG storage/locking evidence only. No signer, broadcast or live financial action."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from alembic import command
from alembic.config import Config
from app.core.errors import DomainError
from app.db import models
from app.db.postgres import AUTHORITY_LOCK, acquire_authority_lock, make_postgres_engine
from app.db.seed import seed
from app.db.state import append_state, read_state
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError


@pytest.fixture
def seeded(pg_database):
    with pg_database[2].begin() as session:
        acquire_authority_lock(session)
        assert seed(session)
    return pg_database


@pytest.fixture
def storage_claim(seeded):
    # FK-complete storage fixture, deliberately not a verified certificate/claim.
    # Existing trusted runtime consumers are not enabled by this contract PR.
    with seeded[2].begin() as session:
        for row in (
            models.ConstitutionVersionRecord(
                id="version-test",
                user_id="demo-user",
                draft_id="draft-initial",
                version=1,
                policy_digest="a" * 64,
                payload={},
            ),
            models.CandidateRecord(
                id="candidate-test", state_id="state-v1", action_digest="b" * 64, payload={}
            ),
            models.VerificationRecord(
                id="verification-test",
                action_id="candidate-test",
                constitution_id="version-test",
                payload={},
            ),
            models.CertificateRecord(
                id="certificate-test",
                action_id="candidate-test",
                state_id="state-v1",
                constitution_id="version-test",
                verification_id="verification-test",
                nonce="test-nonce",
                certificate_hash="c" * 64,
                payload={},
            ),
            models.ExecutionRecord(
                id="claim-test",
                certificate_id="certificate-test",
                idempotency_key="test-idempotency",
                status="CLAIMED",
                payload={"isolated_storage_fixture": True},
            ),
        ):
            session.add(row)
            session.flush()
    return seeded


def envelope(**changes):
    return models.ExecutionEnvelopeRecord(
        **(
            {
                "id": "envelope-test",
                "execution_id": "claim-test",
                "raw_transaction": b"isolated-opaque-storage-fixture",
                "transaction_hash": "0x" + "a" * 64,
            }
            | changes
        )
    )


def test_migrations_match_metadata_and_enforce_every_foreign_key(pg_database):
    command.check(Config("alembic-postgres.ini"))
    inspector = inspect(pg_database[1])
    for table in models.Base.metadata.tables.values():
        actual = {tuple(fk["constrained_columns"]) for fk in inspector.get_foreign_keys(table.name)}
        expected = {
            tuple(column.name for column in fk.columns) for fk in table.foreign_key_constraints
        }
        assert actual == expected, table.name
    constraints = {c["name"] for c in inspector.get_check_constraints("execution_envelopes")}
    assert constraints == {"ck_envelope_byte_bound_pg", "ck_envelope_hash_shape_pg"}


def test_seed_preserves_canonical_baseline_and_requires_no_policy_activation(seeded):
    with seeded[2].begin() as session:
        acquire_authority_lock(session)
        assert not seed(session)
        state = read_state(session)
        assert (
            state.snapshot_hash
            == "d216bc91f14d575b5686d73d4a9c41bc6f5f66115123c99fd5b57dd78e0da559"
        )
        assert state.snapshot.version == 1 and state.active_constitution_version is None
        assert session.scalar(select(func.count()).select_from(models.AuditRecord)) == 0


@pytest.mark.parametrize("role", ["anon", "authenticated", "service_role"])
def test_supabase_api_roles_cannot_read_private_tables_or_bytes(pg_database, role):
    with pytest.raises(DBAPIError), pg_database[1].begin() as connection:
        connection.exec_driver_sql(f'SET LOCAL ROLE "{role}"')
        connection.exec_driver_sql(
            "SELECT raw_transaction FROM prooffi_private.execution_envelopes"
        )
    with pg_database[1].connect() as connection:
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM pg_class c JOIN pg_namespace n "
                    "ON c.relnamespace=n.oid WHERE n.nspname='prooffi_private' "
                    "AND c.relkind='r' AND c.relname <> 'alembic_version' AND NOT c.relrowsecurity"
                )
            )
            == 0
        )


@pytest.mark.parametrize("size", [1, 4096])
def test_journal_bytes_survive_connection_restart_without_changing_claim(storage_claim, size):
    url, engine, factory = storage_claim
    raw = bytes(i % 256 for i in range(size))
    with factory.begin() as session:
        before = session.get(models.ExecutionRecord, "claim-test").payload
        session.add(envelope(raw_transaction=raw))
    engine.dispose()
    fresh = make_postgres_engine(url)
    try:
        with fresh.connect() as connection:
            assert connection.scalar(select(models.ExecutionEnvelopeRecord.raw_transaction)) == raw
            assert connection.scalar(select(models.ExecutionRecord.payload)) == before
    finally:
        fresh.dispose()


@pytest.mark.parametrize(
    "changes",
    [
        {"raw_transaction": b""},
        {"raw_transaction": b"x" * 4097},
        {"transaction_hash": "0x" + "A" * 64},
        {"transaction_hash": "0x" + "g" * 64},
        {"transaction_hash": "0x" + "a" * 63},
        {"execution_id": "missing-claim"},
    ],
)
def test_journal_constraints_are_enforced_by_actual_database(storage_claim, changes):
    with pytest.raises(IntegrityError), storage_claim[2].begin() as session:
        session.add(envelope(**changes))


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE execution_envelopes SET raw_transaction=decode('01','hex')",
        "DELETE FROM execution_envelopes",
        "TRUNCATE execution_envelopes",
        "INSERT INTO execution_envelopes (id,created_at,execution_id,raw_transaction,transaction_hash) "
        "SELECT id,created_at,execution_id,decode('01','hex'),transaction_hash FROM execution_envelopes "
        "ON CONFLICT (execution_id) DO UPDATE SET raw_transaction=EXCLUDED.raw_transaction",
    ],
)
def test_sql_cannot_replace_delete_truncate_or_upsert_signed_bytes(storage_claim, statement):
    with storage_claim[2].begin() as session:
        session.add(envelope())
    with pytest.raises(IntegrityError), storage_claim[1].begin() as connection:
        connection.execute(text(statement))
    with storage_claim[2]() as session:
        assert (
            session.scalar(select(models.ExecutionEnvelopeRecord.raw_transaction))
            == envelope().raw_transaction
        )


def test_journal_uniqueness_cannot_replace_previous_binding(storage_claim):
    with storage_claim[2].begin() as session:
        session.add(envelope())
    with pytest.raises(IntegrityError), storage_claim[2].begin() as session:
        session.add(envelope(id="second-envelope", transaction_hash="0x" + "b" * 64))


def second_certificate(session):
    session.add(
        models.VerificationRecord(
            id="verification-second",
            action_id="candidate-test",
            constitution_id="version-test",
            payload={},
        )
    )
    session.flush()
    session.add(
        models.CertificateRecord(
            id="certificate-second",
            action_id="candidate-test",
            state_id="state-v1",
            constitution_id="version-test",
            verification_id="verification-second",
            nonce="second-nonce",
            certificate_hash="d" * 64,
            payload={},
        )
    )
    session.flush()


@pytest.mark.parametrize(
    "field,value",
    [
        ("certificate_id", "certificate-test"),
        ("idempotency_key", "test-idempotency"),
    ],
)
def test_execution_claim_uniqueness_survives_distinct_rows(storage_claim, field, value):
    with storage_claim[2].begin() as session:
        second_certificate(session)
    claim = dict(
        id="claim-second",
        certificate_id="certificate-second",
        idempotency_key="second-idempotency",
        status="CLAIMED",
        payload={},
    )
    claim[field] = value
    with pytest.raises(IntegrityError), storage_claim[2].begin() as session:
        session.add(models.ExecutionRecord(**claim))


def test_same_journal_hash_cannot_bind_two_execution_claims(storage_claim):
    with storage_claim[2].begin() as session:
        second_certificate(session)
        session.add(
            models.ExecutionRecord(
                id="claim-second",
                certificate_id="certificate-second",
                idempotency_key="second-idempotency",
                status="CLAIMED",
                payload={},
            )
        )
        session.flush()
        session.add(envelope())
    with pytest.raises(IntegrityError), storage_claim[2].begin() as session:
        session.add(envelope(id="envelope-second", execution_id="claim-second"))


def test_seeded_downgrade_refuses_even_before_an_execution_exists(seeded):
    with pytest.raises(RuntimeError, match="populated PostgreSQL storage"):
        command.downgrade(Config("alembic-postgres.ini"), "base")
    with seeded[2]() as session:
        assert read_state(session).snapshot.version == 1


def test_empty_downgrade_upgrade_is_reversible(pg_database):
    command.downgrade(Config("alembic-postgres.ini"), "base")
    assert inspect(pg_database[1]).get_table_names() == ["alembic_version"]
    command.upgrade(Config("alembic-postgres.ini"), "head")
    command.check(Config("alembic-postgres.ini"))


def test_populated_downgrade_refuses_and_preserves_signed_bytes(storage_claim):
    with storage_claim[2].begin() as session:
        session.add(envelope())
    with pytest.raises(RuntimeError, match="populated PostgreSQL storage"):
        command.downgrade(Config("alembic-postgres.ini"), "base")
    with storage_claim[2]() as session:
        assert (
            session.scalar(select(models.ExecutionEnvelopeRecord.raw_transaction))
            == envelope().raw_transaction
        )


def test_serialized_writers_observe_fresh_state_and_reject_stale_cas(seeded):
    entered, finished = Event(), Event()

    def loser():
        with seeded[2].begin() as session:
            entered.set()
            acquire_authority_lock(session)
            current = read_state(session)
            assert current.snapshot.version == 2
            try:
                append_state(session, current.snapshot.model_copy(update={"version": 2}), 1)
            finally:
                finished.set()

    with ThreadPoolExecutor(max_workers=1) as pool:
        with seeded[2].begin() as session:
            acquire_authority_lock(session)
            current = read_state(session)
            future = pool.submit(loser)
            assert entered.wait(5)
            assert not finished.wait(0.2)
            updated = current.snapshot.model_copy(deep=True, update={"version": 2})
            append_state(session, updated, 1)
        with pytest.raises(DomainError) as error:
            future.result(timeout=5)
        assert error.value.code.value == "CONFLICT"
    with seeded[2]() as session:
        assert read_state(session).snapshot.version == 2
        assert session.scalar(select(func.count()).select_from(models.FinancialStateRecord)) == 2


def test_crashed_db_connection_rolls_back_and_releases_transaction_lock(seeded):
    engine = seeded[1]
    victim = engine.connect()
    transaction = victim.begin()
    victim.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": AUTHORITY_LOCK})
    pid = victim.scalar(text("SELECT pg_backend_pid()"))
    victim.execute(text("UPDATE users SET display_name='uncommitted'"))
    with engine.connect() as killer:
        assert killer.scalar(text("SELECT pg_terminate_backend(:pid)"), {"pid": pid})
    with pytest.raises(DBAPIError):
        transaction.commit()
    victim.close()
    with seeded[2].begin() as session:
        acquire_authority_lock(session)
        assert session.get(models.User, "demo-user").display_name == "Demo student"


def test_repeatable_read_is_refused_before_authority_reads(pg_database):
    from sqlalchemy.orm import Session

    with (
        pg_database[1].connect().execution_options(isolation_level="REPEATABLE READ") as connection
    ):
        with Session(connection) as session, session.begin():
            with pytest.raises(ValueError, match="READ COMMITTED"):
                acquire_authority_lock(session)


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://test@127.0.0.1/test",
        "postgresql+psycopg://test@remote.example/test?sslmode=require",
        "postgresql+psycopg://test@remote.example:6543/test?sslmode=verify-full",
    ],
)
def test_connection_configuration_refuses_unreviewed_driver_tls_or_pool_mode(url):
    with pytest.raises(ValueError):
        make_postgres_engine(url)
