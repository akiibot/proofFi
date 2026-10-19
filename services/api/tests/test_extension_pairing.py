"""Real SQLite pairing/authentication; no signer, provider or financial mutation."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from app.core.auth import hash_password
from app.core.settings import Settings
from app.main import create_app
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text

IDENTITY = "b" * 32
PASSWORD = "pairing-disposable-password-2026"


@pytest.fixture
def pairing(database):
    settings = Settings(_env_file=None, database_url=database[0],
        demo_password_hash=SecretStr(hash_password(PASSWORD)), extension_ids=["a" * 32])
    app = create_app(settings)
    with TestClient(app) as web, TestClient(app) as ext:
        web.headers['Origin'] = 'http://127.0.0.1:3000'
        login = web.post('/auth/login', json={'password': PASSWORD})
        web.headers['X-CSRF-Token'] = login.json()['csrf_token']
        ext.headers.update({'X-ProofFi-Extension-Id': IDENTITY, 'Origin': 'chrome-extension://' + IDENTITY})
        yield web, ext, app, settings
    app.state.engine.dispose()


def create(ext):
    r = ext.post('/auth/extension/pairings', json={})
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    return r.json()


def approve(web, p, code=None):
    return web.post('/auth/extension/pairings/' + p['request_id'] + '/approve', json={'code': code or p['code']})


def poll(ext, p):
    return ext.post('/auth/extension/pairings/status', json={k: p[k] for k in ['request_id', 'polling_secret']})


def test_pair_approve_signin_revoke_and_preserve_finances(pairing):
    web, ext, app, settings = pairing
    before = [web.get(path).json() for path in ['/financial-state', '/constitutions/history', '/audit']]
    assert ext.post('/auth/extension/login', json={'password': PASSWORD}).status_code == 403
    p = create(ext)
    assert poll(ext, p).json()['status'] == 'PENDING'
    details = web.get('/auth/extension/pairings/' + p['request_id'])
    assert details.json()['extension_id'] == IDENTITY
    assert 'code' not in details.json() and 'polling_secret' not in details.text
    assert approve(web, p).status_code == 200
    assert approve(web, p).status_code == 409
    assert poll(ext, p).json()['status'] == 'APPROVED'
    result = ext.post('/auth/extension/login', json={'password': PASSWORD})
    assert result.status_code == 200
    data = result.json()
    ext.headers.update({'X-ProofFi-Extension-Session': data['session_token'], 'X-CSRF-Token': data['csrf_token']})
    assert ext.get('/financial-state').status_code == 200
    # An extension session cannot enumerate or approve installations.
    assert ext.get('/auth/extension/connections').status_code == 403
    assert ext.post('/auth/extension/pairings/' + p['request_id'] + '/approve', json={'code': p['code']}).status_code == 403
    rows = web.get('/auth/extension/connections').json()
    assert any(r['extension_id'] == IDENTITY and r['approved_at'] for r in rows)
    assert web.post('/auth/extension/connections/' + IDENTITY + '/revoke').status_code == 200
    assert ext.get('/financial-state').status_code == 401
    ext.headers.pop('X-ProofFi-Extension-Session')
    assert poll(ext, p).json()['status'] == 'REVOKED'
    assert ext.post('/auth/extension/login', json={'password': PASSWORD}).status_code == 403
    assert before == [web.get(path).json() for path in ['/financial-state', '/constitutions/history', '/audit']]
    with app.state.engine.connect() as c:
        row = c.execute(text('SELECT * FROM extension_connections')).mappings().one()
        assert set(row) == {'extension_id', 'owner_id', 'approved_at', 'revoked_at'}
        assert row['owner_id'] == 'demo-user'
    # Revocation persists through an API restart, which clears all sessions/pending codes.
    fresh = create_app(settings)
    with TestClient(fresh) as c:
        c.headers['X-ProofFi-Extension-Id'] = IDENTITY
        assert c.post('/auth/extension/login', json={'password': PASSWORD}).status_code == 403
        assert poll(c, p).status_code == 409
    fresh.state.engine.dispose()
    p2 = create(ext)
    assert approve(web, p2).status_code == 200
    assert ext.post('/auth/extension/login', json={'password': PASSWORD}).status_code == 200


def test_approval_survives_restart_without_sessions(pairing):
    web, ext, app, settings = pairing
    p = create(ext)
    assert approve(web, p).status_code == 200
    fresh = create_app(settings)
    with TestClient(fresh) as c:
        c.headers['X-ProofFi-Extension-Id'] = IDENTITY
        assert c.post('/auth/extension/login', json={'password': PASSWORD}).status_code == 200
        assert poll(c, p).status_code == 409
    fresh.state.engine.dispose()


def test_codes_expiry_binding_limits_and_no_secret_echo(pairing):
    web, ext, app, _ = pairing
    p = create(ext)
    wrong = dict(p, polling_secret='x' * 43)
    assert poll(ext, wrong).status_code == 403
    ext.headers['X-ProofFi-Extension-Id'] = 'c' * 32
    assert poll(ext, p).status_code == 403
    ext.headers['X-ProofFi-Extension-Id'] = IDENTITY
    for _ in range(5):
        assert approve(web, p, 'AAAAAAAA').status_code == 403
    assert approve(web, p).status_code == 409
    assert poll(ext, p).json()['status'] == 'EXHAUSTED'
    p2 = create(ext)
    app.state.auth._pairings[p2['request_id']].expires = 0
    assert poll(ext, p2).json()['status'] == 'EXPIRED'
    assert approve(web, p2).status_code == 409
    bad = ext.post('/auth/extension/pairings/status', json={'request_id': p2['request_id'], 'polling_secret': 'do-not-echo'})
    assert bad.status_code == 422 and 'do-not-echo' not in bad.text
    assert bad.headers['cache-control'] == 'no-store'
    for _ in range(3):
        create(ext)
    assert ext.post('/auth/extension/pairings', json={}).status_code == 429


def test_csrf_origins_and_conflicting_transports(pairing):
    web, ext, _, _ = pairing
    p = create(ext)
    csrf = web.headers.pop('X-CSRF-Token')
    assert approve(web, p).status_code == 403
    web.headers['X-CSRF-Token'] = csrf
    web.headers['Origin'] = 'https://attacker.invalid'
    assert approve(web, p).status_code == 403
    web.headers['Origin'] = 'http://127.0.0.1:3000'
    ext.headers['Origin'] = 'https://attacker.invalid'
    assert ext.post('/auth/extension/pairings', json={}).status_code == 403
    ext.headers['Origin'] = 'chrome-extension://' + IDENTITY
    ext.cookies.set('prooffi_session', web.cookies.get('prooffi_session'))
    assert ext.post('/auth/extension/pairings', json={}).status_code == 403
    assert poll(ext, p).status_code == 403
    ext.cookies.clear()
    assert approve(ext, p).status_code == 403
    assert approve(web, p).status_code == 200


def test_configured_identity_revocation_overrides_allowlist(pairing):
    web, ext, _, _ = pairing
    identity = 'a' * 32
    assert web.post('/auth/extension/connections/' + identity + '/revoke').status_code == 200
    ext.headers.update({'X-ProofFi-Extension-Id':identity,'Origin':'chrome-extension://'+identity})
    assert ext.post('/auth/extension/login', json={'password':PASSWORD}).status_code == 403
    p = create(ext)
    assert approve(web,p).status_code == 200
    assert ext.post('/auth/extension/login', json={'password':PASSWORD}).status_code == 200


def test_concurrent_approval_and_revocation_are_serialized(pairing):
    web, ext, _, _ = pairing
    p = create(ext)
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(lambda _: approve(web,p).status_code, range(2)))
    assert sorted(statuses)==[200,409]
    p2 = create(ext)
    with ThreadPoolExecutor(max_workers=2) as pool:
        a=pool.submit(approve,web,p2)
        b=pool.submit(web.post,'/auth/extension/connections/'+IDENTITY+'/revoke')
        assert a.result().status_code in (200,409)
        assert b.result().status_code==200
    assert poll(ext,p2).json()['status']=='REVOKED'
    assert ext.post('/auth/extension/login',json={'password':PASSWORD}).status_code==403


def test_pending_capacity_and_no_durable_pending_secrets(pairing):
    _, ext, app, _=pairing
    # Distinct minutes avoid creation throttling while retaining five-minute pending TTL.
    now=app.state.auth.clock()
    clock=[now]
    app.state.auth.clock=lambda:clock[0]
    for batch in range(7):
        for _ in range(5 if batch<6 else 2):
            create(ext)
        clock[0]+=61
        # Retain pending entries to exercise the independent capacity bound.
        for item in app.state.auth._pairings.values():
            item.expires=clock[0]+300
    assert len(app.state.auth._pairings)==32
    assert ext.post('/auth/extension/pairings',json={}).status_code==429
    item=next(iter(app.state.auth._pairings.values()))
    assert len(item.secret_hash)==32 and len(item.code_hash)==32
    assert not hasattr(item,'code') and not hasattr(item,'polling_secret')


def test_public_mode_pairing_unavailable(database):
    app = create_app(Settings(_env_file=None, database_url=database[0],
        deployment_mode="public",cookie_secure=True,trusted_origins=["https://example.invalid"]))
    with TestClient(app) as client:
        client.headers['X-ProofFi-Extension-Id']=IDENTITY
        r=client.post('/auth/extension/pairings',json={})
        assert r.status_code==503
        assert r.headers['cache-control']=='no-store'
    app.state.engine.dispose()


def test_populated_migration_downgrade_refuses(pairing):
    from alembic import command
    from alembic.config import Config
    web,ext,_,_=pairing
    p=create(ext)
    assert approve(web,p).status_code==200
    with pytest.raises(RuntimeError,match='populated downgrade refused'):
        command.downgrade(Config('alembic.ini'),'6bbbdad71a37')
    assert web.get('/auth/extension/connections').status_code==200


def test_local_approval_cannot_enable_public_transport(pairing):
    web,ext,_,settings=pairing
    p=create(ext)
    assert approve(web,p).status_code==200
    assert web.post('/auth/extension/connections/'+'a'*32+'/revoke').status_code==200
    public=settings.model_copy(update={"deployment_mode":"public","cookie_secure":True,"trusted_origins":["https://example.invalid"]})
    app=create_app(public)
    with TestClient(app) as c:
        c.headers['X-ProofFi-Extension-Id']=IDENTITY
        assert c.post('/auth/extension/login',json={"password":PASSWORD}).status_code==403
        c.headers['X-ProofFi-Extension-Id']='a'*32
        assert c.post('/auth/extension/login',json={"password":PASSWORD}).status_code==403
    app.state.engine.dispose()
