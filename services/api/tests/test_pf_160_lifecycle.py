import asyncio
from pathlib import Path

import pytest
from app.core.errors import DomainError
from app.core.settings import Settings
from app.judge.http import bounded_receive
from app.main import create_app
from fastapi.testclient import TestClient
from test_pf_160_access import ORIGIN, PROFILE


@pytest.fixture
def sandbox(database, tmp_path):
    app = create_app(
        Settings(
            _env_file=None,
            database_url=database[0],
            judge_enabled=True,
            judge_directory=str(tmp_path / "judges"),
        )
    )
    with TestClient(app) as client:
        client.headers.update(ORIGIN)
        yield app, client
    app.state.engine.dispose()


def test_streamed_overflow_stops_before_more_chunks():
    seen = []

    async def receive():
        seen.append(True)
        return {"type": "http.request", "body": b"x" * 32769, "more_body": True}

    with pytest.raises(DomainError) as exc:
        asyncio.run(bounded_receive(receive))
    assert exc.value.status == 413
    assert len(seen) == 2


def test_expiry_keeps_active_lease_but_blocks_new_request(sandbox):
    app, client = sandbox
    reply = client.post("/auth/judge", json=PROFILE)
    assert reply.status_code == 200
    registry = app.state.judges
    token = client.cookies.get("prooffi_session")
    guest = next(iter(registry.guests.values()))
    now = guest.expires - 1
    registry.clock = lambda: now
    with registry.lease(token):
        now += 2
        registry.cleanup()
        assert guest.directory.exists()
        assert client.get("/financial-state").status_code == 401
    assert not guest.directory.exists()
    assert not registry.guests


def test_start_and_provider_budgets_survive_replacement(sandbox):
    app, client = sandbox
    registry = app.state.judges
    for _ in range(3):
        assert client.post("/auth/judge", json=PROFILE).status_code == 200
    last = client.get("/financial-state").json()
    assert client.post("/auth/judge", json=PROFILE).status_code == 429
    assert client.get("/financial-state").json() == last
    guest = next(iter(registry.guests.values()))
    for _ in range(3):
        registry.reserve_provider(guest.key)
    with pytest.raises(DomainError) as exc:
        registry.reserve_provider(guest.key)
    assert exc.value.status == 429
    assert len(registry.provider_calls) == 3
    client.headers["X-CSRF-Token"] = client.get("/auth/session").json()["csrf_token"]
    assert client.post("/auth/logout").status_code == 200
    assert len(registry.provider_calls) == 3
    assert not registry.guests


def test_guest_csrf_denial_and_operator_authority_remain_separate(sandbox, monkeypatch):
    app, client = sandbox
    from app.execution import router

    def forbidden():
        pytest.fail("operational execution policy called by guest")

    monkeypatch.setattr(router, "operational_policy", forbidden)
    monkeypatch.setenv("EXECUTION_ENABLED", "true")
    assert client.post("/auth/judge", json=PROFILE).status_code == 200
    assert client.post("/constitutions/drafts", json={}).status_code == 403
    for path in ["/execute", "/execute/", "/approvals", "/demo/attack", "/demo/reset"]:
        assert client.post(path, json={}).status_code == 403
    guest = next(iter(app.state.judges.guests.values()))
    # Defense even when the dispatcher is bypassed in an isolated test.
    with TestClient(guest.app) as direct:
        direct.cookies.set("prooffi_session", client.cookies.get("prooffi_session"))
        direct.headers.update(ORIGIN)
        assert direct.post("/execute", json={}).status_code == 403
    assert app.state.auth._sessions == {}


def test_database_size_limit_and_shutdown_cleanup(sandbox):
    app, client = sandbox
    assert client.post("/auth/judge", json=PROFILE).status_code == 200
    guest = next(iter(app.state.judges.guests.values()))
    from sqlalchemy.exc import DatabaseError

    with pytest.raises(DatabaseError):
        with guest.engine.begin() as connection:
            connection.exec_driver_sql("CREATE TABLE capacity_probe (value BLOB)")
            connection.exec_driver_sql("INSERT INTO capacity_probe VALUES (zeroblob(16777216))")
    assert sum(p.stat().st_size for p in guest.directory.iterdir()) < 16 * 1024 * 1024
    assert client.get("/financial-state").status_code == 200
    app.state.judges.close()
    assert not list(Path(app.state.judges.root).glob("judge-*"))


def test_body_deadline_releases_stalled_stream(monkeypatch):
    from app.judge import http

    monkeypatch.setattr(http, "BODY_SECONDS", 0.01)

    async def stalled():
        await asyncio.sleep(10)

    with pytest.raises(DomainError) as exc:
        asyncio.run(http.bounded_receive(stalled))
    assert exc.value.status == 408


def test_shutdown_during_creation_never_publishes(sandbox, monkeypatch):
    app, client = sandbox
    registry = app.state.judges
    original = registry.build_app

    def shutdown_then_build(*args):
        registry.close()
        return original(*args)

    monkeypatch.setattr(registry, "build_app", shutdown_then_build)
    response = client.post("/auth/judge", json=PROFILE)
    assert response.status_code == 503
    assert not registry.guests
    assert registry.reserved == 0
    assert not list(registry.root.glob("judge-*"))


def test_root_lock_survives_retiring_file_cleanup(sandbox, monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    from app.judge import scopes
    from app.judge.scopes import JudgeRegistry

    app, client = sandbox
    registry = app.state.judges
    assert client.post("/auth/judge", json=PROFILE).status_code == 200
    entered, resume = threading.Event(), threading.Event()
    original = scopes.shutil.rmtree

    def paused(path):
        entered.set()
        assert resume.wait(5)
        original(path)

    monkeypatch.setattr(scopes.shutil, "rmtree", paused)
    with ThreadPoolExecutor(max_workers=1) as pool:
        cleanup = pool.submit(registry.close)
        assert entered.wait(5)
        try:
            registry.cleanup()
            with pytest.raises(ValueError, match="already owned"):
                JudgeRegistry(registry.settings, registry.operator_auth, registry.build_app)
        finally:
            resume.set()
        cleanup.result()
    assert registry.retiring == 0
    assert registry.directory_lock.file.closed


def test_global_capacity_and_hourly_provider_budget(sandbox):
    app, client = sandbox
    registry = app.state.judges
    now = registry.clock()
    registry.clock = lambda: now
    for index in range(8):
        if index and index % 3 == 0:
            now += 61
        client.cookies.clear()  # independent visitors, not same-browser replacement
        assert client.post("/auth/judge", json=PROFILE).status_code == 200
    client.cookies.clear()
    assert client.post("/auth/judge", json=PROFILE).status_code == 429
    guests = list(registry.guests.values())
    for guest in guests[:6]:
        for _ in range(3):
            registry.reserve_provider(guest.key)
    with pytest.raises(DomainError) as exc:
        registry.reserve_provider(guests[6].key)
    assert exc.value.status == 429
    registry.revoke(None)
    assert len(registry.provider_calls) == 18
