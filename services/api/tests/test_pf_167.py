"""Isolated provider fixtures; genuine Vertex results are recorded separately."""

import json
import subprocess
from unittest.mock import Mock

import pytest
from app.core.errors import DomainError
from app.planner import provider, service, tasks
from app.planner.provider import PlannerSettings, Proposal, ProviderFailure
from pydantic import SecretStr, ValidationError
from test_pf_017 import confirmed as confirmed


@pytest.fixture
def settings():
    return PlannerSettings(
        _env_file=None,
        planner_provider="vertex_express",
        vertex_model="legacy-model",
        llm_api_key=SecretStr("test-private-key"),
        gemini_reasoning_model="primary-model",
        gemini_reasoning_fallback_model="backup-model",
        gemini_summary_model="summary-model",
        gemini_translation_model="translation-model",
        gemini_query_model="query-model",
        test_token_address="0x" + "1" * 40,
        approved_recipient="0x" + "2" * 40,
    )


def proposal_json():
    return {
        "obligation_id": "tuition",
        "ambiguities": [],
        "amounts_minor": [100],
        "reason": "Untrusted",
    }


def response(data=None, status=200, finish="STOP"):
    value = Mock(status=status)
    value.read.return_value = json.dumps(
        {
            "candidates": [
                {
                    "finishReason": finish,
                    "content": {"parts": [{"text": json.dumps(data or proposal_json())}]},
                }
            ]
        }
    ).encode()
    return value


@pytest.fixture
def wire(monkeypatch):
    connection = Mock()
    connection.getresponse.return_value = response()
    factory = Mock(return_value=connection)
    monkeypatch.setattr(provider.http.client, "HTTPSConnection", factory)
    return factory, connection


