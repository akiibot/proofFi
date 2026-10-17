"""Emergency proposals preserve new-recipient consent; all finances/RPC isolated."""

import pytest
from app.core.canonical import digest
from app.db.models import ApprovalRecord, ExecutionRecord
from app.demo import emergency
from app.execution.signer import LocalTestnetSigner
from sqlalchemy import func, select
from test_pf_010 import bounds as bounds
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc
from test_pf_032 import operational_settings as operational_settings


@pytest.fixture
def ready(configured, operational_settings, bounds, monkeypatch):
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    def forbidden(*args, **kwargs):
        pytest.fail("Emergency repricing reached chain signer")
    monkeypatch.setattr(LocalTestnetSigner, "from_environment", forbidden)


def confirm_rules(client, **updates):
    state = client.get('/financial-state').json()
    active = next(p for p in client.get('/constitutions/history').json()
                  if p['id'] == state['active_constitution_version'])
    draft = client.post('/constitutions/drafts', json={
        'base_version': active['id'], 'rules': {**active['rules'], **updates},
    })
    assert draft.status_code == 200
    response = client.post('/constitutions/confirm', json={
        'draft_id': draft.json()['id'], 'expected_policy_digest': digest(draft.json()['rules']),
        'confirmed': True,
    })
    assert response.status_code == 200
    return response.json()


def test_new_recipient_reprices_without_promoting_recipient_or_approving_action(client, database, ready, rpc):
    policy = confirm_rules(client, known_recipients=[])
    before = client.get('/financial-state').json()
    response = client.post('/demo/emergency', json={'expected_state_version': before['snapshot']['version']})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['state']['snapshot']['version'] == before['snapshot']['version'] + 1
    assert result['state']['snapshot']['assets'][0]['amount_minor'] == 1800000
    assert result['state']['snapshot']['realized_expense_minor'] == 200000
    assert result['state']['active_constitution_version'] == policy['id']
    current = next(p for p in client.get('/constitutions/history').json() if p['id'] == policy['id'])
    assert current == policy and current['rules']['known_recipients'] == []
    assert result['optimization']['status'] == 'SAFE_ACTION'
    verification = client.post('/verify', json={'action': result['optimization']['action']})
    assert verification.status_code == 200, verification.text
    assert verification.json()['verdict']['decision'] == 'REQUIRES_APPROVAL'
    assert 'NEW_RECIPIENT_APPROVAL_REQUIRED' in verification.json()['reasons']
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ApprovalRecord)) == 0
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0


@pytest.mark.parametrize('refusal', ['blocked', 'token', 'stale'])
def test_actual_forbidden_inputs_still_preserve_state_and_audit(client, ready, refusal):
    from test_pf_029 import RECIPIENT
    updates = {'known_recipients': []}
    if refusal == 'blocked':
        updates['blocked_recipients'] = [RECIPIENT]
    elif refusal == 'token':
        updates['allowed_tokens'] = []
    confirm_rules(client, **updates)
    before = client.get('/financial-state').json()
    audit = client.get('/audit').json()
    version = before['snapshot']['version'] + (1 if refusal == 'stale' else 0)
    response = client.post('/demo/emergency', json={'expected_state_version': version})
    assert response.status_code == (409 if refusal == 'stale' else 403)
    assert client.get('/financial-state').json() == before
    assert client.get('/audit').json() == audit


def test_unknown_operational_recipient_is_a_proposal_not_a_policy_mismatch(client, ready, monkeypatch):
    # The previous PF-032 test denied any unknown operational recipient. A new
    # recipient instead requires exact approval later; it is not hard-blocked.
    unknown = '0x' + '9' * 40
    monkeypatch.setenv('APPROVED_RECIPIENT', unknown)
    policy = confirm_rules(client, known_recipients=[])
    before = client.get('/financial-state').json()
    response = client.post('/demo/emergency', json={'expected_state_version': before['snapshot']['version']})
    assert response.status_code == 200, response.text
    assert response.json()['optimization']['action']['recipient'] == unknown
    assert response.json()['state']['active_constitution_version'] == policy['id']
    assert policy['rules']['known_recipients'] == []
