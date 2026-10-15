"""Offline chain signing boundary. Only the authorized executor may invoke it."""

import os
from typing import Annotated, Literal

from eth_account import Account
from pydantic import Field, SecretStr, model_validator
from web3 import Web3

from app.core.errors import DomainError
from app.models.contracts import Address, ChainTransaction, Contract, ErrorCode, UInt256


class TestnetPolicy(Contract):
    """Trusted operational allowlist; never constructed from client/planner input."""

    chain_id: Literal[84532] = 84532
    wallet_address: Address
    token_address: Address
    recipient: Address
    token_decimals: Annotated[int, Field(strict=True, ge=2, le=18)]
    max_gas_limit: Annotated[int, Field(strict=True, ge=21000, le=1000000)]
    max_fee_per_gas_wei: UInt256

    @model_validator(mode="after")
    def bounded_policy(self):
        if not 0 < int(self.max_fee_per_gas_wei) < 2**256:
            raise ValueError("Fee ceiling must be positive uint256")
        if any(
            address == "0x" + "0" * 40
            for address in (self.wallet_address, self.token_address, self.recipient)
        ):
            raise ValueError("Zero address is not an approved destination")
        return self

    def validate_transaction(self, transaction: ChainTransaction) -> ChainTransaction:
        value = ChainTransaction.model_validate_json(transaction.model_dump_json())
        if (
            value.chain_id,
            value.sender,
            value.token_address,
            value.recipient,
            value.token_decimals,
        ) != (
            self.chain_id,
            self.wallet_address,
            self.token_address,
            self.recipient,
            self.token_decimals,
        ):
            raise DomainError(ErrorCode.POLICY_DENIED, "Transaction outside signer allowlist", 403)
        if value.gas_limit > self.max_gas_limit or int(value.max_fee_per_gas_wei) > int(
            self.max_fee_per_gas_wei
        ):
            raise DomainError(
                ErrorCode.POLICY_DENIED, "Transaction exceeds signing fee ceiling", 403
            )
        return value


class LocalTestnetSigner:
    def __init__(self, private_key: SecretStr, policy: TestnetPolicy):
        self.policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
        try:
            self._account = Account.from_key(private_key.get_secret_value())
            if self._account.address.lower() != self.policy.wallet_address:
                raise ValueError("Wrong wallet")
        except (ValueError, TypeError):
            raise DomainError(
                ErrorCode.CHAIN_NOT_CONFIGURED,
                "Dedicated signer key/wallet configuration is invalid",
            ) from None

    @classmethod
    def from_environment(cls, policy: TestnetPolicy):
        value = os.environ.get("SIGNER_PRIVATE_KEY")
        if not value:
            raise DomainError(
                ErrorCode.CHAIN_NOT_CONFIGURED, "Dedicated testnet signing key is not configured"
            )
        return cls(SecretStr(value), policy)

    def sign(self, transaction: ChainTransaction) -> bytes:
        value = self.policy.validate_transaction(transaction)
        result = self._account.sign_transaction(
            {
                "type": 2,
                "chainId": value.chain_id,
                "to": Web3.to_checksum_address(value.to),
                "value": 0,
                "data": value.data,
                "nonce": value.nonce,
                "gas": value.gas_limit,
                "maxFeePerGas": int(value.max_fee_per_gas_wei),
                "maxPriorityFeePerGas": int(value.max_priority_fee_per_gas_wei),
                "accessList": [],
            }
        )
        return bytes(result.raw_transaction)
