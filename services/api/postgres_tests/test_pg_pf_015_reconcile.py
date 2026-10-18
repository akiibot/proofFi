"""Reuse existing test_pf_015_reconcile assertions against the real PostgreSQL database fixture.

Chain adapters remain isolated tests; no live transaction evidence is claimed.
"""

from test_pf_015_reconcile import *  # noqa: F403
