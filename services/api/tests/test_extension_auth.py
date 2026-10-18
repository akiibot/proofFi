import pytest
from app.core.auth import hash_password
from app.core.settings import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import SecretStr

IDENTITY = "a" * 32
PASSWORD = "extension-isolated-password-2026"


@pytest.fixture
def ext(database):
    app = create_app(Settings(_env_file=None, database_url=database[0],
        demo_password_hash=SecretStr(hash_password(PASSWORD)), extension_ids=[IDENTITY]))
    with TestClient(app) as client:
        client.headers["X-ProofFi-Extension-Id"] = IDENTITY
        yield client, app
    app.state.engine.dispose()


def login(client):
    out = client.post("/auth/extension/login", json={"password": PASSWORD})
    assert out.status_code == 200
    assert "set-cookie" not in out.headers
    assert out.headers["cache-control"] == "no-store"
    data = out.json()
    client.headers.update({"X-ProofFi-Extension-Session": data["session_token"],
                           "X-CSRF-Token": data["csrf_token"]})
    return data


def test_extension_session_reads_csrf_and_revocation(ext):
    client, _ = ext
    login(client)
    assert client.get("/financial-state").status_code == 200
    assert client.get("/auth/extension/session").status_code == 200
    del client.headers["X-CSRF-Token"]
    assert client.post("/demo/attack").status_code == 403
    csrf = client.get("/auth/extension/session").json()["csrf_token"]
    client.headers["X-CSRF-Token"] = csrf
    assert client.post("/auth/extension/logout").status_code == 200
    assert client.get("/financial-state").status_code == 401


@pytest.mark.parametrize("origin", ["https://attacker.invalid", "null", "chrome-extension://" + "b" * 32])
def test_extension_rejects_wrong_origin_before_password(ext, origin):
    client, _ = ext
    client.headers["Origin"] = origin
    assert client.post("/auth/extension/login", json={"password": PASSWORD}).status_code == 403


def test_extension_identity_binding_and_cookie_transport_separation(ext):
    client, app = ext
    data = login(client)
    client.headers["X-ProofFi-Extension-Id"] = "b" * 32
    assert client.get("/financial-state").status_code == 403
    client.headers["X-ProofFi-Extension-Id"] = IDENTITY
    client.cookies.set("prooffi_session", data["session_token"])
    assert client.get("/financial-state").status_code == 403
    del client.headers["X-ProofFi-Extension-Session"]
    assert client.get("/financial-state").status_code == 403
    client.cookies.clear()
    client.headers["X-ProofFi-Extension-Session"] = data["session_token"]
    app.state.auth._sessions.clear()
    assert client.get("/financial-state").status_code == 401


def test_extension_login_disabled_and_password_limited(ext):
    client, app = ext
    client.headers["X-ProofFi-Extension-Id"] = "b" * 32
    assert client.post("/auth/extension/login", json={"password": PASSWORD}).status_code == 403
    client.headers["X-ProofFi-Extension-Id"] = IDENTITY
    for _ in range(5):
        assert client.post("/auth/extension/login", json={"password": "incorrect-password-123"}).status_code == 401
    assert client.post("/auth/extension/login", json={"password": PASSWORD}).status_code == 429
    assert not app.state.auth._sessions


def test_extension_expiry_and_mutation_limit(ext):
    client, app = ext
    login(client)
    session = next(iter(app.state.auth._sessions.values()))
    session.writes.extend([app.state.auth.clock()] * 120)
    assert client.post("/demo/attack").status_code == 429
    session.expires = 0
    assert client.get("/financial-state").status_code == 401
