import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sugarOf, isCold, REVEAL_AT } from '../src/shared/sugar.js';

const MIN = 60000;
const chat = (gaps) => {
  let at = Date.UTC(2026, 0, 1);
  const msgs = gaps.map((g, i) => { at += g * MIN; return { from: i % 2 ? 'them' : 'me', at }; });
  return { msgs, status: 'open', at: 0 };
};

test('10 minutes of talking is half sugar', () => {
  // a message every 2 minutes, 5 gaps = 10 minutes
  assert.equal(sugarOf(chat([0, 2, 2, 2, 2, 2])), REVEAL_AT);
});

test('a long silence only counts as 3 minutes', () => {
  assert.equal(sugarOf(chat([0, 60])), 15);
});

test('no sugar until both sides have spoken', () => {
  assert.equal(sugarOf({ msgs: [{ from: 'me', at: 0 }, { from: 'me', at: 5 * MIN }], status: 'open' }), 0);
});

test('a chat goes cold after 3 days without a reply', () => {
  const old = Date.now() - 4 * 86400000;
  assert.equal(isCold({ msgs: [{ from: 'me', at: old }], status: 'open', at: old }), true);
  assert.equal(isCold({ msgs: [{ from: 'me', at: Date.now() }], status: 'open', at: Date.now() }), false);
});
