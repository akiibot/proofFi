"""Isolated fixture crypto, using PUBLIC test keys. Never reads runtime keys/RPC.

Decode the actual EIP-1559 bytes produced by the real executor. Ethereum Keccak,
sender recovery and transfer fields are derived from those bytes, not invented.
"""

import json
import sys
from pathlib import Path

from app.core.auth import hash_password
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from eth_account import Account
from eth_account.typed_transactions import TypedTransaction
from hexbytes import HexBytes
from web3 import Web3

if sys.argv[1:] == ["runtime"]:
    public = json.loads(Path(__file__).with_name("test-credentials.json").read_text())
    key = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(public["verifier_key"]))
    print(json.dumps({
        "wallet": Account.from_key(public["signer_key"]).address.lower(),
        "password_hash": hash_password(public["password"]),
        "verifier_public": key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        ).hex(),
    }))
else:
    raw = HexBytes(sys.stdin.read().strip())
    if not raw or raw[0] != 2:
        raise SystemExit("Isolated fixture accepts EIP-1559 bytes only")
    transaction = TypedTransaction.from_bytes(raw).as_dict()
    print(json.dumps({
        "hash": "0x" + Web3.keccak(raw).hex().removeprefix("0x"),
        "sender": Account.recover_transaction(raw).lower(),
        "to": "0x" + transaction["to"].hex().removeprefix("0x"),
        "data": "0x" + transaction["data"].hex().removeprefix("0x"),
        "chain_id": transaction["chainId"], "nonce": transaction["nonce"],
        "value": transaction["value"], "access_list": transaction["accessList"],
    }))
