"""Isolated adapter tests: no live RPC or actual broadcast evidence."""

from types import SimpleNamespace

import pytest
from app.core.errors import DomainError
from app.models.contracts import ChainTransaction
from eth_account import Account
from eth_account.typed_transactions import TypedTransaction
from hexbytes import HexBytes
from pydantic import SecretStr, ValidationError
from web3 import Web3
from web3.exceptions import TransactionNotFound

# Public test-only private key. Never configured at runtime.
KEY = "01" * 32
WALLET = Account.from_key(KEY).address.lower()
TOKEN = "0x" + "1" * 40
RECIPIENT = "0x" + "2" * 40


def signing():
    from app.execution import signer

    return signer


def policy():
    return signing().TestnetPolicy(
        wallet_address=WALLET,
        token_address=TOKEN,
        recipient=RECIPIENT,
        token_decimals=6,
        max_gas_limit=150000,
        max_fee_per_gas_wei="1000",
    )


def transaction():
    return ChainTransaction(
        chain_id=84532,
        sender=WALLET,
        to=TOKEN,
        token_address=TOKEN,
        recipient=RECIPIENT,
        token_decimals=6,
        amount_base_units="100000000",
        value_wei="0",
        data="0xa9059cbb" + RECIPIENT[2:].rjust(64, "0") + f"{100000000:064x}",
        nonce=7,
        gas_limit=100000,
        max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
        intention="test allocation to an approved demo destination",
    )


def test_signs_exact_type2_transaction_and_recovers_expected_wallet():
    signer = signing().LocalTestnetSigner(SecretStr(KEY), policy())
    raw = signer.sign(transaction())
    decoded = TypedTransaction.from_bytes(HexBytes(raw)).as_dict()
    assert Account.recover_transaction(raw).lower() == WALLET
    assert decoded["chainId"] == 84532 and decoded["nonce"] == 7
    assert decoded["value"] == 0 and decoded["gas"] == 100000
    assert decoded["maxFeePerGas"] == 100 and decoded["maxPriorityFeePerGas"] == 1
    assert decoded["to"] == HexBytes(TOKEN)
    assert decoded["data"] == HexBytes(transaction().data)
    assert KEY not in repr(signer)


@pytest.mark.parametrize(
    "field,value",
    [
        ("chain_id", 1),
        ("sender", "0x" + "3" * 40),
        ("recipient", "0x" + "3" * 40),
        ("token_address", "0x" + "3" * 40),
        ("gas_limit", 150001),
        ("max_fee_per_gas_wei", "1001"),
        ("data", "0x"),
        ("token_decimals", 18),
        ("value_wei", "1"),
    ],
)
def test_signer_revalidates_and_rejects_disallowed_fields(field, value):
    signer = signing().LocalTestnetSigner(SecretStr(KEY), policy())
    with pytest.raises((DomainError, ValidationError, ValueError)):
        signer.sign(transaction().model_copy(update={field: value}))


def test_private_key_must_match_configured_wallet():
    with pytest.raises(DomainError):
        signing().LocalTestnetSigner(SecretStr("02" * 32), policy())


def test_unconfigured_signer_fails_closed(monkeypatch):
    monkeypatch.delenv("SIGNER_PRIVATE_KEY", raising=False)
    with pytest.raises(DomainError) as error:
        signing().LocalTestnetSigner.from_environment(policy())
    assert error.value.code == "CHAIN_NOT_CONFIGURED"


class RpcFixture:
    """Minimal explicit in-memory transport; never used by application runtime."""

    chain_id = 84532
    block_number = 12

    def __init__(self):
        self.sent = []
        self.failure = None
        self.receipt_value = None

    def send_raw_transaction(self, raw):
        self.sent.append(raw)
        if self.failure:
            raise self.failure
        return Web3.keccak(raw)

    def get_transaction_receipt(self, tx_hash):
        if self.receipt_value is None:
            raise TransactionNotFound("test-only pending")
        return self.receipt_value

    def get_block(self, number):
        return {"hash": HexBytes("0x" + "a" * 64)}


def gateway(eth=None):
    from app.execution.rpc import EvmGateway

    eth = eth or RpcFixture()
    return EvmGateway(SimpleNamespace(eth=eth), policy(), confirmations_required=2), eth


def signed():
    return signing().LocalTestnetSigner(SecretStr(KEY), policy()).sign(transaction())


def test_broadcast_returns_only_node_acknowledged_matching_hash():
    adapter, eth = gateway()
    raw = signed()
    assert adapter.broadcast(raw) == "0x" + Web3.keccak(raw).hex().removeprefix("0x")
    assert eth.sent == [raw]


