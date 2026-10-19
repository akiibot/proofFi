"""Preview an explicit selection; publish a new isolated DB only after digest confirmation."""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/api"))

from app.core.canonical import digest  # noqa: E402
from app.db.session import make_engine, sessions  # noqa: E402
from app.demo.provision import provision_funded_demo  # noqa: E402
from app.models.contracts import SimulationConfig  # noqa: E402


def selection_digest(config):
    return digest({"scenario": "synthetic-extra-5000-no-income-v1", "config": config.model_dump(mode="json")})


def provision(destination: Path, config: SimulationConfig, confirmation: str):
    config = SimulationConfig.model_validate_json(config.model_dump_json())
    if confirmation != selection_digest(config):
        raise ValueError("Exact scenario/configuration digest confirmation required")
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("Destination already exists; original data will not be changed")
    if not destination.parent.is_dir():
        raise ValueError("Create the intended private destination directory first")
    # Build privately, then atomically publish create-only. Concurrent calls cannot overwrite.
    with tempfile.TemporaryDirectory(prefix=".vallet-provision-", dir=destination.parent) as temporary:
        staging = Path(temporary) / "scenario.db"
        staging.touch(mode=0o600)
        url = "sqlite:///" + str(staging)
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=ROOT, env={**os.environ, "DATABASE_URL": url}, capture_output=True, check=False,
        )
        if result.returncode:
            raise ValueError("Scenario database migration failed; destination was not published")
        engine = make_engine(url)
        try:
            with sessions(engine).begin() as session:
                provision_funded_demo(session, config)
        finally:
            engine.dispose()
        os.link(staging, destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--database", type=Path)
    parser.add_argument("--confirm-digest")
    args = parser.parse_args()
    config = SimulationConfig.model_validate_json(args.config.read_text())
    print("Synthetic funded scenario: $17,000 starting cash; no income; original baseline retained.")
    print(config.model_dump_json(indent=2))
    print("Selection digest:", selection_digest(config))
    if args.database is None and args.confirm_digest is None:
        print("Preview only. No database, policy, signer or runtime setting changed.")
        return
    if args.database is None or args.confirm_digest is None:
        parser.error("Publishing requires both --database and --confirm-digest")
    destination = provision(args.database, config, args.confirm_digest)
    print("Created isolated scenario database:", destination)
    print("Runtime unchanged. Constitution remains unconfirmed; signing is not enabled.")


if __name__ == "__main__":
    main()
