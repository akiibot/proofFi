"""Read-only chain limits for optimizer proposals; no signing-key access."""

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from web3 import Web3

from app.core.errors import DomainError
from app.execution.signer import TestnetPolicy
from app.models.contracts import Address, CandidateAction, ErrorCode
from app.optimizer.service import ChainBounds


class ChainSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    rpc_url: SecretStr
    wallet_address: Address
    test_token_address: Address
    approved_recipient: Address
    optimizer_gas_limit: int
    optimizer_max_fee_per_gas_wei: int


def load_chain_bounds(action: CandidateAction, *, settings=None) -> ChainBounds:
    try:
        settings = ChainSettings() if settings is None else settings
        if not settings.rpc_url.get_secret_value().startswith(("https://", "http://")):
            raise ValueError("HTTP RPC required")
        if (action.chain_id, action.token_address, action.recipient) != (
            84532,
            settings.test_token_address,
            settings.approved_recipient,
        ):
            raise DomainError(ErrorCode.POLICY_DENIED, "Action outside operational allowlist", 403)
        provider = Web3.HTTPProvider(
            settings.rpc_url.get_secret_value(),
            request_kwargs={"timeout": 5},
            exception_retry_configuration=None,
        )
        web3 = Web3(provider)
        if web3.eth.chain_id != 84532:
            raise DomainError(ErrorCode.POLICY_DENIED, "RPC is not Base Sepolia", 403)
        block = web3.eth.block_number
        token = Web3.to_checksum_address(settings.test_token_address)
        wallet = Web3.to_checksum_address(settings.wallet_address)
        if not web3.eth.get_code(token, block_identifier=block):
            raise ValueError("Token has no deployed code")
        decimals_raw = web3.eth.call({"to": token, "data": "0x313ce567"}, block_identifier=block)
        balance_raw = web3.eth.call(
            {"to": token, "data": "0x70a08231" + settings.wallet_address[2:].rjust(64, "0")},
            block_identifier=block,
        )
        if len(decimals_raw) != 32 or len(balance_raw) != 32:
            raise ValueError("Invalid token response")
        decimals = int.from_bytes(decimals_raw, "big")
        policy = TestnetPolicy(
            wallet_address=settings.wallet_address,
            token_address=settings.test_token_address,
            recipient=settings.approved_recipient,
            token_decimals=decimals,
            max_gas_limit=settings.optimizer_gas_limit,
            max_fee_per_gas_wei=str(settings.optimizer_max_fee_per_gas_wei),
        )
        header = web3.eth.get_block(block)
        if int(header["baseFeePerGas"]) > settings.optimizer_max_fee_per_gas_wei:
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Current network fee exceeds configured ceiling"
            )
        result = ChainBounds(
            int.from_bytes(balance_raw, "big") // 10 ** (decimals - 2),
            web3.eth.get_balance(wallet, block_identifier=block),
            policy.max_gas_limit,
            int(policy.max_fee_per_gas_wei),
        )
        result.validate()
        return result
    except DomainError:
        raise
    except Exception:
        # Provider errors can contain credential-bearing RPC URLs; never echo them.
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Trusted chain configuration or balance read unavailable"
        ) from None
