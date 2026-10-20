"""Package the built extension only; never includes local credentials or tests."""
import argparse
import hashlib
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--site", action="store_true", help="write the versioned ZIP to the website's public downloads")
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
source = root / "apps/extension/dist"
if not (source / "manifest.json").is_file():
    raise SystemExit("Run npm run build:extension first")
target = (root / "apps/web/public/downloads/vallet-extension-0.1.0.zip") if args.site else (root / ".local/releases/vallet-extension-0.1.0.zip")
target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for item in sorted(source.rglob("*")):
        if not item.is_file():
            continue
        if item.suffix in {".map", ".pem", ".key"} or item.name.startswith(".env"):
            raise SystemExit("Unexpected private/debug artifact in runtime")
        entry = zipfile.ZipInfo(item.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, item.read_bytes())
print(str(target))
print("SHA-256 " + hashlib.sha256(target.read_bytes()).hexdigest())
