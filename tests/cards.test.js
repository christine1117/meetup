import { test } from 'node:test';
import assert from 'node:assert/strict';

// The participation card: what the database stores and what the page uses (spec §4)
const { cardFromRow, rowFromCard } = await import('../src/teams/server.js');

test('a card goes to the database and comes back the same', () => {
  const card = { canDo: ['Design'], wants: ['Frontend'], goal: 'win', hours: 6, idea: 'Air quality alerts near schools', built: 'A bus app used by 2,000 riders',
    availability: ['mon_eve', 'sat_am'] };
  const row = rowFromCard('dp-1', 'u1', card);
  assert.equal(row.user_id, 'u1');
  assert.equal(row.weekly_hours, 6);
  assert.deepEqual(cardFromRow(row), card);
});

test('missing parts of a card get safe values', () => {
  const row = rowFromCard('dp-1', 'u1', { canDo: ['Data'], goal: 'learn', hours: 'x' });
  assert.equal(row.weekly_hours, 6);
  assert.deepEqual([row.desired_roles, row.availability, row.idea, row.built], [[], [], '', '']);
});
