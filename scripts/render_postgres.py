"""Persistent Supabase startup; no automatic financial configuration or consent."""

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/api"))


def validate_environment(env):
    from sqlalchemy.engine import make_url

    url = make_url(env.get("DATABASE_URL", ""))
    if url.drivername != "postgresql+psycopg" or url.query.get("sslmode") != "verify-full":
        raise ValueError("Persistent hosting requires verified PostgreSQL TLS")
    if not url.query.get("sslrootcert"):
        raise ValueError("A trusted PostgreSQL CA file is required")
    if env.get("DEPLOYMENT_MODE") != "public" or env.get("COOKIE_SECURE", "").lower() != "true":
        raise ValueError("Persistent hosting requires public mode and Secure cookies")
    if not re.fullmatch(r"[0-9a-f]{32}:[0-9a-f]{64}", env.get("DEMO_PASSWORD_HASH", "")):
        raise ValueError("Configure the dedicated hosted password hash before startup")
    enabled = env.get("EXECUTION_ENABLED", "").lower()
    if enabled not in ("true", "false"):
        raise ValueError("Explicit execution enablement setting required")
    if enabled == "false" and env.get("SIGNER_PRIVATE_KEY", "").strip():
        raise ValueError("Do not stage a wallet key in an execution-disabled deployment")
    if enabled == "true" and any(
        not env.get(key, "").strip()
        for key in (
            "SIGNER_PRIVATE_KEY",
            "RPC_URL",
            "VERIFIER_PRIVATE_KEY",
            "VERIFIER_KEY_ID",
            "VERIFIER_PUBLIC_KEYS_JSON",
            "VERIFIER_TRANSACTION_CONFIG_JSON",
        )
    ):
        raise ValueError("Reviewed testnet signing/verification configuration required")


def main():
    validate_environment(os.environ)
    os.chdir(ROOT)
    os.environ["PYTHONPATH"] = str(ROOT / "services/api")
    from app.core.settings import Settings

    Settings()
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic-postgres.ini", "upgrade", "head"],
        check=True,
    )
    # Existing idempotent baseline only, now under the reviewed authority lock.
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
