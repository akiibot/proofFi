"""Read-only connectivity evidence; READY never grants execution authority."""

from pydantic import SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
from web3 import Web3

from app.models.contracts import Address, ChainStatus


class ReadSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    rpc_url: SecretStr
    wallet_address: Address
    test_token_address: Address


def read_status(*, settings=None) -> ChainStatus:
    try:
        settings = ReadSettings() if settings is None else settings
        url = settings.rpc_url.get_secret_value()
        if not url.startswith(("http://", "https://")):
            raise ValueError("HTTP RPC required")
    except (ValidationError, ValueError):
        return ChainStatus(
            status="CHAIN_NOT_CONFIGURED",
            reason="Read-only testnet settings are incomplete or invalid",
        )
    try:
        web3 = Web3(
            Web3.HTTPProvider(
                url, request_kwargs={"timeout": 5}, exception_retry_configuration=None
            )
        )
        if web3.eth.chain_id != 84532:
            raise ValueError("Wrong chain")
        block = web3.eth.block_number
        token = Web3.to_checksum_address(settings.test_token_address)
        wallet = Web3.to_checksum_address(settings.wallet_address)
        if not web3.eth.get_code(token, block_identifier=block):
            raise ValueError("Missing token code")
        decimals = web3.eth.call({"to": token, "data": "0x313ce567"}, block_identifier=block)
        balance = web3.eth.call(
            {"to": token, "data": "0x70a08231" + settings.wallet_address[2:].rjust(64, "0")},
            block_identifier=block,
        )
        if len(decimals) != 32 or not 2 <= int.from_bytes(decimals, "big") <= 18:
            raise ValueError("Invalid token decimals")
        if len(balance) != 32:
            raise ValueError("Invalid token balance")
        return ChainStatus(
            status="READY",
            reason="Read-only Base Sepolia token and wallet checks passed; execution authorization is separate",
            wallet_address=settings.wallet_address,
            token_balance_base_units=str(int.from_bytes(balance, "big")),
            native_balance_wei=str(web3.eth.get_balance(wallet, block_identifier=block)),
        )
    except Exception:
        # Provider exceptions may contain credential-bearing URLs or response bodies.
        return ChainStatus(status="UNAVAILABLE", reason="Read-only Base Sepolia checks unavailable")
