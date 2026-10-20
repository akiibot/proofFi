"""Isolated browser fixture: substitute only the external guest planner provider.

Real registry/auth/migrations/policy/simulation/verifier plus the existing loopback
chain fixture. This module is never imported by the production application.
"""

from dataclasses import replace

import app.judge.runtime as runtime
from app.planner.provider import Proposal

original = runtime.guest_runtime


def browser_runtime(registry, key):
    scoped = original(registry, key)

    def proposal(goal, context, settings):
        registry.reserve_provider(key)
        return Proposal(
            obligation_id="tuition",
            ambiguities=[],
            amounts_minor=[10000],
            reason="Isolated browser fixture external-provider reply; not live AI evidence.",
        )

    return replace(scoped, proposal_provider=proposal)


runtime.guest_runtime = browser_runtime
from app.main import app  # noqa: E402,F401
