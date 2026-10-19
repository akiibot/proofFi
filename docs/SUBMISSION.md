# Vallet submission guide

Vallet addresses a simple problem: a plausible AI financial suggestion should not by itself have authority to move money. The planner proposes a typed action; trusted policy, simulation and verification determine whether an exact action can receive a signed certificate. Explicit human approval and independent execution checks precede testnet signing.

## Start here

- **Run it:** [clean-checkout instructions](../README.md#clean-checkout), or the [hosted preview](https://prooffi-preview.vercel.app) with demo access supplied privately by the owner. Do not publish a shared password in the repository.
- **Watch it:** [2m50s raw walkthrough](../evidence/prooffi-browser-walkthrough.webm) with [script and provenance](DEMO_SCRIPT.md). This earlier UI recording demonstrates preserved A/C evidence; it predates the redesign.
- **See the redesigned UI:** [hosted captures and preservation evidence](../evidence/pf-049-hosted-readonly/README.md). These are read-only captures, not a new transfer.
- **Reproduce checks:** [test guide](TESTING.md), [AT-01 through AT-12](ACCEPTANCE_MATRIX.md), and [GitHub CI](https://github.com/akiibot/proofFi/actions/workflows/ci.yml). Each run applies to its own commit.
- **Understand the system:** [README Mermaid flow](../README.md#how-it-works), [architecture and data model](ARCHITECTURE.md), [risk methodology](RISK_METHODOLOGY.md) and [threat model](THREAT_MODEL.md).

## Three demonstrated scenarios

| Scenario | Expected behavior | Evidence |
|---|---|---|
| A — Goal to authorized execution | Proposal → largest safe amount → exact certificate → human approval → confirmed testnet receipt and audit | [Original browser execution](../evidence/base-sepolia-browser-execution.json); [separate hosted execution](../evidence/hosted-browser-execution.json) |
| B — Unsafe planner proposal | Controlled unsafe candidate is denied; no certificate, signer call or transaction | [Controlled refusal](../evidence/red-team-browser.json) |
| C — Emergency expense | A recorded expense changes state, invalidates stale authority and lowers the recomputed safe amount | [Emergency evidence](../evidence/emergency-browser.json); [walkthrough](DEMO_SCRIPT.md) |

The original synthetic baseline has $12,000 cash against $12,200 protected needs before fees and shocks. A positive allocation uses a separately selected $17,000 synthetic funded profile, with no invented income. The recorded comparison is $2,000 before the expense and $799 afterward. Inputs and probabilities are illustrative, not calibrated forecasts. Review [simulation assumptions](SIMULATION_METHOD.md) and the [funded setup](FUNDED_DEMO_SETUP.md).

## What to inspect in the implementation

| Concern | Entry point |
|---|---|
| Explicit policy confirmation and immutable versions | [Constitution lifecycle](CONSTITUTION_LIFECYCLE.md) |
| Planner cannot confer authority | [Architecture](ARCHITECTURE.md), [planner evidence](PLANNER_OPERATING_EVIDENCE.md) |
| Integer money and canonical signed evidence | [Decisions](DECISIONS.md), [certificates](CERTIFICATES.md) |
| Replay, expiry, concurrency and stale-state refusal | [Executor guards](EXECUTOR_GUARDS.md), [test guide](TESTING.md) |
| Exact receipt reconciliation and separate execution status | [Reconciliation](EXECUTION_RECONCILIATION.md) |
| Public deployment and durable private storage | [Deployment runbook](DEPLOYMENT.md) |

## Submission boundaries

This is a single-user Base Sepolia prototype with synthetic planning balances, not a production custody, investment or mainnet service. A controlled malicious proposal is a bounded rejection demonstration, not proof of general prompt-injection immunity. Sessions live in one API process and expire on restart. See [known limitations](KNOWN_LIMITATIONS.md).

The browser extension is tracked separately in [GitHub issues](https://github.com/akiibot/proofFi/issues); the core website evidence does not establish extension release completion. Historical counts, recordings and screenshots keep their original revision identities. Fixture confirmations never establish genuine chain transfers.

Use [the delivery artifact checklist](SUBMISSION_CHECKLIST.md) and [presentation outline](PRESENTATION_OUTLINE.md) for final packaging. The owner must still verify competition-specific eligibility, required fields, permitted assets, access delivery and upload requirements. No competition rules or final submission are assumed here. [PROGRESS.md](PROGRESS.md) remains the implementation status record.
