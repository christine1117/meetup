import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, authMessage } from '../src/shared/account.js';

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
  assert.equal(authMessage({ message: 'Invalid login credentials' }), 'Email or password is not right.');
  assert.equal(authMessage({ message: 'User already registered' }), 'This email already has an account. Log in instead.');
  assert.equal(authMessage({ message: 'Email not confirmed' }), 'Please confirm your email first. Check your inbox.');
});
