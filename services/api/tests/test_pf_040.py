"""Actual authenticated route with isolated read-only RPC; no live-chain claim."""

from types import SimpleNamespace

import pytest
from app.execution import status

WALLET = "0x" + "12" * 20
TOKEN = "0x" + "34" * 20


@pytest.fixture
def rpc(monkeypatch):
    monkeypatch.setenv("RPC_URL", "https://rpc.invalid/PRIVATE_PROVIDER_CREDENTIAL")
    monkeypatch.setenv("WALLET_ADDRESS", WALLET)
    monkeypatch.setenv("TEST_TOKEN_ADDRESS", TOKEN)
    eth = SimpleNamespace(chain_id=84532, block_number=123)
    eth.get_code = lambda *args, **kwargs: b"code"
    eth.call = lambda tx, **kwargs: (6 if tx["data"] == "0x313ce567" else 12000000000).to_bytes(32, "big")
    eth.get_balance = lambda *args, **kwargs: 500000
    monkeypatch.setattr(status, "Web3", lambda provider: SimpleNamespace(eth=eth))
    status.Web3.HTTPProvider = lambda *args, **kwargs: None
    status.Web3.to_checksum_address = lambda value: value
    return eth


def test_authenticated_readiness_does_not_require_signer(client, rpc, monkeypatch):
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", "INVALID_MUST_NOT_BE_LOADED")
    monkeypatch.setenv("EXECUTION_ENABLED", "false")
    response = client.get("/chain/status")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "READY"
    assert body["wallet_address"] == WALLET
    assert body["token_balance_base_units"] == "12000000000"
    assert body["native_balance_wei"] == "500000"
    assert "authorization is separate" in body["reason"]


def test_unauthenticated_status_never_queries_rpc(client, rpc):
    client.cookies.clear()
    def forbidden(*args, **kwargs):
        pytest.fail("Unauthenticated RPC call")
    rpc.get_code = forbidden
    assert client.get("/chain/status").status_code == 401


@pytest.mark.parametrize("field", ["RPC_URL", "WALLET_ADDRESS", "TEST_TOKEN_ADDRESS"])
def test_invalid_settings_are_sanitized(client, rpc, monkeypatch, field):
    monkeypatch.setenv(field, "PRIVATE_INVALID_SETTING")
    response = client.get("/chain/status")
    assert response.json()["status"] == "CHAIN_NOT_CONFIGURED"
    assert "PRIVATE" not in response.text


@pytest.mark.parametrize("failure", ["chain", "code", "decimals", "balance", "native", "provider"])
def test_invalid_chain_reads_never_claim_readiness(client, rpc, failure):
    if failure == "chain":
        rpc.chain_id = 1
    elif failure == "code":
        rpc.get_code = lambda *args, **kwargs: b""
    elif failure in ("decimals", "balance"):
        rpc.call = lambda tx, **kwargs: b"bad" if (
            (tx["data"] == "0x313ce567") == (failure == "decimals")
        ) else (6).to_bytes(32, "big")
    elif failure == "native":
        rpc.get_balance = lambda *args, **kwargs: -1
    else:
        def unavailable(*args, **kwargs):
            raise RuntimeError("https://rpc.invalid/PRIVATE_PROVIDER_CREDENTIAL")
        rpc.get_code = unavailable
    response = client.get("/chain/status")
    assert response.json()["status"] == "UNAVAILABLE"
    assert response.json()["wallet_address"] is None
    assert "PRIVATE" not in response.text


@pytest.mark.parametrize("decimals", [0, 1, 19, 256])
def test_unsupported_decimals_are_unavailable(client, rpc, decimals):
    rpc.call = lambda tx, **kwargs: decimals.to_bytes(32, "big")
    assert client.get("/chain/status").json()["status"] == "UNAVAILABLE"


def test_balance_reads_use_one_observed_block_and_allow_zero(client, rpc):
    reads = []
    def code(address, *, block_identifier):
        reads.append(block_identifier)
        return b"code"
    def call(tx, *, block_identifier):
        reads.append(block_identifier)
        return (6 if tx["data"] == "0x313ce567" else 0).to_bytes(32, "big")
    def native(address, *, block_identifier):
        reads.append(block_identifier)
        return 0
    rpc.get_code, rpc.call, rpc.get_balance = code, call, native
    body = client.get("/chain/status").json()
    assert body["status"] == "READY"
    assert body["token_balance_base_units"] == body["native_balance_wei"] == "0"
    assert reads == [123, 123, 123, 123]
