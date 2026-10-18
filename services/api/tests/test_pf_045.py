"""Deployment guard regression: a free instance cannot accept signing authority."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "render_preview", Path(__file__).resolve().parents[3] / "scripts/render_preview.py"
)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


@pytest.fixture
def preview_env():
    return {
        "EXECUTION_ENABLED": "false",
        "SIGNER_PRIVATE_KEY": "",
        "DEPLOYMENT_MODE": "public",
        "COOKIE_SECURE": "true",
        "DEMO_PASSWORD_HASH": "a" * 32 + ":" + "b" * 64,
        "DATABASE_URL": "sqlite:////tmp/prooffi-preview.db",
    }


@pytest.mark.parametrize(
    "key,value",
    [
        ("EXECUTION_ENABLED", "true"),
        ("EXECUTION_ENABLED", ""),
        ("SIGNER_PRIVATE_KEY", "not-a-real-key"),
        ("DEPLOYMENT_MODE", "local"),
        ("COOKIE_SECURE", "false"),
        ("DEMO_PASSWORD_HASH", ""),
        ("DATABASE_URL", "sqlite:///original-demo.db"),
    ],
)
def test_free_preview_refuses_unsafe_configuration(preview_env, key, value):
    preview_env[key] = value
    with pytest.raises(ValueError):
        preview.validate_environment(preview_env)


def test_preview_configuration_accepted_without_mutating_environment(preview_env):
    original = dict(preview_env)
    preview.validate_environment(preview_env)
    assert preview_env == original
