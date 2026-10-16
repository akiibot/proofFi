"""Private provider substitutions only; real authenticated API and SQLite context."""

import json
from unittest.mock import Mock

import pytest
from app.core.canonical import digest
from app.core.errors import DomainError
from app.models.contracts import ErrorCode
from app.planner import provider, service
from app.planner.provider import PlannerSettings, Proposal, vertex_proposal

TOKEN = "0x" + "1" * 40
RECIPIENT = "0x" + "2" * 40


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    value = PlannerSettings(
        _env_file=None,
        planner_mode="live_llm",
        google_cloud_project="test-project",
        vertex_model="test-model",
        vertex_account="demo@example.com",
        test_token_address=TOKEN,
        approved_recipient=RECIPIENT,
    )
    monkeypatch.setattr(service, "PlannerSettings", lambda: value)
    return value


@pytest.fixture
def reply(monkeypatch):
    stub = Mock(
        return_value=Proposal(
            obligation_id="tuition",
            ambiguities=[],
            amounts_minor=[100, 15000, 400000],
            reason="Untrusted model proposal, not approval.",
        )
    )
    monkeypatch.setattr(service, "vertex_proposal", stub)
    return stub


@pytest.fixture
def confirmed(client):
    from app.models.contracts import ConstitutionRules

    rules = ConstitutionRules(allowed_tokens=[TOKEN], known_recipients=[RECIPIENT])
    draft = client.post(
        "/constitutions/drafts", json={"rules": rules.model_dump(), "base_version": None}
    ).json()
    response = client.post(
        "/constitutions/confirm",
        json={"draft_id": draft["id"], "expected_policy_digest": digest(rules), "confirmed": True},
    )
    assert response.status_code == 200


def test_parse_uses_actual_goal_obligation_and_minimal_context(client, reply):
    response = client.post("/intent/parse", json={"goal": "Invest without risking tuition"})
    assert response.status_code == 200
    assert response.json()["obligation_id"] == "tuition"
    context = reply.call_args.args[1]
    assert context["liquid_minor"] == 1200000 and context["income_assumptions"] == []
    assert set(context) == {"obligation", "liquid_minor", "income_assumptions", "policy_confirmed"}
    assert "password" not in json.dumps(context).lower()


def test_missing_policy_requests_clarification(client, reply):
    response = client.post("/plans/generate", json={"goal": "Invest while protecting tuition"})
    assert response.status_code == 200
    assert response.json()["candidates"] == []
    assert any("Constitution" in item for item in response.json()["clarification"])


def test_live_candidates_are_canonical_untrusted_and_do_not_write(
    client, database, confirmed, reply
):
    from app.db.models import CandidateRecord, CertificateRecord, ExecutionRecord
    from sqlalchemy import func, select

    first = client.post("/plans/generate", json={"goal": "Invest while protecting tuition"})
    assert first.status_code == 200
    result = first.json()
    assert result["mode"] == "live_llm" and len(result["candidates"]) == 3
    assert result["candidates"][2]["amount_minor"] == 400000
    assert all(item["planner_mode"] == "live_llm" for item in result["candidates"])
    assert (
        result
        == client.post("/plans/generate", json={"goal": "Invest while protecting tuition"}).json()
    )
    with database[1]() as session:
        for model in (CandidateRecord, CertificateRecord, ExecutionRecord):
            assert session.scalar(select(func.count()).select_from(model)) == 0


def test_ambiguity_and_unknown_obligation_never_make_candidates(client, confirmed, reply):
    reply.return_value = Proposal(
        obligation_id="imaginary", ambiguities=["Which goal?"], amounts_minor=[100], reason="ask"
    )
    response = client.post("/plans/generate", json={"goal": "Do something"}).json()
    assert response["candidates"] == [] and response["clarification"]


@pytest.mark.parametrize("field", ["test_token_address", "approved_recipient"])
def test_missing_destination_requests_clarification(client, confirmed, reply, settings, field):
    setattr(settings, field, None)
    result = client.post("/plans/generate", json={"goal": "Invest"}).json()
    assert result["candidates"] == [] and result["clarification"]


def test_demo_is_explicit_and_provider_is_not_called(client, confirmed, reply, settings):
    settings.planner_mode = "deterministic_demo"
    settings.demo_mode = True
    result = client.post("/plans/generate", json={"goal": "Invest for tuition"}).json()
    assert result["mode"] == "deterministic_demo"
    assert result["candidates"][0]["amount_minor"] == 1
    reply.assert_not_called()


def test_demo_mode_cannot_run_outside_demo(client, settings):
    settings.planner_mode = "deterministic_demo"
    settings.demo_mode = False
    assert client.post("/intent/parse", json={"goal": "Invest"}).status_code == 503


