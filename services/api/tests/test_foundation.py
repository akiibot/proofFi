import json
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from app.core.canonical import canonical_bytes, digest
from app.core.errors import DomainError
from app.db.models import FinancialStateRecord, User, UserHead
from app.db.seed import baseline, seed
from app.db.state import append_state, read_state
from app.models.contracts import CandidateAction, ChainTransaction, ConstitutionRules, StateSnapshot
from pydantic import ValidationError
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError


def candidate(**updates):
    return dict(
        id="candidate-test",
        action_type="TEST_TOKEN_ALLOCATION",
        amount_minor=10000,
        chain_id=84532,
        token_address="0x" + "1" * 40,
        recipient="0x" + "2" * 40,
        funding_source="owned",
        planner_reason_untrusted="Test fixture only",
        planner_mode="deterministic_demo",
        **updates,
    )


def test_migrated_database_round_trip(database):
    _, factory = database
    with factory() as session:
        assert len(inspect(session.bind).get_table_names()) == 14
        assert session.execute(text("PRAGMA foreign_keys")).scalar() == 1
    # A clean empty database can downgrade and re-upgrade; never downgrade a live ledger.
    with factory.begin() as session:
        session.execute(text("DELETE FROM user_heads"))
        session.execute(text("DELETE FROM constitution_drafts"))
        session.execute(text("DELETE FROM financial_states"))
        session.execute(text("DELETE FROM users"))
    config = Config("alembic.ini")
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.check(config)
    with factory.begin() as session:
        assert seed(session)


def test_seed_idempotent_no_silent_policy_activation(database):
    with database[1].begin() as session:
        assert not seed(session)
        assert len(list(session.scalars(select(User)))) == 1
        state = read_state(session)
        assert state.snapshot.assets[0].amount_minor == 1200000
        assert state.active_constitution_version is None
        assert state.snapshot.expected_income == []
        assert state.snapshot_hash == digest(baseline())


def test_version_append_preserves_history_and_rejects_stale_writer(database):
    with database[1].begin() as session:
        original = read_state(session)
        payload = original.snapshot.model_dump(mode="json")
        payload["version"] = 2
        payload["realized_expense_minor"] = 200000
        payload["assets"][0]["amount_minor"] -= 200000
        updated = append_state(session, StateSnapshot.model_validate(payload), 1)
        assert original.snapshot_hash != updated.snapshot_hash
    with database[1].begin() as session:
        assert read_state(session).snapshot.version == 2
        assert (
            session.get(FinancialStateRecord, "state-v1").payload["assets"][0]["amount_minor"]
            == 1200000
        )
        with pytest.raises(DomainError) as exc:
            append_state(session, StateSnapshot.model_validate(payload), 1)
        assert exc.value.status == 409


def test_fk_and_unique_version_constraints(database):
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(UserHead(user_id="missing", state_id="state-v1"))
        session.flush()
    with pytest.raises(IntegrityError), database[1].begin() as session:
        session.add(
            FinancialStateRecord(
                id="duplicate", user_id="demo-user", version=1, snapshot_hash="a" * 64, payload={}
            )
        )
        session.flush()


def test_state_corruption_fails_closed(database):
    with database[1].begin() as session:
        record = session.get(FinancialStateRecord, "state-v1")
        record.snapshot_hash = "a" * 64
    with database[1]() as session, pytest.raises(DomainError):
        read_state(session)


@pytest.mark.parametrize("amount", [True, 1.5, "150", -1, 0, 10**20])
def test_money_rejects_coercion_and_invalid_values(amount):
    payload = candidate()
    payload["amount_minor"] = amount
    with pytest.raises(ValidationError):
        CandidateAction.model_validate(payload)


def test_untrusted_action_cannot_carry_authority():
    payload = candidate()
    payload["verified"] = True
    with pytest.raises(ValidationError):
        CandidateAction.model_validate(payload)


