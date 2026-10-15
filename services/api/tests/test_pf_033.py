"""Authentication tests exercise real password hashing and HTTP cookie sessions."""

import pytest
from app.core.settings import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import SecretStr

PASSWORD = "isolated-test-password-only"
ORIGIN = "http://127.0.0.1:3000"


@pytest.fixture
def auth_client(database):
    from app.core.auth import hash_password

    app = create_app(
        Settings(
            _env_file=None,
            database_url=database[0],
            demo_password_hash=SecretStr(hash_password(PASSWORD)),
        )
    )
    with TestClient(app) as client:
        yield client
    app.state.engine.dispose()


def login(client):
    return client.post("/auth/login", headers={"Origin": ORIGIN}, json={"password": PASSWORD})


def test_login_sets_httponly_cookie_without_exposing_session_token(auth_client):
    result = login(auth_client)
    assert result.status_code == 200
    cookie = result.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie
    token = auth_client.cookies.get("prooffi_session")
    assert token and token not in result.text
    assert result.json()["user_id"] == "demo-user"
    assert result.json()["csrf_token"]
    assert auth_client.get("/financial-state").status_code == 200


def test_direct_bearer_and_spoofed_actor_do_not_authenticate(auth_client):
    result = auth_client.get(
        "/financial-state",
        headers={"Authorization": "Bearer test-credential", "X-User-Id": "demo-user"},
    )
    assert result.status_code == 401


@pytest.mark.parametrize("origin", [None, "https://attacker.example", "null"])
def test_login_rejects_missing_or_untrusted_origin(auth_client, origin):
    headers = {"Origin": origin} if origin else {}
    assert (
        auth_client.post("/auth/login", headers=headers, json={"password": PASSWORD}).status_code
        == 403
    )


def test_wrong_password_and_login_rate_limit(auth_client):
    for _ in range(5):
        result = auth_client.post(
            "/auth/login", headers={"Origin": ORIGIN}, json={"password": "wrong-password-value"}
        )
        assert result.status_code == 401
        assert "wrong-password-value" not in result.text
    assert login(auth_client).status_code == 429


def test_successful_logins_do_not_consume_failed_login_budget(auth_client):
    for _ in range(6):
        assert login(auth_client).status_code == 200
    result = auth_client.post(
        "/auth/login", headers={"Origin": ORIGIN}, json={"password": "wrong-password-value"}
    )
    assert result.status_code == 401


def test_authenticated_mutations_require_both_origin_and_csrf(auth_client):
    csrf = login(auth_client).json()["csrf_token"]
    body = {
        "certificate_id": "fake",
        "action_digest": "a" * 64,
        "idempotency_key": "session-test-key-1",
    }
    assert auth_client.post("/execute", json=body).status_code == 403
    assert auth_client.post("/execute", headers={"Origin": ORIGIN}, json=body).status_code == 403
    assert (
        auth_client.post(
            "/execute",
            headers={"Origin": "https://attacker.example", "X-CSRF-Token": csrf},
            json=body,
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            "/execute", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}, json=body
        ).status_code
        == 501
    )


def test_logout_revokes_session_and_session_cookie_replay(auth_client):
    csrf = login(auth_client).json()["csrf_token"]
    token = auth_client.cookies.get("prooffi_session")
    assert (
        auth_client.post(
            "/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}
        ).status_code
        == 200
    )
    assert auth_client.get("/auth/session").status_code == 401
    auth_client.cookies.set("prooffi_session", token)
    assert auth_client.get("/financial-state").status_code == 401


def test_session_expiry_is_enforced_by_backend_clock(auth_client):
    login(auth_client)
    manager = auth_client.app.state.auth
    now = manager.clock()
    manager.clock = lambda: now + 1801
    assert auth_client.get("/auth/session").status_code == 401


def test_csrf_cannot_be_borrowed_from_another_session(auth_client):
    old_csrf = login(auth_client).json()["csrf_token"]
    new_csrf = login(auth_client).json()["csrf_token"]
    assert old_csrf != new_csrf
    assert (
        auth_client.post(
            "/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": old_csrf}
        ).status_code
        == 403
    )


def test_session_status_never_returns_password_or_hash(auth_client):
    login(auth_client)
    result = auth_client.get("/auth/session")
    assert result.status_code == 200
    assert PASSWORD not in result.text
    assert "password" not in result.text


def test_unconfigured_password_fails_closed(database):
    app = create_app(
        Settings(_env_file=None, database_url=database[0], demo_password_hash=SecretStr(""))
    )
    with TestClient(app) as client:
        assert login(client).status_code == 503
    app.state.engine.dispose()


def test_non_ascii_csrf_is_rejected_without_server_error(auth_client):
    login(auth_client)
    result = auth_client.post(
        "/auth/logout", headers=[(b"origin", ORIGIN.encode()), (b"x-csrf-token", b"\xff")]
    )
    assert result.status_code == 403


def test_public_deployment_requires_secure_cookie_and_https():
    from pydantic import ValidationError

    for values in [
        dict(deployment_mode="public"),
        dict(deployment_mode="public", cookie_secure=True),
    ]:
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **values)
    config = Settings(
        _env_file=None,
        deployment_mode="public",
        cookie_secure=True,
        trusted_origins=["https://demo.example"],
    )
    assert config.cookie_secure


def test_mutation_rate_limit_is_enforced(auth_client):
    csrf = login(auth_client).json()["csrf_token"]
    for _ in range(120):
        result = auth_client.post(
            "/certificates/absent/verify", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}
        )
        assert result.status_code == 409
    result = auth_client.post(
        "/certificates/absent/verify", headers={"Origin": ORIGIN, "X-CSRF-Token": csrf}
    )
    assert result.status_code == 429


def test_password_hash_is_salted_and_wrong_password_fails():
    from app.core.auth import hash_password, password_matches

    first = hash_password(PASSWORD)
    assert first != hash_password(PASSWORD)
    assert password_matches(PASSWORD, first)
    assert not password_matches("different-test-passphrase", first)


def test_secure_cookie_flag_for_public_configuration(database):
    from app.core.auth import hash_password

    app = create_app(
        Settings(
            _env_file=None,
            database_url=database[0],
            demo_password_hash=SecretStr(hash_password(PASSWORD)),
            cookie_secure=True,
            deployment_mode="public",
            trusted_origins=["https://demo.example"],
        )
    )
    with TestClient(app) as client:
        result = client.post(
            "/auth/login", json={"password": PASSWORD}, headers={"Origin": "https://demo.example"}
        )
        assert "Secure" in result.headers["set-cookie"]
    app.state.engine.dispose()
