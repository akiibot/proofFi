# PF-015 internal receipt and planning-ledger reconciliation

This service is internal and is not wired to public `/execute`. It never signs,
sends, replaces or rebroadcasts a transaction. Its input identifies an existing
permanent claim and immutable signed-envelope journal entry, not new authority.
Tests substitute RPC in isolated databases; they are not live-chain evidence.

## Receipt boundary

Reconciliation authenticates the certificate at its original claim timestamp,
checks the historical state/policy/configuration, consumed approval, independent
risk recomputation, stored artifacts, complete audit chain, actual recovered EVM
signature/fields and computed keccak hash. Current financial/policy heads may have
advanced and the certificate may now be expired. Historical verification only
identifies the already dispatched attempt; it does not permit another send/sign.
Old public verifier keys must remain available to authenticate that history.

The configured RPC must report Base Sepolia 84532 before and after observation.
The raw receipt must bind the known hash, sender and token contract. Successful
canonical receipts require exactly one matching ERC-20 Transfer event with the
certified sender, destination and base-unit amount, matching transaction/block
hashes and no removed flag. Canonical block identity is checked again after
reading chain height. At least two confirmations are required; an operator may
select a larger internal threshold on the first poll. That audited threshold is
fixed for the attempt; later changes, including reductions, are refused.

No receipt means PENDING for an attempt never observed in a block, or REORGED if
it was previously included. A noncanonical/changing block, future block or loss
of a previously achieved confirmation threshold remains explicit. Reverted
canonical receipts become FAILED. RPC outages, invalid receipts and unknown
verifier keys raise sanitized errors and preserve the last stored outcome/hash.
There is no claim that a trusted RPC cannot lie, or that confirmations prevent
all future reorgs. Continue polling previously confirmed attempts to detect them.

## Synthetic accounting

Execution, audit and planning state commit in one serialized SQLite transaction.
A savepoint prevents a recoverable ledger conflict from leaving a partial debit.
The active ledger-effect audit prevents concurrent/repeated polling from applying
the same effect twice. Repeated identical observations do not create new states.

The accounting follows the approved risk model: debit action cents plus the
certificate's explicit synthetic fee from liquid, non-high-risk assets, ordered
by stable ID. TEST_TOKEN_ALLOCATION adds a non-liquid high-risk synthetic position
of the action amount. TRANSFER only debits. These are planning records, not income,
investment returns, real token valuations, or a native-gas-to-USD conversion.
Actual gas remains a separate chain cost; no ETH/USD price is invented.

A confirmed receipt with insufficient synthetic cash or a conflicting asset ID
remains CONFIRMED with an explicit CONFLICT error, without inventing funds or a
successful ledger adjustment. A later poll can retry accounting against a valid
current state without sending or signing again.

If confirmation is lost, an unchanged immediately resulting planning state can
be reversed by appending a new version of its pre-execution state. No old row is
rewritten/deleted. Reconfirmation can apply one new active effect; it does not
accumulate duplicate active allocations. If later financial edits exist, the
service preserves them and records a manual recovery conflict instead of restoring
an old snapshot over them. Automatic repair across later financial edits is not
implemented.

## Remaining activation gates

There is no scheduler, public execution route, automatic rebroadcast or manual
recovery API in this slice. The internal service refuses new signing while another attempt is PENDING or
REORGED, or any execution has an accounting error. It repeats those checks under
the handoff/dispatch writer lock, allowing only the current attempt's reservation. A conflict that
races an already prepared transaction therefore cannot reach another send.
PF-014's eventual public integration must use these guarded services; standalone
claim/signing helpers alone do not provide the complete activation gate. PF-015 remains
open for full route integration and genuine testnet execution/receipt evidence;
PF-026 AT-01 cannot be completed by these fixtures or a READY chain status.
