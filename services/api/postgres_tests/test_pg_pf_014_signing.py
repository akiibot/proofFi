"""Reuse existing test_pf_014_signing assertions against the real PostgreSQL database fixture.

Chain adapters remain isolated tests; no live transaction evidence is claimed.
"""

from test_pf_014_signing import *  # noqa: F403
