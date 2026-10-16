import { test, expect } from '@playwright/test';
import { chainStatusLabel, formatUsd, formatUtc, formatWeiAsEth, shortAddress } from '../src/lib/format';

// Pure display helpers. They cover values the real backend cannot produce yet (a funded wallet, odd amounts)
// without substituting any backend result: the page never calls these with invented input.

test('PF-018 formats USD cents exactly', () => {
  expect(formatUsd(1200000)).toBe('$12,000');
  expect(formatUsd(1200050)).toBe('$12,000.50');
  expect(formatUsd(99)).toBe('$0.99');
  expect(formatUsd(0)).toBe('$0');
});

test('PF-018 converts wei to ETH exactly and rejects malformed input', () => {
  expect(formatWeiAsEth('1500000000000000000')).toBe('1.5');
  expect(formatWeiAsEth('0')).toBe('0');
  expect(formatWeiAsEth('1')).toBe('0.000000000000000001');
  expect(formatWeiAsEth('123456789012345678901234567890')).toBe('123456789012.34567890123456789');
  for (const bad of ['', '-5', '1.5', '12abc', '0x10']) expect(formatWeiAsEth(bad)).toBeNull();
});

test('PF-018 shortens long addresses only', () => {
  expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x123456…345678');
  expect(shortAddress('0x1234')).toBe('0x1234');
});

test('PF-018 labels every known chain status and passes unknown values through unchanged', () => {
  expect(chainStatusLabel('CHAIN_NOT_CONFIGURED')).toBe('Not configured');
  expect(chainStatusLabel('UNAVAILABLE')).toBe('Unavailable');
  expect(chainStatusLabel('READY')).toBe('Ready');
  expect(chainStatusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
});

test('PF-018 formats snapshot times in UTC and keeps unparseable text', () => {
  expect(formatUtc('2026-10-15T00:00:00Z')).toBe('2026-10-15 00:00 UTC');
  expect(formatUtc('not a date')).toBe('not a date');
});