def transaction():
    return dict(
        chain_id=84532,
        sender="0x" + "3" * 40,
        to="0x" + "1" * 40,
        token_address="0x" + "1" * 40,
        recipient="0x" + "2" * 40,
        token_decimals=6,
        amount_base_units="100000000",
        value_wei="0",
        data="",
        nonce=0,
        gas_limit=100000,
        max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
        intention="test allocation to an approved demo destination",
    )


def test_exact_erc20_encoding_and_chain_restriction():
    payload = transaction()
    payload["data"] = (
        "0xa9059cbb"
        + payload["recipient"][2:].rjust(64, "0")
        + f"{int(payload['amount_base_units']):064x}"
    )
    ChainTransaction.model_validate(payload)
    for key, value in [
        ("chain_id", 1),
        ("amount_base_units", "100000001"),
        ("recipient", "0x" + "4" * 40),
        ("to", "0x" + "4" * 40),
        ("data", "0x"),
        ("value_wei", "1"),
    ]:
        with pytest.raises(ValidationError):
            ChainTransaction.model_validate({**payload, key: value})


def test_canonical_encoding_deterministic_and_rejects_float():
    assert canonical_bytes({"z": 1, "a": "é"}) == b'{"a":"\xc3\xa9","z":1}'
    assert digest({"a": 1, "b": 2}) == digest({"b": 2, "a": 1})
    with pytest.raises(TypeError):
        canonical_bytes({"amount": 1.5})


def test_blocked_recipient_cannot_be_known():
    with pytest.raises(ValidationError):
        ConstitutionRules(
            allowed_tokens=[],
            known_recipients=["0x" + "1" * 40],
            blocked_recipients=["0x" + "1" * 40],
        )


def test_health_state_and_draft_real_database(client):
    assert client.get("/health").json()["database"] == "ready"
    state = client.get("/financial-state").json()
    assert state == json.loads(Path("contracts/financial-state.example.json").read_text())
    assert len(client.get("/constitutions/drafts").json()) == 1
    assert client.get("/audit").json() == []
    assert client.get("/chain/status").json()["status"] == "CHAIN_NOT_CONFIGURED"


def test_auth_required_and_unfinished_calls_are_not_successes(client):
    client.headers.pop("Authorization")
    assert client.get("/financial-state").status_code == 401
    assert client.post("/execute", json={}).status_code == 401
    client.headers["Authorization"] = "Bearer test-credential"
    result = client.post(
        "/execute",
        json={
            "certificate_id": "fake",
            "action_digest": "a" * 64,
            "idempotency_key": "test-idempotency-1",
        },
    )
    assert result.status_code == 501
    assert result.json()["code"] == "NOT_IMPLEMENTED"
    assert "tx_hash" not in result.json()
    result = client.post("/simulate", json={"action": candidate(), "config": {"seed": 1}})
    assert result.status_code == 422
    assert "input" not in result.text


def test_no_signer_import_in_planner():
    import ast

    for path in Path("services/api/app/planner").glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith(
                    ("app.execution", "app.verifier", "app.approvals")
                )
            if isinstance(node, ast.Import):
                assert all(
                    not alias.name.startswith(("app.execution", "app.verifier", "app.approvals"))
                    for alias in node.names
                )


def test_backlog_complete_and_acyclic():
    rows = json.loads(Path("docs/issues.json").read_text())
    by_id = {row["id"]: row for row in rows}
    assert set(by_id) == {f"PF-{i:03d}" for i in range(1, 34)}

    def visit(id, path):
        assert id not in path
        for dep in by_id[id]["dependencies"]:
            visit(dep, path | {id})

    for id in by_id:
        visit(id, set())
        assert Path(f".github/issue-drafts/{id}.md").exists()


def test_environment_chain_id_parsing_and_mainnet_rejection(monkeypatch):
    from app.core.settings import Settings

    monkeypatch.setenv("CHAIN_ID", "84532")
    assert Settings(_env_file=None).chain_id == 84532
    monkeypatch.setenv("CHAIN_ID", "1")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
