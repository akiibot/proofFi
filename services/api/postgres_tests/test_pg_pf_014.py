"""Reuse existing test_pf_014 assertions against the real PostgreSQL database fixture.

Chain adapters remain isolated tests; no live transaction evidence is claimed.
"""

from test_pf_014 import *  # noqa: F403
