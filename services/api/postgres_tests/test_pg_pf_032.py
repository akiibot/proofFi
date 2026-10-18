"""Reuse existing test_pf_032 assertions against the real PostgreSQL database fixture.

Chain adapters remain isolated tests; no live transaction evidence is claimed.
"""

from test_pf_032 import *  # noqa: F403