def test_wrong_rpc_chain_never_broadcasts():
    adapter, eth = gateway()
    eth.chain_id = 1
    with pytest.raises(DomainError):
        adapter.broadcast(signed())
    assert eth.sent == []


def test_gateway_rejects_arbitrary_raw_bytes_before_broadcast():
    adapter, eth = gateway()
    with pytest.raises(DomainError):
        adapter.broadcast(b"not-signed-ethereum-data")
    assert eth.sent == []


def test_gateway_independently_rejects_different_recipient():
    from app.execution.rpc import EvmGateway

    adapter, eth = gateway()
    other_policy = policy().model_copy(update={"recipient": "0x" + "4" * 40})
    adapter = EvmGateway(SimpleNamespace(eth=eth), other_policy)
    with pytest.raises(DomainError):
        adapter.broadcast(signed())
    assert eth.sent == []


def test_ambiguous_broadcast_preserves_local_hash_and_never_retries():
    from app.execution.rpc import BroadcastUncertain

    adapter, eth = gateway()
    eth.failure = TimeoutError("test-only timeout with private RPC credentials")
    raw = signed()
    with pytest.raises(BroadcastUncertain) as error:
        adapter.broadcast(raw)
    assert error.value.tx_hash == "0x" + Web3.keccak(raw).hex().removeprefix("0x")
    assert len(eth.sent) == 1
    assert "credentials" not in str(error.value)


def test_pending_receipt_is_none():
    adapter, _ = gateway()
    assert adapter.receipt("0x" + "b" * 64) is None


@pytest.mark.parametrize(
    "status,block,expected", [(1, 12, "PENDING"), (1, 11, "CONFIRMED"), (0, 11, "FAILED")]
)
def test_receipt_confirmation_and_revert(status, block, expected):
    adapter, eth = gateway()
    eth.receipt_value = {
        "transactionHash": HexBytes("0x" + "b" * 64),
        "blockHash": HexBytes("0x" + "a" * 64),
        "blockNumber": block,
        "status": status,
    }
    result = adapter.receipt("0x" + "b" * 64)
    assert result["status"] == expected
    assert result["confirmations"] == 13 - block


def test_reorged_receipt_is_explicit():
    adapter, eth = gateway()
    eth.receipt_value = {
        "transactionHash": HexBytes("0x" + "b" * 64),
        "blockHash": HexBytes("0x" + "c" * 64),
        "blockNumber": 11,
        "status": 1,
    }
    assert adapter.receipt("0x" + "b" * 64)["status"] == "REORGED"


def test_node_hash_mismatch_is_uncertain_not_success():
    from app.execution.rpc import BroadcastUncertain

    adapter, eth = gateway()
    eth.send_raw_transaction = lambda raw: HexBytes("0x" + "0" * 64)
    with pytest.raises(BroadcastUncertain):
        adapter.broadcast(signed())


def test_receipt_rpc_failure_does_not_become_failed_or_confirmed():
    adapter, eth = gateway()

    def unavailable(tx_hash):
        raise TimeoutError("private provider detail")

    eth.get_transaction_receipt = unavailable
    with pytest.raises(DomainError) as error:
        adapter.receipt("0x" + "b" * 64)
    assert error.value.code == "UNAVAILABLE"
    assert "private provider" not in error.value.message


def test_wrong_receipt_hash_fails_closed():
    adapter, eth = gateway()
    eth.receipt_value = {
        "transactionHash": HexBytes("0x" + "c" * 64),
        "blockHash": HexBytes("0x" + "a" * 64),
        "blockNumber": 11,
        "status": 1,
    }
    with pytest.raises(DomainError):
        adapter.receipt("0x" + "b" * 64)


def test_real_web3_provider_factory_has_timeout_and_no_retries():
    from app.execution.rpc import EvmGateway

    adapter = EvmGateway.from_rpc_url("http://127.0.0.1:8545", policy())
    assert isinstance(adapter.web3, Web3)
    assert adapter.web3.provider.exception_retry_configuration is None
    assert adapter.web3.provider._request_kwargs["timeout"] == 5


def test_policy_cannot_enable_mainnet_or_zero_address():
    with pytest.raises(ValidationError):
        policy().model_copy(update={"chain_id": 1}).model_validate_json(
            policy().model_copy(update={"chain_id": 1}).model_dump_json()
        )
    with pytest.raises(ValidationError):
        signing().TestnetPolicy(**{**policy().model_dump(), "recipient": "0x" + "0" * 40})
