"""Request-wide planner deadline; private pipes, real process cancellation, no fallback."""

import json
import subprocess
import sys
import time
from unittest.mock import Mock

import pytest
from app.core.errors import DomainError
from app.planner import provider
from app.planner.provider import PlannerSettings, Proposal
from pydantic import SecretStr


@pytest.fixture
def settings():
    return PlannerSettings(
        _env_file=None,
        planner_provider="vertex_express",
        vertex_model="test-model",
        llm_api_key=SecretStr("test-only-private-key"),
    )


def reply():
    proposal = Proposal(
        obligation_id="tuition", ambiguities=[], amounts_minor=[100], reason="Untrusted"
    )
    return json.dumps({"result": proposal.model_dump(), "model": "test-model"})


def test_worker_deadline_and_credentials_use_private_stdin_only(settings, monkeypatch):
    run = Mock(return_value=Mock(stdout=reply()))
    monkeypatch.setattr(provider.subprocess, "run", run)
    result = provider.vertex_proposal("Protect tuition", {"policy_confirmed": False}, settings)
    assert result.amounts_minor == [100]
    args, kwargs = run.call_args
    assert args[0] == [sys.executable, "-m", "app.planner.provider"]
    assert kwargs["timeout"] == 30 and kwargs["check"] is True
    payload = json.loads(kwargs["input"])
    assert payload["settings"]["llm_api_key"] == "test-only-private-key"
    assert "test-only-private-key" not in str(args)
    assert "test-only-private-key" not in payload["goal"]
    assert "test-only-private-key" not in str(payload["context"])
    assert kwargs["capture_output"] is True
    assert run.call_count == 1


@pytest.mark.parametrize("failure", ["timeout", "exit", "invalid", "oversized", "invalid-money"])
def test_worker_failures_never_return_authority_or_private_diagnostics(
    settings, monkeypatch, failure
):
    run = Mock(return_value=Mock(stdout=reply()))
    if failure == "timeout":
        run.side_effect = subprocess.TimeoutExpired(["worker"], 30, output="test-only-private-key")
    elif failure == "exit":
        run.side_effect = subprocess.CalledProcessError(
            1, ["worker"], stderr="test-only-private-key"
        )
    elif failure == "invalid":
        run.return_value.stdout = "test-only-private-key"
    elif failure == "oversized":
        run.return_value.stdout = "x" * 65537
    else:
        run.return_value.stdout = json.dumps(
            {"obligation_id": "tuition", "ambiguities": [], "amounts_minor": [True], "reason": "x"}
        )
    monkeypatch.setattr(provider.subprocess, "run", run)
    with pytest.raises(DomainError) as error:
        provider.vertex_proposal("Protect tuition", {}, settings)
    assert error.value.code == "UNAVAILABLE"
    assert "test-only-private-key" not in str(error.value)
    assert run.call_count == 1


def test_oversized_planning_input_never_starts_worker(settings, monkeypatch):
    run = Mock()
    monkeypatch.setattr(provider.subprocess, "run", run)
    with pytest.raises(DomainError):
        provider.vertex_proposal("x" * 65537, {}, settings)
    run.assert_not_called()


def test_stalled_worker_with_even_valid_partial_output_is_killed(settings, monkeypatch):
    original = subprocess.run
    calls = []

    def stalled(command, **kwargs):
        calls.append(command)
        return original(
            [
                sys.executable,
                "-c",
                "import time; print('" + reply() + "', flush=True); time.sleep(60)",
            ],
            **kwargs,
        )

    monkeypatch.setattr(provider, "REQUEST_DEADLINE_SECONDS", 0.5)
    monkeypatch.setattr(provider.subprocess, "run", stalled)
    start = time.monotonic()
    with pytest.raises(DomainError) as error:
        provider.vertex_proposal("Protect tuition", {}, settings)
    assert time.monotonic() - start < 5
    assert error.value.code == "UNAVAILABLE"
    assert len(calls) == 1


def test_actual_worker_rejects_invalid_settings_without_stderr(settings):
    settings.vertex_model = None
    environment = provider.os.environ.copy()
    environment["PYTHONPATH"] = str(provider.Path(provider.__file__).resolve().parents[2])
    result = subprocess.run(
        [sys.executable, "-m", "app.planner.provider"],
        input=json.dumps(
            {"goal": "Protect tuition", "context": {}, "settings": settings.model_dump(mode="json")}
        ),
        capture_output=True,
        text=True,
        timeout=10,
        env=environment,
    )
    assert result.returncode == provider.FAILURE_EXITS["configuration"]
    assert result.stdout == result.stderr == ""


def test_explicitly_missing_key_cannot_be_filled_from_worker_environment(settings, monkeypatch):
    settings.llm_api_key = None
    monkeypatch.setenv("LLM_API_KEY", "test-only-unexpected-environment-key")
    run = Mock(side_effect=subprocess.CalledProcessError(1, ["worker"]))
    monkeypatch.setattr(provider.subprocess, "run", run)
    with pytest.raises(DomainError):
        provider.vertex_proposal("Protect tuition", {}, settings)
    payload = json.loads(run.call_args.kwargs["input"])
    assert payload["settings"]["llm_api_key"] is None
