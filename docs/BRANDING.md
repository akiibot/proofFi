# Vallet project name

The owner renamed the project from ProofFi to **Vallet** in issue #145. Current
product copy, the V wordmark, page/API titles, downloaded report filenames,
planner identity, npm/Python packages and maintained documentation use Vallet.
OpenAPI is regenerated from FastAPI; only its display title changes. API paths,
schema versions and financial contracts are unchanged.

Some old names are compatibility identifiers or historical facts, not current
branding. They remain intentional:

- `ProofFi.ActionCertificate.v1` is the exact v1 signing domain. Changing it
  would invalidate existing certificates. Canonical serialization stays identical.
- `prooffi_session` and `prooffi.*` browser storage keys preserve sessions and
  approval/execution request identities, including uncertain outcomes.
- `prooffi.db`, `prooffi_private`, existing deployment names/URLs and environment
  variable names preserve existing databases, configuration and hosting.
- GitHub remains `akiibot/proofFi`; its issue, PR and commit links stay valid.
  New clone instructions explicitly choose a `vallet` directory.
- The already deployed token still reports `ProofFi Demo USD`. This change does
  not deploy a token or rewrite recorded on-chain evidence.
- Original specifications in `docs/reference/`, Figma collection names, historical
  branch/file paths and immutable evidence (including recordings, receipts and
  certificates) retain their original names and contents.

No database migration, authentication change, policy activation, transfer or
deployment is part of the rename. Pending extension branches should retain their
existing Vallet identity and use these renamed packages/copy when rebasing.
