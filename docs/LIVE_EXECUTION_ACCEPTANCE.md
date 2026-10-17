# Authenticated Base Sepolia execution evidence

On 2026-10-18 (Asia/Dhaka), the owner explicitly confirmed the saved Constitution
(policy digest `93ce8caca9ad60215c651c868aae4d1366d38fd74bbf26517460c0dcb9b66d22`),
then separately approved the exact certificate and instructed execution. The
previously approved isolated runtime was enabled only after that confirmation.
Original wallets, provisioning receipts, baseline and database were preserved.

Real authenticated API calls (no substituted RPC/services) produced an optimizer
maximum of $2,000 synthetic allocation. The next cent failed the 25% concentration
cap. All four named stresses passed under the previously approved hypothetical
simulation configuration. These inputs and outcomes are demonstration arithmetic,
not calibrated real-world probabilities or investment performance.

The verifier issued `cert-48d8c6f9-c0b0-42c1-8cfd-a1cae45664dd`, certificate hash
`c8660eb76bf2e7d5a6e8003fac0c640cc86387d85116fc672491ebc7f472b2ae`. The owner
approved this exact certificate before expiry. Authenticated `/approvals` recorded
that decision; `/execute` independently validated, claimed, signed, durably stored
and dispatched exactly 2,000 MockUSD (2,000,000,000 base units), nonce 2.

[Confirmed transfer](https://sepolia.basescan.org/tx/0x74da3bb8b2ce5f7fe53754b4413c1e591c9941eac6b528f34afaeb2b25a01e49)
landed in block 48247109. Independent RPC inspection verified successful receipt,
exact sender/token/calldata/recipient/amount and the ERC-20 Transfer event. Sender
and recipient balances at that block were 10,000 and 2,000 tokens. The native
value was zero. Gas used was 51585 at 6000000 wei/gas; receipt L1 fee 174 wei.
Pre-execution conservative L1 observation was 482 wei and operator fee zero,
within the separately accepted observation threshold. L1 observations are not
enforceable EIP-1559 fee caps.

Reconciliation returned CONFIRMED after seven confirmations. A subsequent identical
request returned the same execution/hash with 30 confirmations and state still at
version 3. The ledger applied exactly once: cash $14,999, nonliquid high-risk
allocation $2,000, synthetic planning fee $1. One execution, one private signed
envelope and consumed exact approval were verified. Audit hashes/links verified;
exactly one EXECUTION_LEDGER_APPLIED event exists. No raw signed bytes or secrets
are published. Machine-readable observations are in
`evidence/base-sepolia-application-execution.json`. The original public signed
certificate is preserved in `evidence/base-sepolia-application-certificate.json`;
its Ed25519 signature was verified against the recorded public key.

Actual authenticated HTTP checks also rejected an altered action digest and unknown
certificate (409 INVALID_CERTIFICATE), replay using a new idempotency key (409
CONFLICT), and unauthenticated execution (401 UNAUTHORIZED). Execution/envelope/state
counts remained 1/1/3 throughout; no new signing/ledger artifact appeared.

This is backend/API live transfer evidence on reviewed main 81865d8. It does not
complete the browser journeys, scenarios B/C, public workflow, recovery operator
tooling or full AT-01..AT-12 suite. The old chain-status placeholder is tracked
separately in #91. PF-014/PF-015 completion and dependent unblocking require lead
review of this evidence and their remaining acceptance scope; they remain open.
