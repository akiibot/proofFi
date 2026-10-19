from app.core.settings import Settings
from app.main import create_app
from fastapi.testclient import TestClient

PROFILE = {"profile_id": "synthetic-funded-demo-v1", "accept_synthetic_assumptions": True}
ORIGIN = {"Origin": "http://127.0.0.1:3000"}


def test_disabled_entry_and_unchanged_operator(client):
    before = client.get("/financial-state").json()
    assert client.post("/auth/judge", json=PROFILE).status_code == 503
    assert client.get("/auth/access").json()["mode"] == "operator"
    assert client.get("/financial-state").json() == before


def test_guest_isolation_denial_consent_and_revocation(database, tmp_path):
    settings = Settings(
        _env_file=None,
        database_url=database[0],
        judge_enabled=True,
        judge_directory=str(tmp_path / "judges"),
    )
    app = create_app(settings)
    with TestClient(app) as a, TestClient(app) as b:
        a.headers.update(ORIGIN)
        b.headers.update(ORIGIN)
        invalid = {**PROFILE, "accept_synthetic_assumptions": 1}
        assert a.post("/auth/judge", json=invalid).status_code == 422
        assert a.post("/auth/judge", json={**PROFILE, "role": "operator"}).status_code == 422
        one = a.post("/auth/judge", json=PROFILE)
        two = b.post("/auth/judge", json=PROFILE)
        assert one.status_code == two.status_code == 200
        x, y = one.json(), two.json()
        assert x["scope_id"] != y["scope_id"]
        assert x["execution_enabled"] is False
        assert a.get("/auth/access").json()["mode"] == "judge"
        state = a.get("/financial-state").json()
        assert state["snapshot"]["assets"][0]["amount_minor"] == 1700000
        assert state["active_constitution_version"] is None
        a.headers["X-CSRF-Token"] = x["csrf_token"]
        for route in ["/execute", "/approvals", "/demo/reset", "/demo/attack"]:
            assert a.post(route, json={}).status_code == 403
        assert a.get("/executions/guessed").status_code == 403
        assert a.post("/auth/judge", content=b"x" * 65537).status_code == 413
        assert a.get("/financial-state").json() == state
        assert a.post("/auth/logout").status_code == 200
        assert a.get("/financial-state").status_code == 401
        assert b.get("/financial-state").json()["snapshot"] == state["snapshot"]
    app.state.engine.dispose()