def test_provider_failure_does_not_silently_fallback(client, reply):
    reply.side_effect = DomainError(ErrorCode.UNAVAILABLE, "Provider unavailable")
    response = client.post("/plans/generate", json={"goal": "Invest"})
    assert response.status_code == 503 and "mode" not in response.json()


def test_routes_require_session_csrf_and_reject_authority(client, reply):
    assert (
        client.post("/intent/parse", json={"goal": "Invest", "verified": True}).status_code == 422
    )
    assert (
        client.post(
            "/plans/generate", json={"goal": "Invest"}, headers={"X-CSRF-Token": "bad"}
        ).status_code
        == 403
    )
    client.cookies.clear()
    assert client.post("/intent/parse", json={"goal": "Invest"}).status_code == 401
    reply.assert_not_called()


@pytest.fixture
def transport(monkeypatch):
    monkeypatch.setattr(provider.shutil, "which", lambda _: "/usr/bin/gcloud")
    token = Mock(return_value=Mock(stdout="test-oauth-token\n"))
    monkeypatch.setattr(provider.subprocess, "run", token)
    response = Mock(status=200)
    response.read.return_value = json.dumps(
        {
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "obligation_id": "tuition",
                                        "ambiguities": [],
                                        "amounts_minor": [100],
                                        "reason": "Untrusted",
                                    }
                                )
                            }
                        ]
                    },
                }
            ]
        }
    ).encode()
    connection = Mock()
    connection.getresponse.return_value = response
    monkeypatch.setattr(provider.http.client, "HTTPSConnection", Mock(return_value=connection))
    return token, connection, response


def test_vertex_uses_project_account_and_bounded_response(settings, transport):
    token, connection, response = transport
    result = vertex_proposal("Invest", {"obligation": {"id": "tuition"}}, settings)
    assert result.amounts_minor == [100]
    args, kwargs = connection.request.call_args
    assert (
        args[1]
        == "/v1/projects/test-project/locations/global/publishers/google/models/test-model:generateContent"
    )
    assert kwargs["headers"]["Authorization"] == "Bearer test-oauth-token"
    assert b"test-oauth-token" not in kwargs["body"]
    assert "--account=demo@example.com" in token.call_args.args[0]
    assert token.call_args.kwargs["timeout"] == 20
    response.read.assert_called_once_with(65537)
    connection.close.assert_called_once()


@pytest.mark.parametrize(
    "body",
    [
        {"obligation_id": "tuition", "ambiguities": [], "amounts_minor": [True], "reason": "x"},
        {"obligation_id": "tuition", "ambiguities": [], "amounts_minor": [-1], "reason": "x"},
        {"obligation_id": "tuition", "ambiguities": [], "amounts_minor": [1.5], "reason": "x"},
        {"obligation_id": "tuition", "ambiguities": [], "amounts_minor": ["100"], "reason": "x"},
        {
            "obligation_id": "tuition",
            "ambiguities": [],
            "amounts_minor": [1, 2, 3, 4],
            "reason": "x",
        },
        {
            "obligation_id": "tuition",
            "ambiguities": [],
            "amounts_minor": [1],
            "reason": "x",
            "approved": True,
        },
    ],
)
def test_malformed_provider_data_refuses(settings, transport, body):
    transport[2].read.return_value = json.dumps(
        {
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(body)}]}}
            ]
        }
    ).encode()
    with pytest.raises(DomainError) as exc:
        vertex_proposal("Invest", {}, settings)
    assert exc.value.code == ErrorCode.UNAVAILABLE


@pytest.mark.parametrize(
    "kind", ["oversized", "invalid-json", "blocked", "http", "timeout", "credentials"]
)
def test_provider_failures_are_sanitized(settings, transport, kind):
    token, connection, response = transport
    if kind == "oversized":
        response.read.return_value = b"x" * 65537
    elif kind == "invalid-json":
        response.read.return_value = b"bad"
    elif kind == "blocked":
        response.read.return_value = b'{"candidates":[]}'
    elif kind == "http":
        response.status = 429
    elif kind == "timeout":
        connection.getresponse.side_effect = TimeoutError("secret-token")
    else:
        token.side_effect = TimeoutError("secret-token")
    with pytest.raises(DomainError) as exc:
        vertex_proposal("Invest", {}, settings)
    assert "secret" not in exc.value.message


def test_empty_optional_destination_settings_are_missing_not_invalid(monkeypatch):
    monkeypatch.setenv("TEST_TOKEN_ADDRESS", "")
    monkeypatch.setenv("APPROVED_RECIPIENT", "")
    value = PlannerSettings(_env_file=None)
    assert value.test_token_address is None and value.approved_recipient is None
