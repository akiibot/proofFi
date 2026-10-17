"""Private storage contract only; no transaction submission or live evidence."""

import pytest
from alembic import command
from alembic.config import Config
from app.db import models
from app.execution import gate
from app.verifier.service import recompute
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from test_pf_014_signing import issued as issued
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture
def claim(client, issued):
    _, policy, request = issued
    # Real issuance/recomputation and durable claim, without invoking any EVM signer.
    return gate.claim_execution(
        client.app.state.engine, request, "demo-user", policy=policy, recheck=recompute
    )


def envelope(claim, **changes):
    # Opaque isolated storage fixture. This is deliberately NOT a valid signed tx.
    # PF-015 must validate actual EIP-1559 bytes/hash/certificate before storage/use.
    fields = dict(
        id="envelope-test",
        execution_id=claim.id,
        raw_transaction=b"isolated-storage-fixture",
        transaction_hash="0x" + "a" * 64,
    )
    return models.ExecutionEnvelopeRecord(**(fields | changes))


@pytest.mark.parametrize("size", [1, 4096])
def test_migrated_private_storage_round_trip_leaves_public_claim_unchanged(database, claim, size):
    raw = bytes(i % 256 for i in range(size))
    with database[1].begin() as session:
        before = session.get(models.ExecutionRecord, claim.id).payload
        session.add(envelope(claim, raw_transaction=raw))
    with database[1]() as session:
        saved = session.scalar(select(models.ExecutionEnvelopeRecord))
        assert saved.raw_transaction == raw
        assert saved.execution_id == claim.id and saved.created_at is not None
        assert session.get(models.ExecutionRecord, claim.id).payload == before
        assert before["status"] == "CLAIMED" and before["tx_hash"] is None


@pytest.mark.parametrize("size", [0, 4097])
def test_raw_byte_bounds_are_enforced_by_database(database, claim, size):
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(envelope(claim, raw_transaction=b"x" * size))


@pytest.mark.parametrize("value", ["", "a" * 64, "0x" + "A" * 64, "0x" + "g" * 64, "0x" + "a" * 63])
def test_hash_shape_is_enforced_by_database(database, claim, value):
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(envelope(claim, transaction_hash=value))


def test_envelope_requires_an_existing_execution(database, claim):
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(envelope(claim, execution_id="missing-execution"))


def test_one_immutable_envelope_per_claim(database, claim):
    with database[1].begin() as session:
        session.add(envelope(claim))
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(envelope(claim, id="second-envelope", transaction_hash="0x" + "b" * 64))


def test_same_transaction_hash_cannot_bind_two_claims(database, client, claim, issued, rpc):
    from app.models.contracts import ExecuteRequest

    action = dict(issued[0]["payload"]["action"], id="second-journal-claim")
    rpc.nonce = 8
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    certificate = client.get("/certificates/" + response.json()["certificate_id"]).json()
    second = gate.claim_execution(
        client.app.state.engine,
        ExecuteRequest(
            certificate_id=certificate["payload"]["id"],
            action_digest=certificate["payload"]["action_digest"],
            idempotency_key="second-journal-idempotency",
        ),
        "demo-user",
        policy=issued[1],
        recheck=recompute,
    )
    with database[1].begin() as session:
        session.add(envelope(claim))
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(envelope(second, id="second-envelope"))


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE execution_envelopes SET raw_transaction = x'01'",
        "UPDATE execution_envelopes SET transaction_hash = '0x' || lower(hex(zeroblob(32)))",
        "DELETE FROM execution_envelopes",
        "INSERT OR REPLACE INTO execution_envelopes "
        "(id, created_at, execution_id, raw_transaction, transaction_hash) "
        "SELECT id, created_at, execution_id, x'01', transaction_hash FROM execution_envelopes",
    ],
)
def test_direct_sql_cannot_replace_or_delete_an_envelope(database, claim, statement):
    with database[1].begin() as session:
        session.add(envelope(claim))
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.execute(text(statement))
    with database[1]() as session:
        saved = session.scalar(select(models.ExecutionEnvelopeRecord))
        assert saved.raw_transaction == b"isolated-storage-fixture"
        assert saved.transaction_hash == "0x" + "a" * 64


def test_direct_sql_cannot_store_text_in_binary_column(database, claim):
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.execute(
            text(
                "INSERT INTO execution_envelopes "
                "(id, created_at, execution_id, raw_transaction, transaction_hash) "
                "VALUES ('text-envelope', '2026-10-17 00:00:00', :execution, 'text', :hash)"
            ),
            {"execution": claim.id, "hash": "0x" + "a" * 64},
        )


def test_additive_upgrade_preserves_existing_claims(database, claim):
    config = Config("alembic.ini")
    command.downgrade(config, "de913d28ee1a")
    with database[1]() as session:
        before = session.get(models.ExecutionRecord, claim.id).payload
    command.upgrade(config, "head")
    with database[1].begin() as session:
        assert session.get(models.ExecutionRecord, claim.id).payload == before
        session.add(envelope(claim))


def test_downgrade_refuses_to_destroy_stored_envelopes(database, claim):
    with database[1].begin() as session:
        session.add(envelope(claim))
    with pytest.raises(RuntimeError, match="non-empty"):
        command.downgrade(Config("alembic.ini"), "de913d28ee1a")
    with database[1]() as session:
        assert session.scalar(select(models.ExecutionEnvelopeRecord)).raw_transaction
