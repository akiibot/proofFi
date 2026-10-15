"""Exact signed-transaction transport. No key loading, automatic retries or API route."""

import re

from eth_account import Account
from eth_account.typed_transactions import TypedTransaction
from hexbytes import HexBytes
from web3 import Web3
from web3.exceptions import TransactionNotFound

from app.core.errors import DomainError
from app.execution.signer import TestnetPolicy
from app.models.contracts import ChainTransaction, ErrorCode


def hash_hex(value) -> str:
    return "0x" + HexBytes(value).hex().removeprefix("0x")


class BroadcastUncertain(DomainError):
    """Caller must persist this deterministic hash and reconcile, never re-sign."""

    def __init__(self, tx_hash: str):
        super().__init__(
            ErrorCode.UNAVAILABLE,
            "Broadcast outcome unknown; reconcile the existing signed transaction",
        )
        self.tx_hash = tx_hash


class EvmGateway:
    def __init__(self, web3: Web3, policy: TestnetPolicy, confirmations_required: int = 2):
        if type(confirmations_required) is not int or confirmations_required < 1:
            raise ValueError("At least one confirmation required")
        self.web3 = web3
        self.policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
        self.confirmations_required = confirmations_required

    @classmethod
    def from_rpc_url(cls, url: str, policy: TestnetPolicy, confirmations_required: int = 2):
        if not url or not url.startswith(("http://", "https://")):
            raise DomainError(ErrorCode.CHAIN_NOT_CONFIGURED, "HTTP testnet RPC URL required")
        # Explicitly disable provider-level retries, especially for ambiguous sends.
        provider = Web3.HTTPProvider(
            url, request_kwargs={"timeout": 5}, exception_retry_configuration=None
        )
        return cls(Web3(provider), policy, confirmations_required)

    def _assert_chain(self):
        try:
            chain_id = self.web3.eth.chain_id
        except Exception:
            raise DomainError(ErrorCode.UNAVAILABLE, "Testnet RPC unavailable") from None
        if chain_id != self.policy.chain_id:
            raise DomainError(
                ErrorCode.POLICY_DENIED, "RPC network does not match approved testnet", 403
            )

    def _validate_signed(self, raw: bytes):
        try:
            if not isinstance(raw, bytes) or not raw or raw[0] != 2:
                raise ValueError("Only EIP-1559 transactions allowed")
            decoded = TypedTransaction.from_bytes(HexBytes(raw)).as_dict()
            if decoded.get("accessList"):
                raise ValueError("Access lists are not approved")
            data = hash_hex(decoded["data"])
            if len(data) != 138 or not data.startswith("0xa9059cbb"):
                raise ValueError("Only exact ERC20 transfer calldata allowed")
            recipient = "0x" + data[10:74][-40:]
            transaction = ChainTransaction(
                chain_id=decoded["chainId"],
                sender=Account.recover_transaction(raw).lower(),
                to=hash_hex(decoded["to"]).lower(),
                token_address=self.policy.token_address,
                recipient=recipient,
                token_decimals=self.policy.token_decimals,
                amount_base_units=str(int(data[74:], 16)),
                value_wei=str(decoded["value"]),
                data=data,
                nonce=decoded["nonce"],
                gas_limit=decoded["gas"],
                max_fee_per_gas_wei=str(decoded["maxFeePerGas"]),
                max_priority_fee_per_gas_wei=str(decoded["maxPriorityFeePerGas"]),
                intention="test allocation to an approved demo destination",
            )
            self.policy.validate_transaction(transaction)
        except Exception:
            raise DomainError(
                ErrorCode.POLICY_DENIED,
                "Signed transaction outside testnet transport allowlist",
                403,
            ) from None

    def broadcast(self, signed_transaction: bytes) -> str:
        self._validate_signed(signed_transaction)
        self._assert_chain()
        expected = hash_hex(Web3.keccak(signed_transaction))
        try:
            acknowledged = hash_hex(self.web3.eth.send_raw_transaction(signed_transaction))
            if acknowledged != expected:
                raise ValueError("Node returned a different transaction hash")
        except Exception:
            # A timeout or rejection after send cannot safely prove non-broadcast.
            raise BroadcastUncertain(expected) from None
        return acknowledged

    def receipt(self, tx_hash: str) -> dict | None:
        if not re.fullmatch(r"0x[0-9a-f]{64}", tx_hash):
            raise DomainError(ErrorCode.INVALID_CERTIFICATE, "Malformed transaction hash", 409)
        self._assert_chain()
        try:
            try:
                receipt = self.web3.eth.get_transaction_receipt(tx_hash)
            except TransactionNotFound:
                return None
            block = receipt["blockNumber"]
            if (
                type(block) is not int
                or block < 0
                or hash_hex(receipt["transactionHash"]) != tx_hash
                or receipt["status"] not in (0, 1)
            ):
                raise ValueError("Invalid node receipt")
            canonical = self.web3.eth.get_block(block)
            latest = self.web3.eth.block_number
            confirmations = max(0, latest - block + 1)
            status = "PENDING"
            if hash_hex(canonical["hash"]) != hash_hex(receipt["blockHash"]) or block > latest:
                status = "REORGED"
            elif receipt["status"] == 0:
                status = "FAILED"
            elif confirmations >= self.confirmations_required:
                status = "CONFIRMED"
            return {
                "tx_hash": tx_hash,
                "block_number": block,
                "block_hash": hash_hex(receipt["blockHash"]),
                "confirmations": confirmations,
                "status": status,
            }
        except Exception:
            raise DomainError(
                ErrorCode.UNAVAILABLE,
                "Receipt unavailable; preserve pending execution for reconciliation",
            ) from None
