"""Only the executor may call this boundary after independent authorization."""

from typing import Protocol

from app.models.contracts import ChainTransaction


class TestnetSigner(Protocol):
    def sign(self, transaction: ChainTransaction) -> bytes:
        """Sign exact chain fields; implementation must independently restrict chain/selector."""
        ...


class ChainGateway(Protocol):
    def broadcast(self, signed_transaction: bytes) -> str: ...
    def receipt(self, tx_hash: str) -> dict | None: ...
