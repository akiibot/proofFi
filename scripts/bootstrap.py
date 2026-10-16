"""Run from repo root with Python 3.11. No chain/LLM credentials needed."""

import os
import secrets
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
if sys.version_info[:2] != (3, 11):
    raise SystemExit("Use Python 3.11: python3.11 scripts/bootstrap.py")
venv = ROOT / ".venv"
python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(*cmd, **kwargs):
    subprocess.run([str(x) for x in cmd], check=True, **kwargs)


if not python.exists():
    run(sys.executable, "-m", "venv", venv)
run(python, "-m", "pip", "install", "uv==0.13.1")
run(python, "-m", "uv", "sync", "--locked")
if not (ROOT / ".env").exists():
    env = (
        (ROOT / ".env.example")
        .read_text()
        .replace("API_TOKEN=\n", f"API_TOKEN={secrets.token_urlsafe(32)}\n")
    )
    (ROOT / ".env").write_text(env)
    os.chmod(ROOT / ".env", 0o600)
run(python, "scripts/provision_demo_auth.py")
run("npm", "ci", shell=os.name == "nt")
run(python, "-m", "alembic", "upgrade", "head")
run(python, "-m", "app.db.seed", env={**os.environ, "PYTHONPATH": "services/api"})
print("Foundation ready. Run npm run dev; open http://127.0.0.1:3000. No chain execution enabled.")
