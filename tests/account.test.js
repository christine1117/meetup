import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, authMessage, PROVIDERS } from '../src/shared/account.js';

const me = { alias: 'Tea', field: 'Design', field2: '', city: 'Taipei', meet: 'online', curious: ['AI'], fun: 'boba',
  name: 'Real Me', title: 'Designer', school: 'NTU', company: 'Acme', contactType: 'linkedin', contact: 'in/me' };

test('the profile goes into two tables and comes back the same', () => {
  const { profile, sealed } = toRows('u1', me);
  assert.equal(profile.id, 'u1');
  assert.equal(sealed.real_name, 'Real Me');
  assert.ok(!('real_name' in profile), 'sealed details never go into the public table');
  assert.deepEqual(fromRows(profile, sealed), me);
});

test('bad values are made safe before saving', () => {
  const { profile, sealed } = toRows('u1', { alias: 'x'.repeat(80), meet: 'mars', contactType: 'fax', curious: Array(20).fill('a') });
  assert.equal(profile.alias.length, 40);
  assert.equal(profile.meet, 'both');
  assert.equal(sealed.contact_type, 'instagram');
  assert.equal(profile.curious.length, 8);
});

test('sign-in errors read like plain English', () => {
  assert.equal(authMessage({ message: 'Unsupported provider: provider is not enabled' }), 'This sign-in is not ready yet. Please try again later.');
  assert.equal(authMessage({ message: 'Failed to fetch' }), 'Could not reach the server. Check your connection.');
  assert.equal(authMessage({ message: '???' }), 'Something went wrong. Please try again.');
});

test('only Google and LinkedIn, no passwords', () => {
  assert.deepEqual(PROVIDERS.map(([id]) => id), ['google', 'linkedin_oidc']);
});
