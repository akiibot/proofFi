import json

import pytest
from app.judge.runtime import VerificationRuntime
from app.verifier.service import RuntimeSettings, signing_configuration
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from pydantic import SecretStr


def test_scoped_key_never_loads_operator(monkeypatch):
    from app.verifier import service

    def forbidden():
        pytest.fail("operator keyring accessed by guest")

    monkeypatch.setattr(service, "public_keys_from_environment", forbidden)
    private = Ed25519PrivateKey.generate()
    seed = private.private_bytes(
        serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
    ).hex()
    public = private.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    settings = RuntimeSettings(
        _env_file=None,
        verifier_private_key=SecretStr(seed),
        verifier_key_id="guest-test",
        verifier_transaction_config_json=SecretStr("{}"),
        rpc_url=SecretStr(""),
    )
    runtime = VerificationRuntime(settings, "guest-test", public)
    key, key_id, keys = signing_configuration(settings, public_keys=runtime.public_keys())
    assert key_id == "guest-test"
    signature = key.sign(b"proof")
    keys[key_id].verify(signature, b"proof")


def test_provider_worker_has_no_operator_environment(monkeypatch):
    from app.planner import provider

    captured = {}
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", "do-not-copy")

    class Result:
        stdout = json.dumps(
            {
                "result": dict(
                    obligation_id="tuition", ambiguities=[], amounts_minor=[1], reason="test"
                ),
                "model": "test-model",
            }
        )

    def run(*args, **kwargs):
        captured.update(kwargs)
        return Result()

    monkeypatch.setattr(provider.subprocess, "run", run)
    settings = provider.PlannerSettings(
        _env_file=None, planner_provider="vertex_express", vertex_model="test-model"
    )
    provider.vertex_proposal("test", {}, settings, worker_environment={"PATH": "/bin"})
    assert captured["env"].keys() == {"PATH", "PYTHONPATH"}
