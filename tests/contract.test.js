import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCompetition, teamSizeText } from '../src/shared/contract.js';
import { safeUrl } from '../src/shared/core.js';

const good = {
  id: 'dp-123', source: 'devpost', region: 'intl', kind: 'Hackathon', name: 'Test Hack',
  organizer: 'Org', url: 'https://example.com/', start: null, deadline: '2030-01-01T00:00:00.000Z',
  where: 'Online', tags: ['AI'], prize: '$100', summary: '', team: { min: null, max: 4 },
};

test('a good record passes', () => {
  assert.deepEqual(checkCompetition(good), []);
});

test('broken records are caught', () => {
  assert.ok(checkCompetition({ ...good, url: 'javascript:alert(1)' }).includes('url'));
  assert.ok(checkCompetition({ ...good, source: 'unknown' }).includes('source'));
  assert.ok(checkCompetition({ ...good, deadline: 'soon' }).includes('dates'));
  assert.ok(checkCompetition({ ...good, team: { min: null, max: 1 } }).includes('team'), 'one-person entries are not team competitions');
  assert.ok(checkCompetition({ ...good, team: { min: 5, max: 3 } }).includes('team'));
  assert.ok(checkCompetition({ ...good, team: undefined }).includes('team'));
  assert.ok(checkCompetition({ ...good, name: '' }).includes('name'));
});

test('team size is always shown as a range', () => {
  assert.equal(teamSizeText({ min: 2, max: 5 }), '2–5 people');
  assert.equal(teamSizeText({ min: null, max: 4 }), '1–4 people', 'no minimum means one person can enter');
  assert.equal(teamSizeText({ min: 1, max: 8 }), '1–8 people');
  assert.equal(teamSizeText({ min: 3, max: null }), '3+ people');
  assert.equal(teamSizeText({ min: 4, max: 4 }), '4 per team');
  assert.equal(teamSizeText({ min: null, max: null }), 'Team size on the official page');
});

test('only http(s) links are let through', () => {
  assert.equal(safeUrl('https://devpost.com'), 'https://devpost.com');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl(undefined), '');
});
