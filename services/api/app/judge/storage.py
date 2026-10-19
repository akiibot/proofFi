"""Exclusive ownership of the dedicated transient directory, including rolling restarts."""

import os
from pathlib import Path


class DirectoryLock:
    def __init__(self, root: Path):
        if root.is_symlink() or any(p.is_symlink() for p in root.parents):
            # macOS /var aliases resolve before validation at registry construction.
            raise ValueError("Judge storage must not use symlink paths")
        root.mkdir(parents=True, mode=0o700, exist_ok=True)
        root.chmod(0o700)
        path = root / ".owner.lock"
        if path.is_symlink():
            raise ValueError("Unsafe judge lock")
        self.file = path.open("a+b")
        if path.stat().st_size == 0:
            self.file.write(b"0")
            self.file.flush()
        self.file.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.file.close()
            raise ValueError("Judge storage already owned by another process") from None

    def close(self):
        if self.file.closed:
            return
        if os.name == "nt":
            import msvcrt

            self.file.seek(0)
            msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(self.file.fileno(), fcntl.LOCK_UN)
        self.file.close()
