# Base Sepolia provisioning — issue #66

Prepared for lead review; no wallet signing or Base deployment is enabled.
Preserves Base Sepolia chain 84532 and the ERC-20 transfer-only architecture.
The older Ethereum Sepolia vault deployment/receipts remain separate evidence.

## Actual local setup

New sender: `0x1ffafb19a2fbd546e5126da4784247b9416a2895`.
New team-controlled recipient: `0xd04f99ec5aea576452823dd7283786717dddee6e`.
Both are dedicated test wallets. Their keys and a fresh verifier key are in
`.local/base-sepolia/wallets.private.json` in the isolated completion checkout:
parent mode 0700, private file mode 0600, ignored by Git. No key is in this PR.
The verifier public key and key ID are evidence only; no runtime keyring or
signer credential has been enabled. Existing Gemini credentials are untouched.

Web3 over TLS successfully reads https://sepolia.base.org and requires chain
84532. Sender balance is zero at the observation in the manifest. Earlier urllib
probes were refused (Forbidden); Windows PowerShell and the application Web3
transport succeeded. This is not evidence of a TLS certificate failure, and
certificate verification was never disabled.

## Funding and review gates

The user must sign into https://portal.cdp.coinbase.com/products/faucet and request
free **Base Sepolia ETH** for the sender. No purchased, bridged or mainnet assets.
Record the real funding transaction and verify its chain, receipt and sender
balance before proceeding. The faucet is currently at a login screen.

The lead must review `contracts/testnet/MockUSD.sol`, derived from the existing
legacy MockUSD source. Only MockUSD is compiled/deployed: no vault, approvals or
legacy signing adapter is imported. Solidity 0.8.24, optimizer enabled/200 runs,
Paris EVM; source SHA-256 and creation-bytecode keccak are in the manifest.
Compiler settings include ABI, creation/runtime bytecode and immutable references.
The issuer immutable must be checked against the actual deployer after deployment.

The read-only RPC deployment estimate and proposed 20% gas headroom/twice-base-fee
plus observed priority fee are recorded for operator review. Neither the source
review nor the fee proposal is accepted yet. These are deployment observations,
not configured ERC-20 transfer fee caps. Re-estimate after funding and before
approval; changing network conditions must not silently expand accepted ceilings.

After source and fee acceptance, the lead may deploy only MockUSD on chain
84532, verify bytecode and issuer/decimals, and mint exactly 12,000 demonstration
tokens (12,000,000,000 base units). Persist real hashes before polling and resume
ambiguous broadcasts by hash/nonce without signing replacements blindly. Record
confirmed deployment/mint receipts, observed code hash and actual balances.
`token`, `funding_receipt`, `deployment_receipt` and `mint_receipt` intentionally
remain null until genuine outcomes exist.

## Runtime handoff after deployment

Use the actual lowercase sender/token/recipient in existing runtime settings and
VERIFIER_TRANSACTION_CONFIG_JSON. Require agreement across optimizer, verifier
and signer; decimals must be independently read as 6. Derive ERC-20 transfer gas
and fee proposals from an actual approved token/recipient, then obtain operator
acceptance. Keep SIGNER_PRIVATE_KEY unavailable until approval; never configure
an illustrative token address, signing key from tests or an automatic risk config.

The lead still owns PF-014/PF-015 executor/broadcast/reconciliation. This source
and wallet preparation cannot make POST /execute ready. Farid's attack/emergency
acceptance must use that real implementation after reviewed integration.

## Evidence and validation

`evidence/base-sepolia-setup.json` records public observations and honest pending
states. Local EVM checks passed against this exact compiled MockUSD-only artifact:
deploy, 6 decimals, issuer binding, 12,000-token mint, nonissuer mint rejection,
exact 1-token transfer/event/balances. Local EVM receipts are not Base evidence.
Full repository check and source/secret scans are recorded in PROGRESS.md below.
No current financial snapshot, confirmed policy, income or risk assumptions changed.

Official references: https://docs.base.org/get-started/get-funds and
https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId.