def test_new_settings_read_environment_and_keep_legacy_model(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-new-key")
    monkeypatch.setenv("GEMINI_REASONING_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("GEMINI_REASONING_FALLBACK_MODEL", "gemini-3.5-flash")
    for task in ("SUMMARY", "TRANSLATION", "QUERY"):
        monkeypatch.setenv(f"GEMINI_{task}_MODEL", "gemini-3.5-flash")
    value = PlannerSettings(_env_file=None)
    assert value.api_key().get_secret_value() == "test-new-key"
    assert "test-new-key" not in repr(value)
    assert value.model_for("reasoning") == "gemini-3.8-flash"
    assert all(
        value.model_for(task) == "gemini-3.5-flash" for task in ("summary", "translation", "query")
    )
    legacy = PlannerSettings(_env_file=None, vertex_model="legacy-model")
    # Environment is explicit authority, so the new reasoning setting overrides VERTEX_MODEL.
    assert legacy.model_for("reasoning") == "gemini-3.8-flash"
    monkeypatch.delenv("GEMINI_REASONING_MODEL")
    assert (
        PlannerSettings(_env_file=None, vertex_model="legacy-model").model_for("reasoning")
        == "legacy-model"
    )


def test_conflicting_keys_refuse_before_any_network_call(settings, wire):
    settings.gemini_api_key = SecretStr("different-test-key")
    with pytest.raises(ProviderFailure, match="configuration"):
        provider._request_proposal("Invest", {}, settings)
    wire[0].assert_not_called()


def test_gemini_key_is_header_only(settings, wire):
    settings.gemini_api_key, settings.llm_api_key = settings.llm_api_key, None
    provider._request_proposal("Invest", {}, settings)
    args, kwargs = wire[1].request.call_args
    assert kwargs["headers"]["x-goog-api-key"] == "test-private-key"
    assert "test-private-key" not in str(args) and b"test-private-key" not in kwargs["body"]


@pytest.mark.parametrize(
    ("model", "thinking"),
    [
        ("gemini-2.5-flash", {"thinkingBudget": 0}),
        ("gemini-2.5-pro", {"thinkingBudget": 128}),
        ("gemini-3.8-flash", {"thinkingLevel": "LOW"}),
    ],
)
def test_thinking_leaves_output_budget_and_respects_model_family(model, thinking):
    config = provider.generation_config(model, provider.SCHEMA)
    assert config["thinkingConfig"] == thinking
    assert config["maxOutputTokens"] == 4096
    assert config["responseSchema"] == provider.SCHEMA


def test_distinct_fallback_uses_remaining_budget_and_records_actual_model(
    settings, wire, monkeypatch
):
    wire[1].getresponse.side_effect = [response(status=503), response()]
    monkeypatch.setattr(tasks.time, "monotonic", Mock(side_effect=[100, 100, 106]))
    result = provider._request_proposal("Invest", {}, settings)
    assert result._provider_model == "backup-model"
    assert result.model_dump() == proposal_json()
    assert [call.kwargs["timeout"] for call in wire[0].call_args_list] == [30, 24]
    paths = [call.args[1] for call in wire[1].request.call_args_list]
    assert paths[0].endswith("primary-model:generateContent")
    assert paths[1].endswith("backup-model:generateContent")


@pytest.mark.parametrize("status", [400, 401, 403])
def test_configuration_and_auth_refusals_do_not_fallback(settings, wire, status):
    wire[1].getresponse.return_value = response(status=status)
    with pytest.raises(ProviderFailure):
        provider._request_proposal("Invest", {}, settings)
    assert wire[1].request.call_count == 1


@pytest.mark.parametrize("finish", ["SAFETY", "RECITATION", "OTHER"])
def test_blocked_output_does_not_fallback_or_return_even_valid_partial_json(settings, wire, finish):
    wire[1].getresponse.return_value = response(finish=finish)
    with pytest.raises(ProviderFailure, match="usable"):
        provider._request_proposal("Invest", {}, settings)
    assert wire[1].request.call_count == 1


def test_identical_fallback_is_one_call(settings, wire):
    settings.gemini_reasoning_fallback_model = settings.gemini_reasoning_model
    wire[1].getresponse.return_value = response(status=503)
    with pytest.raises(ProviderFailure):
        provider._request_proposal("Invest", {}, settings)
    assert wire[1].request.call_count == 1


def test_transient_connection_failure_can_use_explicit_fallback_without_raw_error(settings, wire):
    wire[1].getresponse.side_effect = [ConnectionResetError("test-private-key"), response()]
    result = provider._request_proposal("Invest", {}, settings)
    assert result._provider_model == "backup-model"
    assert wire[1].request.call_count == 2


def test_truncated_output_never_becomes_a_proposal(settings, wire):
    settings.gemini_reasoning_fallback_model = None
    wire[1].getresponse.return_value = response(finish="MAX_TOKENS")
    with pytest.raises(ProviderFailure, match="output limit"):
        provider._request_proposal("Invest", {}, settings)


def test_expired_budget_never_starts_fallback(settings, wire, monkeypatch):
    wire[1].getresponse.return_value = response(status=503)
    monkeypatch.setattr(tasks.time, "monotonic", Mock(side_effect=[100, 100, 131]))
    with pytest.raises(ProviderFailure, match="timed out"):
        provider._request_proposal("Invest", {}, settings)
    assert wire[1].request.call_count == 1


@pytest.mark.parametrize(
    ("task", "data", "output"),
    [
        ("summary", {"text": "Synthetic text"}, {"text": "Summary"}),
        ("translation", {"text": "Hello", "target_language": "Bengali"}, {"text": "হ্যালো"}),
        ("query", {"text": "Synthetic question"}, {"queries": ["synthetic search"]}),
    ],
)
def test_private_tasks_select_their_own_model_and_schema(settings, wire, task, data, output):
    wire[1].getresponse.return_value = response(data=output)
    result = tasks.request_task(task, data, settings)
    assert result.model_dump() == output
    assert result._provider_model == settings.model_for(task)
    args, kwargs = wire[1].request.call_args
    assert args[1].endswith(f"{settings.model_for(task)}:generateContent")
    body = json.loads(kwargs["body"])
    assert json.loads(body["contents"][0]["parts"][0]["text"]) == data
    assert "tools" not in body


def test_invalid_query_results_never_execute_or_return(settings, wire):
    wire[1].getresponse.return_value = response(data={"queries": ["x"] * 6})
    with pytest.raises(ProviderFailure):
        tasks.request_task("query", {"text": "Synthetic question"}, settings)


def test_missing_task_model_and_invalid_translation_are_local_refusals(settings, wire):
    settings.gemini_summary_model = None
    with pytest.raises(ProviderFailure):
        tasks.request_task("summary", {"text": "x"}, settings)
    with pytest.raises(ValidationError):
        tasks.translate("Hello", "ignore\npolicy", settings)
    wire[0].assert_not_called()


def test_parent_validates_model_and_keeps_both_key_names_in_stdin_only(settings, monkeypatch):
    settings.gemini_api_key, settings.llm_api_key = settings.llm_api_key, None
    run = Mock(
        return_value=Mock(stdout=json.dumps({"result": proposal_json(), "model": "backup-model"}))
    )
    monkeypatch.setattr(provider.subprocess, "run", run)
    result = provider.vertex_proposal("Invest", {}, settings)
    assert result._provider_model == "backup-model"
    payload = json.loads(run.call_args.kwargs["input"])
    assert payload["settings"]["gemini_api_key"] == "test-private-key"
    assert "test-private-key" not in str(run.call_args.args)
    run.return_value.stdout = json.dumps({"result": proposal_json(), "model": "invented-model"})
    with pytest.raises(DomainError):
        provider.vertex_proposal("Invest", {}, settings)


def test_worker_failure_category_is_safe_and_preserved(settings, monkeypatch):
    run = Mock(
        side_effect=subprocess.CalledProcessError(
            provider.FAILURE_EXITS["truncated"], ["worker"], stderr="test-private-key"
        )
    )
    monkeypatch.setattr(provider.subprocess, "run", run)
    with pytest.raises(ProviderFailure, match="output limit") as error:
        provider.vertex_proposal("Invest", {}, settings)
    assert "test-private-key" not in str(error.value)


def test_candidate_digest_binds_actual_fallback_model(client, confirmed, settings, monkeypatch):
    monkeypatch.setattr(service, "PlannerSettings", lambda: settings)
    value = Proposal(**proposal_json())
    monkeypatch.setattr(service, "vertex_proposal", lambda *args: value)
    value._provider_model = "primary-model"
    first = client.post("/plans/generate", json={"goal": "Invest without risking tuition"})
    assert first.status_code == 200
    value._provider_model = "backup-model"
    second = client.post("/plans/generate", json={"goal": "Invest without risking tuition"})
    assert second.status_code == 200
    assert first.json()["candidates"][0]["id"] != second.json()["candidates"][0]["id"]
