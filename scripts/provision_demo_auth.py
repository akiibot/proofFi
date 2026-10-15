"""Provision ignored local demo credentials without printing their values."""

import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/api"))
from app.core.auth import hash_password  # noqa: E402
from dotenv import dotenv_values  # noqa: E402


def provision(root: Path = ROOT):
    env_path = root / ".env"
    values = dotenv_values(env_path)
    if os.environ.get("DEMO_PASSWORD_HASH") or values.get("DEMO_PASSWORD_HASH"):
        print("Existing demo authentication configuration preserved")
        return
    directory = root / ".local"
    directory.mkdir(mode=0o700, exist_ok=True)
    password_path = directory / "demo-password.txt"
    password = secrets.token_urlsafe(24)
    # Create-only prevents overwriting a prior credential before operator review.
    with password_path.open("x") as stream:
        os.chmod(password_path, 0o600)
        stream.write(password + "\n")
    encoded = hash_password(password)
    text = env_path.read_text()
    lines = text.splitlines()
    lines = [line for line in lines if not line.startswith("DEMO_PASSWORD_HASH=")]
    env_path.write_text("\n".join(lines) + "\nDEMO_PASSWORD_HASH=" + encoded + "\n")
    os.chmod(env_path, 0o600)
    print("Demo login password saved to ignored .local/demo-password.txt (owner access only)")


if __name__ == "__main__":
    provision()
