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
84532. Sender received 0.0001 faucet ETH; the confirmed observation is in the manifest. Earlier urllib
probes were refused (Forbidden); Windows PowerShell and the application Web3
transport succeeded. This is not evidence of a TLS certificate failure, and
certificate verification was never disabled.

## Funding and review gates

The signed-in Coinbase faucet delivered **0.0001 Base Sepolia ETH** to the sender.
Transaction: https://sepolia.basescan.org/tx/0x6375b1e0065ca77b4192e2c64231d2b090cdc562f0b13f788230d89f85211da7.
RPC verified chain 84532, receipt status 1, and recipient balance rising from
0 to 100,000,000,000,000 wei at block 48,204,654. This is a faucet batch
transaction: its top-level value is zero; the wallet balance delta is recorded
explicitly. No purchased, bridged or mainnet assets were used.

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
`token`, `deployment_receipt` and `mint_receipt` remain null until genuine
outcomes exist; the verified funding receipt is now recorded.

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

## Owner-requested independent replacement (2026-10-17)

The preceding wallet/manifest describe the original isolated checkout. Because
its keys were unavailable, the owner requested a fresh local setup. Historical
records are preserved; the active replacement observations are in
`evidence/base-sepolia-local-setup.json`.

Sender: `0xf0d37a0fa554c47154faaf418015e9898dd45f49`.
Recipient: `0x77c23f34012172d2a2cc08c7dcb404d2929c4a0b`.
MockUSD: `0x57e08de1ccc54e6f41d85d8a786b1ec061bea052`.
Owner-only keys remain in the ignored `.local/base-sepolia-local` folder in the
primary checkout. The isolated funded demo now has a matching verifier keyring; runtime signing
remains disabled and its chain signer key is empty.

Coinbase supplied 0.0001 free test ETH, independently verified on chain 84532.
After explicit source/fee acceptance, the exact reviewed MockUSD artifact was
deployed and 12,000 tokens minted. Both signed hashes were durably recorded in
private local journals before a single broadcast attempt. No replacement or
blind retry was used. RPC verified receipt status 1 with at least two confirmations,
exact deployed runtime bytes with the issuer immutable applied, issuer address,
six decimals, total supply and sender balance of 12,000,000,000 base units, and
the mint Transfer event. No vault or application-authorized transfer was deployed.

- [Funding](https://sepolia.basescan.org/tx/0xd0acf6d2201f55e14eb9357836a9cbf556e27b1fca33a89d11097e3254d5c071)
- [Deployment](https://sepolia.basescan.org/tx/0xc060c97d247570f2775cf1d8ca5d9cdf2fa08cb8f8d81cda1570d3d144ae46ec)
- [Mint](https://sepolia.basescan.org/tx/0x19151794a930e6111bf6c243eed11b46bc2f9099f8417990f9ee1c0ef4000880)

Accepted deployment execution limits: gas 577919, max fee 11000000 wei/gas,
priority 1000000 wei. Accepted mint gas limit: 83056 with the same fee settings.
Before each signing, observed L1 fee upper-bound estimate was below the accepted
1000000 wei threshold and operator fee was zero. L1 estimates are observations,
not enforceable EIP-1559 fee caps. Actual gas used was 476649 and 68359 respectively.
Actual deployment plus mint cost was 3270048273073 wei, including receipt L1
fees of 259664 and 13409 wei. Remaining native balance at this observation was
96729951726927 wei.

On 2026-10-18 (Asia/Dhaka), the owner separately accepted the application-transfer
proposal: gas limit 62374, max fee 11000000 wei/gas, priority 1000000 wei/gas,
observed L1 estimate below 1000000 wei and zero observed operator fee. Read-only
transfer estimates for 10000, 1000000 and 12000000000 base units were 51966,
51978 and 51768 gas. The proposal's L1 estimate was 3108 wei at block 48245950;
these observations are not an enforceable L1 fee cap.

The separately approved synthetic funded database is provisioned without changing
the original baseline. Constitution confirmation and exact applicable certificate
consent remain pending. Provisioning receipts do not prove PF-014/PF-015
application-authorized execution or acceptance.
