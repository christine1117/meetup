import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleFit, freshRoles, vibe } from '../src/teams/matching.js';

test('a role the team does not have scores highest', () => {
  const counts = { Backend: 1, Design: 1 };
  assert.equal(roleFit(['Frontend'], counts), 3);
  assert.equal(roleFit(['Backend'], counts), 0.5, 'a second backend is fine but lower');
  assert.equal(roleFit(['Backend'], { Backend: 2 }), -2, 'a third one is pushed down');
});

test('a role the team asked for wins, even if they already have one', () => {
  assert.equal(roleFit(['Backend'], { Backend: 1 }, ['Backend']), 4);
});

test('people with two roles are scored by their best one', () => {
  assert.equal(roleFit(['Backend', 'Pitch'], { Backend: 1 }), 3);
});

test('roles worth pointing out', () => {
  assert.deepEqual(freshRoles(['Data', 'Research'], { Data: 1 }), ['Research']);
  assert.deepEqual(freshRoles(['Data'], { Data: 1 }, ['Data']), ['Data']);
});

test('same goal, similar hours and shared topics add up', () => {
  const a = { goal: 'win', hours: 6, topics: ['AI', 'Health'] };
  assert.equal(vibe(a, { goal: 'win', hours: 6, topics: ['AI', 'Health', 'Food'] }), 5);
  assert.equal(vibe(a, { goal: 'fun', hours: 10, topics: [] }), 0);
});

test('a shared time to work adds one', () => {
  const a = { goal: 'win', hours: 6, topics: [], availability: ['sat_am', 'mon_eve'] };
  assert.equal(vibe(a, { goal: 'learn', hours: 20, topics: [], availability: ['sat_am', 'sun_pm'] }), 1);
  assert.equal(vibe(a, { goal: 'learn', hours: 20, topics: [], availability: ['mon_am'] }), 0);
  assert.equal(vibe(a, { goal: 'learn', hours: 20, topics: [] }), 0, 'not said: nothing added');
});
