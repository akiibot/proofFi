"""Hosted startup refuses incomplete authority and insecure storage settings."""

import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "render_postgres", Path(__file__).resolve().parents[3] / "scripts/render_postgres.py"
)
startup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(startup)


@pytest.fixture
def hosted_env():
    return {
        "DATABASE_URL": "postgresql+psycopg://test@remote.example:5432/postgres"
        "?sslmode=verify-full&sslrootcert=config/supabase-prod-ca-2021.crt",
        "DEPLOYMENT_MODE": "public",
        "COOKIE_SECURE": "true",
        "DEMO_PASSWORD_HASH": "a" * 32 + ":" + "b" * 64,
        "EXECUTION_ENABLED": "false",
        "SIGNER_PRIVATE_KEY": "",
    }


@pytest.mark.parametrize(
    "key,value",
    [
        ("DATABASE_URL", "sqlite:////tmp/prooffi-preview.db"),
        ("DATABASE_URL", "postgresql+psycopg://test@remote.example/postgres?sslmode=require"),
        ("DATABASE_URL", "postgresql+psycopg://test@remote.example/postgres?sslmode=verify-full"),
        ("DEPLOYMENT_MODE", "local"),
        ("COOKIE_SECURE", "false"),
        ("DEMO_PASSWORD_HASH", ""),
        ("EXECUTION_ENABLED", ""),
        ("EXECUTION_ENABLED", "true"),
        ("SIGNER_PRIVATE_KEY", "not-a-real-key"),
    ],
)
def test_hosted_startup_refuses_insecure_or_incomplete_configuration(hosted_env, key, value):
    hosted_env[key] = value
    with pytest.raises(ValueError):
        startup.validate_environment(hosted_env)


def test_safe_persistent_baseline_does_not_activate_execution(hosted_env):
    original = dict(hosted_env)
    startup.validate_environment(hosted_env)
    assert hosted_env == original and hosted_env["EXECUTION_ENABLED"] == "false"
