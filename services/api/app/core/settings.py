from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./prooffi.db"
    api_token: SecretStr = SecretStr("")
    demo_mode: bool = True
    chain_id: Literal[84532] = 84532

    @field_validator("chain_id", mode="before")
    @classmethod
    def parse_chain_id(cls, value):
        # Environment values are strings; retain an exact testnet-only allowlist.
        return 84532 if value == "84532" else value
