"""Preview by default; --confirm appends funded restaging before any execution."""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.core.errors import DomainError  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.db.session import make_engine  # noqa: E402
from app.demo.reset import reset_demo  # noqa: E402


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm", action="store_true", help="Append the recorded funded snapshot")
    args = parser.parse_args(argv)
    settings = Settings()
    if not settings.demo_mode:
        print("Refusing: DEMO_MODE is not true.", file=sys.stderr)
        return 2
    if not args.confirm:
        print("Preview only; no database opened or changed. --confirm restores the recorded funded")
        print("snapshot as a new version, preserving policy/history. ANY execution history refuses;")
        print("create a new isolated stage instead. No signing, dispatch or policy activation.")
        return 0
    engine = make_engine(settings.database_url)
    try:
        state = reset_demo(engine, settings)
    except DomainError as error:
        print(f"Reset refused: {error.message}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()
    print(f"Recorded funded snapshot appended as version {state.snapshot.version} ({state.id}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
