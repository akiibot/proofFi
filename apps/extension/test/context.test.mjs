import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classify,redact,safePageUrl,observedSender,validPreview,pageIdentity} from '../src/context-policy.mjs';
test('classification is local and conservative',()=>{assert.equal(classify('ETF investment expense ratio'),'investment');assert.equal(classify('subscription billing next payment'),'expense');assert.equal(classify('Welcome to a shop'),'unknown');assert.equal(classify('investment subscription'),'unknown');});
test('form secrets and identifying strings are excluded from outgoing excerpts',()=>{const value=redact('Fund facts\nPassword: do-not-send\nAPI key secret\nContact me at a@example.com\nCard 4111111111111111\n0x'+'a'.repeat(40));assert.equal(value.includes('do-not-send'),false);assert.equal(value.includes('a@example.com'),false);assert.equal(value.includes('4111111111111111'),false);assert.equal(value.includes('0x'+'a'.repeat(40)),false);assert.ok(value.includes('Fund facts'));});
test('URLs cannot forward browser queries, fragments or credentials',()=>{assert.equal(safePageUrl('https://example.com/fund?session=private#account'),'https://example.com/fund');assert.equal(safePageUrl('https://u:p@example.com'),null);assert.equal(safePageUrl('chrome://settings'),null);assert.equal(safePageUrl('javascript:alert(1)'),null);});
test('content scripts never qualify as privileged extension UI senders',()=>{const id='a'.repeat(32);assert.equal(observedSender({id,tab:{id:3},frameId:0,url:'https://example.com/fund'},id),true);for(const sender of [{id,url:`chrome-extension://${id}/panel.html`},{id,tab:{id:3},frameId:1,url:'https://example.com'},{id:'other',tab:{id:3},frameId:0,url:'https://example.com'}])assert.equal(observedSender(sender,id),false);});
test('untrusted persisted previews are bounded and validated',()=>{const value={tabId:3,navigation_key:'a'.repeat(64),captured_at:'2026-10-19T00:00:00Z',source_url:'https://example.com/',title:'Fund',page_kind:'investment',selected_text:'fees'};assert.equal(validPreview(value),true);assert.equal(!!validPreview({...value,source_url:'https://example.com/?token=secret'}),false);assert.equal(!!validPreview({...value,selected_text:'a'.repeat(6001)}),false);assert.equal(!!validPreview({...value,page_kind:'approve'}),false);});

test('SPA query changes invalidate page identity without retaining query secrets',async()=>{
 const first=await pageIdentity('https://example.com/fund?product=one&session=private');
 const changed=await pageIdentity('https://example.com/fund?product=two&session=private');
 assert.match(first,/^[a-f0-9]{64}$/);assert.notEqual(first,changed);
 assert.equal(first.includes('private'),false);assert.equal(await pageIdentity('chrome://settings'),null);
});
