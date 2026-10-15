# Testnet signer and transport

PF-030 supplies the concrete implementations of the approved TestnetSigner and ChainGateway interfaces. They are internal services; the public execute route remains disabled until independent executor authorization exists. No chain key, wallet, test token or destination is silently configured.

## Signing boundary

LocalTestnetSigner accepts a SecretStr private key and an explicit trusted TestnetPolicy. It verifies that the key derives the configured wallet and signs only revalidated EIP-1559 transactions for Base Sepolia 84532, the exact approved token/recipient, zero native value and exact ERC-20 transfer calldata. It enforces configured token decimals, gas ceiling and maximum fee ceiling. The certificate-bound amount/nonce/fees are never modified by the signer. No middleware signs arbitrary RPC requests.

TestnetPolicy is internal operational configuration, not a second public CandidateAction schema. It requires wallet, token, recipient, token decimals, maximum gas and maximum fee. No zero addresses or mainnet policy is accepted. The actual configured transaction must also satisfy the independent executor's certificate/approval and gas/token-balance checks; an allowlisted transaction alone is not authorization.

The explicit from_environment factory reads SIGNER_PRIVATE_KEY only inside the signer module. It is not called on API startup or by the planner. It refuses absent keys or a key/wallet mismatch. There is no default funded wallet, private-key generation or browser key handling. Python memory is not a hardware security module and this adapter is not production custody.

## Transport and uncertainty

EvmGateway.from_rpc_url creates a real web3.py HTTP provider with a five-second request timeout and provider retries disabled. The gateway decodes/revalidates signed type-2 bytes, recovers the sender, rejects access lists and unsupported fields/selectors, and independently checks the configured allowlist. It reads eth_chainId before broadcasting. No signing key is loaded by this module.

A successful broadcast returns only the node-acknowledged hash matching keccak(signed bytes). Any send exception or unexpected hash raises BroadcastUncertain containing the deterministic hash and a sanitized message. This hash identifies the attempted signed transaction; it is not evidence of inclusion or success. PF-015 must persist raw signed bytes/hash safely before broadcast, preserve pending state and reconcile rather than re-signing or blindly resubmitting. No RPC error details or provider credentials are echoed.

Receipt lookup returns None for TransactionNotFound, otherwise returns normalized tx/block hashes, block number, confirmations and PENDING/CONFIRMED/FAILED/REORGED status. It compares the receipt block hash against the current canonical block and defaults to two confirmations. Status 0 is a reverted transaction, not a successful allocation. RPC receipt failures remain UNAVAILABLE; they never become an invented failure/confirmation. Later reorgs require continued reconciliation by PF-015. A successful EVM receipt is not independently evidence that a nonstandard ERC-20 token transferred funds; token/Transfer-event and ledger reconciliation are required in PF-015.

The implementation follows [web3.py's offline signing and raw broadcast interface](https://web3py.readthedocs.io/en/v7.10.0/transactions.html). No auto-sign-and-send middleware is installed.

## Funding/configuration handoff

1. Select one dedicated Base Sepolia wallet and an actual deployed ERC-20 test token. Record the token address and query deployed bytecode/decimals; do not copy schema-fixture addresses.
2. Select an approved destination controlled by the demo team. Confirm it explicitly in policy, not in planner output.
3. Fund the wallet with native test ETH for gas and sufficient test tokens. Test assets have no asserted purchasing power. The one synthetic USD -> one test-token mapping is a demo unit convention.
4. Provide the key through ignored backend environment or a secret manager; configure the matching public wallet/token/destination, decimals and conservative operational gas/fee ceilings. RPC URL/auth credentials remain backend-only.
5. PF-014 independently authorizes and atomically claims a certificate before calling the signer. PF-015 preflights chain/code/nonce/fees/balances, persists the signed bytes/hash and reconciles the receipt/token event with the planning ledger.
6. Only after a genuine confirmed transaction save an explorer link, receipt/block and exact certificate mapping as live execution evidence.

## Validation status

27 adapter tests use real eth-account cryptography and signed EIP-1559 bytes. Transport outcomes are explicitly isolated in-memory RPC fixtures. On 2026-10-15, a separate read-only request to https://sepolia.base.org returned HTTP 200 and chain ID 84532. No signer key was provisioned and no broadcast was attempted. The full product remains CHAIN_NOT_CONFIGURED.
