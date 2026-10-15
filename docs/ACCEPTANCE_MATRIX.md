# Acceptance gate matrix

All product acceptance gates remain **NOT YET IMPLEMENTED / NOT PASSED**. Passing foundation tests does not satisfy these end-to-end gates. No skipped placeholder tests are counted as evidence.

| Gate | Outcome | Issues | Status |
|---|---|---|---|
| AT-01 | Hero goal through real testnet execution | PF-015, PF-016, PF-026 | NOT PASSED |
| AT-02 | Oversized investment rejected without certificate | PF-007, PF-029 | NOT PASSED |
| AT-03 | Largest compliant amount and next-cent boundary | PF-010 | NOT PASSED |
| AT-04 | Malicious proposal blocked without signing | PF-031, PF-023 | NOT PASSED |
| AT-05 | Direct executor bypass denied | PF-014 | NOT PASSED |
| AT-06 | Amount/recipient/token/chain/calldata tamper fails | PF-012, PF-014 | NOT PASSED |
| AT-07 | Replay and concurrent claims rejected | PF-014 | NOT PASSED |
| AT-08 | State changes invalidate old certificate | PF-014, PF-032 | NOT PASSED |
| AT-09 | Emergency reduces safe allocation or explains no safe action | PF-032, PF-024 | NOT PASSED |
| AT-10 | Seed/config reproducibility and simulation identity | PF-009 | NOT PASSED |
| AT-11 | Explicit policy confirmation and immutable history | PF-006, PF-019 | NOT PASSED |
| AT-12 | Private-key isolation in browser/prompts/logs/repo | PF-030, PF-033, PF-026 | NOT PASSED |

PF-026 creates runnable tests for all gates. CI uses isolated chain adapters where appropriate; AT-01 also requires a separately run genuine funded testnet transaction and recorded receipt/explorer evidence. PF-028 packages evidence after all gates are verified.
