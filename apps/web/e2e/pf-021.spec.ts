import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { buildChart } from '../src/components/simulation/chart';
import { buildCandidate } from '../src/lib/candidate';

const TOKEN = '0x' + '1'.repeat(40);
const RECIPIENT = '0x' + '2'.repeat(40);

test('PF-021 chart geometry spans every sampled path and marks $0 only when it is in range', () => {
  const chart = buildChart([[100000, 50000, -20000], [100000, 90000, 80000]], 400, 200)!;
  expect(chart.lines).toHaveLength(2);
  expect(chart.lines[0].split(' ')).toHaveLength(3);
  expect(chart.days).toBe(2);
  expect(chart.min).toBe(-20000);
  expect(chart.max).toBe(100000);
  expect(chart.zeroY).not.toBeNull();
  expect(chart.yTicks.every((t) => t.value >= chart.min && t.value <= chart.max)).toBe(true);
  expect(buildChart([[5000, 6000]])!.zeroY).toBeNull();
  expect(buildChart([[7000, 7000]])!.lines[0]).toMatch(/^[\d.]+,[\d.]+ [\d.]+,[\d.]+$/); // flat line still drawable
  expect(buildChart([])).toBeNull();
  expect(buildChart([[-30000, 0, 40000]])!.yTicks.every((t) => !Object.is(t.value, -0))).toBe(true); // never labels "-$0"
});

test('PF-021 manual candidates are validated before anything is sent', () => {
  const ok = buildCandidate({ amount: '1000', token: TOKEN.toUpperCase().replace('0X', '0x'), recipient: RECIPIENT }, 'why');
  expect(ok.ok).toBe(true);
  if (ok.ok) {
    expect(ok.action.amount_minor).toBe(100000);
    expect(ok.action.token_address).toBe(TOKEN);
    expect(ok.action.chain_id).toBe(84532);
    expect(ok.action.funding_source).toBe('owned');
  }
  const bad = buildCandidate({ amount: '0', token: 'nope', recipient: `${RECIPIENT}\n${TOKEN}` }, 'why');
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['amount', 'recipient', 'token']);
});

test('PF-021 the backend refuses to simulate without a confirmed Constitution (fresh seed has none)', async ({ page }) => {
  await signIn(page);
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': (await (await page.request.get('/api/backend/auth/session')).json()).csrf_token };
  const action = { id: 'whatif-1', action_type: 'TEST_TOKEN_ALLOCATION', amount_minor: 100000, chain_id: 84532, token_address: TOKEN, recipient: RECIPIENT, funding_source: 'owned', planner_reason_untrusted: 'test', planner_mode: 'deterministic_demo' };
  const response = await page.request.post('/api/backend/simulate', { headers, data: { action } });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect((await response.json()).message).toMatch(/Constitution/i); // the backend's own reason, never a made-up result
});
