"""Fail-closed entry point for the disposable, execution-disabled Render preview."""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def validate_environment(env):
    if env.get("EXECUTION_ENABLED", "").lower() != "false":
        raise ValueError("Free preview requires EXECUTION_ENABLED=false")
    if env.get("SIGNER_PRIVATE_KEY", "").strip():
        raise ValueError("Free preview must not contain a transaction signing key")
    if env.get("DEPLOYMENT_MODE") != "public" or env.get("COOKIE_SECURE", "").lower() != "true":
        raise ValueError("Free preview requires public mode and Secure cookies")
    if not re.fullmatch(r"[0-9a-f]{32}:[0-9a-f]{64}", env.get("DEMO_PASSWORD_HASH", "")):
        raise ValueError("Configure a dedicated preview password hash before startup")
    if env.get("DATABASE_URL") != "sqlite:////tmp/prooffi-preview.db":
        raise ValueError("Free preview requires its isolated ephemeral SQLite database")


def main():
    validate_environment(os.environ)
    os.chdir(ROOT)
    os.environ["PYTHONPATH"] = str(ROOT / "services/api")
    # Validate exact HTTPS origins with the existing public deployment validator.
    sys.path.insert(0, str(ROOT / "services/api"))
    from app.core.settings import Settings

    Settings()
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    # Idempotent baseline only: never confirms policy or selects risk assumptions.
    subprocess.run([sys.executable, "-m", "app.db.seed"], check=True)
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.environ.get("PORT", "10000"),
            "--workers",
            "1",
        ],
    )


if __name__ == "__main__":
    main()
