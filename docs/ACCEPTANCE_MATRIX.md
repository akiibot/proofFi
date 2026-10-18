# Acceptance gate matrix

Genuine A, B and C browser evidence is integrated. Acceptance #56 merged at
618ec98 after owner approval and both current Ubuntu/Windows jobs passed on
e28ce28 against main ([run39100947011](https://github.com/akiibot/proofFi/actions/runs/39100947011)).
Independent fresh-checkout full validation passed605 backend/92 browser on38a73dd.
Historical development hydration observations remain in #60; no universal causal
repair is claimed. The table names concrete proof, not readiness placeholders.

| Gate | Exact regression / integration proof | Genuine evidence where applicable |
|---|---|---|
| AT-01 goal through confirmed execution | `pf-026-acceptance.journey.spec.ts`: goal/proposal/safe/certificate/exact approval; actual executor crypto; one fixture dispatch; same-identity confirmed reconciliation and linked audit | `evidence/base-sepolia-browser-execution.json`, immutable certificate JSON, confirmed browser/audit images; actual tx [0xd13c…378d](https://sepolia.basescan.org/tx/0xd13c41c1141b22ab3604978582ee5643a06a9b83af360f8de8d76b7e46ad378d), block48253237; independent actual receipt/transaction/Transfer check recorded |
| AT-02 oversized deny/no certificate | Browser AT-02 checks real `/verify` DENY/null certificate and zero dispatch | Real policy/verifier, no route interception |
| AT-03 exact maximum/next cent | Browser AT-03 independently verifies optimizer action, then denies next cent; `test_pf_032_acceptance.py::test_optimizer_maximum_is_independently_certified_and_next_cent_denied` | Genuine A and C optimizer responses retain23 independent checks/next-cent refusal |
| AT-04 malicious proposal blocked | Browser AT-04: real controlled borrowed-funding attack route, DENY/null certificate, signer false/zero fixture dispatch; existing PF-031 tests | `evidence/red-team-browser.json` and images; explicitly controlled malicious proposal, not a claim of general LLM attack efficacy |
| AT-05 direct executor bypass denied | `test_pf_014_http.py::test_public_bypass_is_rejected_without_signing`; `test_pf_014.py` independent authorization/recomputation cases | Isolated backend security proof; no live unauthorized signing attempted |
| AT-06 tampering refuses signing | `test_pf_014_signing.py::test_unconfigured_or_tampered_certificate_never_reaches_signer`, `test_incorrect_actual_signer_output_is_rejected`; PF-012 signature/encoding tests and PF-014 action/state/nonce/fee/recipient/token/chain/calldata checks | Actual signed certificate remains immutable in A and C evidence |
| AT-07 replay/concurrency | `test_pf_014_http.py::test_concurrent_http_requests_sign_and_dispatch_at_most_once`, `test_http_ambiguous_dispatch_only_reconciles_existing_hash`; `test_pf_014_signing.py::test_concurrent_calls_sign_at_most_once`, same-wallet-nonce refusal; browser AT-01 checks one fixture send | Genuine A has three HTTP observations with the same identity but exactly one signature/envelope/dispatch/ledger effect |
| AT-08 state invalidates old authority | Browser AT-08/09 checks unchanged certificate/SIGNED_BUT_STALE/valid signature; `test_pf_032_acceptance.py::test_emergency_reduces_maximum_and_rejects_old_authorization` also exercises old executor authorization refusal | `evidence/emergency-browser.json`, `emergency-certificate-stale.png`: version2->3, original certificate unchanged, no live execution attempt |
| AT-09 emergency repricing | Browser AT-08/09 checks exact one expense/body, debit/version, lower maximum, unchanged policy/audit and zero fixture sends; existing PF-032 atomic failure/state preservation checks | Genuine C: HTTP200,200000-cent expense, safe maximum200000->79900,23 checks/next-cent refusal, seven-event intact audit, no approval/transfer/reset |
| AT-10 reproducibility/identity | Browser AT-10 same trusted input returns identical stored simulation/ID and displayed seed; existing PF-009/PF-044 exact-output/random-boundary tests | Actual signed evidence carries seed18421/config digest; PF-044 golden outputs derive from immutable prechange engine |
| AT-11 explicit policy/history | Browser AT-11 draft leaves active policy unchanged; checked confirmation activates exact digest and retains earlier history; existing PF-006/PF-019 tests | Explicitly authorized C activation and unchanged93ce…6d22 policy digest before/after expense |
| AT-12 secret isolation | Browser AT-12 scans actual HTML/scripts/responses/cookies/storage using nonempty backend canaries and private runtime values; tracked files scan private values. Existing `test_pf_017.py::test_express_api_key_is_header_only_and_never_uses_oauth` checks provider body/prompt and settings/error secrecy; PF-030/PF-033 secret/auth/session regressions | `evidence/key-isolation-browser.json`: eight actual private values,86 responses,19 production static files,312 tracked files,eight runtime logs; zero matches; HttpOnly/Strict cookie. Public endpoint documentation is not classified as a credential |

Browser regression uses a throwaway `.local/e2e.db`, explicitly public test keys,
real EVM signing/hash recovery and a loopback-only simulated chain. Its receipts,
blocks and balances are **isolated CI fixtures**, never live chain evidence.
Baseline tests run first; acceptance staging retains baseline and appends funded
state through the real state repository. Current application code/contracts and
all existing assertion budgets/workers/retries remain unchanged.

Fresh setup preparation (`evidence/fresh-setup-preparation.json`) used an independent
clone, Python3.11/Node22.19, locked bootstrap dependencies, own credentials, Chromium
and a successful migration drift check. The latest complete38a73dd full run passed and preserved its own credentials/baseline
database byte-for-byte; see evidence/acceptance-fresh-checkout.json. Both current hosted jobs and lead approval subsequently passed for the actual main integration target; #56 is merged.
