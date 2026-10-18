from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./prooffi.db"
    api_token: SecretStr = SecretStr("")
    demo_mode: bool = True
    demo_password_hash: SecretStr = SecretStr("")
    trusted_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    cookie_secure: bool = False
    deployment_mode: Literal["local", "public"] = "local"

    @model_validator(mode="after")
    def secure_deployment(self):
        from urllib.parse import urlsplit

        if not self.trusted_origins:
            raise ValueError("At least one exact trusted origin required")
        for origin in self.trusted_origins:
            value = urlsplit(origin)
            if (
                value.scheme not in ("http", "https")
                or not value.netloc
                or value.path
                or value.query
                or value.fragment
                or value.username
            ):
                raise ValueError("Trusted origin must be an exact HTTP(S) origin")
            if self.deployment_mode == "public" and value.scheme != "https":
                raise ValueError("Public deployment requires HTTPS origins")
        if self.deployment_mode == "public" and not self.cookie_secure:
            raise ValueError("Public deployment requires secure cookies")
        return self

    extension_ids: list[str] = []

    @field_validator("extension_ids")
    @classmethod
    def validate_extension_ids(cls, values):
        import re
        if len(values) > 8 or any(re.fullmatch(r"[a-p]{32}", v) is None for v in values):
            raise ValueError("Explicit Chromium extension IDs required")
        return values

    chain_id: Literal[84532] = 84532

    @field_validator("chain_id", mode="before")
    @classmethod
    def parse_chain_id(cls, value):
        # Environment values are strings; retain an exact testnet-only allowlist.
        return 84532 if value == "84532" else value
