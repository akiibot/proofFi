"""Real authenticated Constitution lifecycle, persisted and explicitly confirmed."""

from concurrent.futures import ThreadPoolExecutor

import pytest
from app.core.canonical import digest
from app.db.models import AuditRecord, ConstitutionDraftRecord, ConstitutionVersionRecord, UserHead
from app.models.contracts import ConstitutionRules
from sqlalchemy import func, select


def rules(**updates):
    return ConstitutionRules(allowed_tokens=[], known_recipients=[], **updates).model_dump(
        mode="json"
    )


def draft(client, base=None, **updates):
    return client.post(
        "/constitutions/drafts", json={"rules": rules(**updates), "base_version": base}
    )


def confirm(client, item):
    return client.post(
        "/constitutions/confirm",
        json={
            "draft_id": item["id"],
            "expected_policy_digest": digest(item["rules"]),
            "confirmed": True,
        },
    )


def test_draft_is_persisted_without_activation_and_confirmation_creates_version(client, database):
    result = draft(client)
    assert result.status_code == 200
    item = result.json()
    assert item["user_id"] == "demo-user" and item["base_version"] is None
    assert item in client.get("/constitutions/drafts").json()
    assert client.get("/financial-state").json()["active_constitution_version"] is None
    result = confirm(client, item)
    assert result.status_code == 200
    version = result.json()
    assert version["version"] == 1 and version["rules"] == item["rules"]
    assert version["policy_digest"] == digest(item["rules"])
    assert version["confirmed_by"] == version["user_id"] == "demo-user"
    assert client.get("/financial-state").json()["active_constitution_version"] == version["id"]
    assert client.get("/constitutions/history").json() == [version]


def test_edit_draft_leaves_previous_policy_active_and_preserves_history(client):
    one = draft(client).json()
    v1 = confirm(client, one).json()
    two = draft(client, v1["id"], autonomy_limit_minor=10000).json()
    assert client.get("/financial-state").json()["active_constitution_version"] == v1["id"]
    assert client.get("/constitutions/history").json() == [v1]
    v2 = confirm(client, two).json()
    assert v2["version"] == 2 and v2["rules"]["autonomy_limit_minor"] == 10000
    assert client.get("/constitutions/history").json() == [v1, v2]
    assert v1 in client.get("/constitutions/history").json()


def test_confirmation_requires_literal_true_exact_digest_and_existing_draft(client):
    item = draft(client).json()
    for updates, status in [
        ({"confirmed": False}, 422),
        ({"confirmed": "true"}, 422),
        ({"expected_policy_digest": "f" * 64}, 409),
        ({"draft_id": "absent"}, 409),
    ]:
        body = {
            "draft_id": item["id"],
            "expected_policy_digest": digest(item["rules"]),
            "confirmed": True,
        }
        assert client.post("/constitutions/confirm", json={**body, **updates}).status_code == status
    assert client.get("/financial-state").json()["active_constitution_version"] is None


def test_old_draft_cannot_overwrite_new_active_policy(client):
    stale = draft(client).json()
    current = draft(client).json()
    assert confirm(client, current).status_code == 200
    result = confirm(client, stale)
    assert result.status_code == 409 and result.json()["code"] == "STALE_POLICY"
    assert draft(client).status_code == 409
    assert len(client.get("/constitutions/history").json()) == 1


def test_duplicate_and_concurrent_confirmations_create_one_version(client, database):
    item = draft(client).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: confirm(client, item).status_code, range(2)))
    assert sorted(statuses) == [200, 409]
    assert confirm(client, item).status_code == 409
    with database[1]() as s:
        assert s.scalar(select(func.count()).select_from(ConstitutionVersionRecord)) == 1


def test_two_competing_drafts_have_one_confirmation_winner(client):
    items = [draft(client).json(), draft(client).json()]
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda item: confirm(client, item).status_code, items))
    assert sorted(statuses) == [200, 409]
    assert len(client.get("/constitutions/history").json()) == 1


def test_draft_and_confirm_audit_are_bound_and_include_readable_change(client):
    item = draft(client).json()
    version = confirm(client, item).json()
    edited = draft(client, version["id"], autonomy_limit_minor=10000).json()
    audit = client.get("/audit").json()
    assert [e["event_type"] for e in audit] == [
        "CONSTITUTION_DRAFTED",
        "CONSTITUTION_CONFIRMED",
        "CONSTITUTION_DRAFTED",
    ]
    assert audit[0]["artifact_digest"] == digest(item)
    assert audit[1]["artifact_digest"] == digest(version)
    assert audit[2]["details"]["draft_id"] == edited["id"]
    assert "15000" in audit[2]["details"]["changes"] and "10000" in audit[2]["details"]["changes"]
    assert "Autonomy limit" in audit[2]["details"]["changes"]
    assert all(e["actor"] == "demo-user" for e in audit)


@pytest.mark.parametrize("operation", ["draft", "confirm"])
def test_corrupt_audit_rolls_back_all_policy_writes(client, database, operation):
    item = draft(client).json() if operation == "confirm" else None
    with database[1].begin() as s:
        if operation == "confirm":
            s.scalar(select(AuditRecord)).event_hash = "f" * 64
        else:
            s.add(
                AuditRecord(
                    id="bad", sequence=1, previous_hash=None, event_hash="f" * 64, payload={}
                )
            )
    result = confirm(client, item) if item else draft(client)
    assert result.status_code == 503
    with database[1]() as s:
        assert s.get(UserHead, "demo-user").constitution_id is None
        assert s.scalar(select(func.count()).select_from(ConstitutionVersionRecord)) == 0
        assert s.scalar(select(func.count()).select_from(ConstitutionDraftRecord)) == (
            2 if item else 1
        )


@pytest.mark.parametrize(
    "field,value", [("user_id", "intruder"), ("base_version", "missing"), ("id", "changed")]
)
def test_corrupt_draft_metadata_refuses_confirmation(client, database, field, value):
    item = draft(client).json()
    with database[1].begin() as s:
        row = s.get(ConstitutionDraftRecord, item["id"])
        row.payload = {**row.payload, field: value}
    assert confirm(client, item).status_code == 503
    assert client.get("/financial-state").json()["active_constitution_version"] is None


def test_history_refuses_corrupt_policy_digest(client, database):
    item = draft(client).json()
    version = confirm(client, item).json()
    with database[1].begin() as s:
        s.get(ConstitutionVersionRecord, version["id"]).policy_digest = "f" * 64
    assert client.get("/constitutions/history").status_code == 503


def test_policy_routes_reject_spoofed_identity_missing_session_and_csrf(client):
    assert (
        client.post(
            "/constitutions/drafts",
            json={"rules": rules(), "base_version": None, "user_id": "demo-user"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/constitutions/drafts",
            json={"rules": rules(), "base_version": None},
            headers={"X-CSRF-Token": "wrong"},
        ).status_code
        == 403
    )
    client.cookies.clear()
    assert draft(client).status_code == 401
    assert client.get("/constitutions/history").status_code == 401


def test_confirmation_rejects_numeric_consent(client):
    item = draft(client).json()
    response = client.post(
        "/constitutions/confirm",
        json={
            "draft_id": item["id"],
            "expected_policy_digest": digest(item["rules"]),
            "confirmed": 1,
        },
    )
    assert response.status_code == 422
    assert client.get("/financial-state").json()["active_constitution_version"] is None
