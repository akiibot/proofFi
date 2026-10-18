# Chain and transaction contract

**Current status:** testnet signing, dispatch, reconciliation and genuine browser receipt evidence are integrated; see [the evidence index](../evidence/README.md). A fresh checkout intentionally has no operational chain configuration. Supported network: Base Sepolia (`84532`); chain ID verified against [Base documentation](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId). Public RPC may be used for testing but availability is not guaranteed.

One action: ERC-20 `transfer(address,uint256)` selector `0xa9059cbb`. Transaction `to` equals token contract, `value_wei` is zero, calldata must encode exactly the approved recipient and integer amount. Lowercase 20-byte hex addresses are canonical; chain adapters convert to checksum form at library boundaries. No arbitrary calls, unlimited token approvals, swaps or mainnet fallback.

Amounts in the planning ledger are integer cents. One synthetic dollar maps to one test-token unit: `amount_base_units = amount_minor * 10 ** (token_decimals - 2)`, with decimals 2..18 validated from the deployed contract. This is a demo allocation, not asset purchase/yield or real purchasing power. Schema example addresses are test fixtures and are not allowlisted.

Certificate binds sender, nonce, gas limit, maximum fee, priority fee and all call fields. Executor revalidates gas/balance and fee caps; changed fees/nonce require re-verification, never silent mutation. Synthetic fee assumption belongs to trusted SimulationConfig and is visible separately from actual native-gas spending. Signer/RPC implementations are integrated through PF-030 and PF-014/015; authoritative chain status claims READY only after live checks.

Required before real execution: chosen deployed test token and decimals, approved destination controlled by the demo team, funded dedicated test wallet, RPC URL, test tokens/native gas and verifier key. Configure locally in ignored environment or secret manager, not issue bodies or chat. Validate chain ID, deployed code and balances. Save genuine receipt + block/explorer reference to evidence only after execution.
