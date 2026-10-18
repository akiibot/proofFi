"""Reuse existing test_pf_032_dispatch assertions against the real PostgreSQL database fixture.

Chain adapters remain isolated tests; no live transaction evidence is claimed.
"""

from test_pf_032_dispatch import *  # noqa: F403
