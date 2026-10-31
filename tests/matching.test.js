import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitFor, rank, soloMatch, teamFit, teamMatch, toHundred } from '../src/teams/matching.js';

// spec.md §21 "Recommendation" acceptance criteria, one test each where it applies here
const person = (o) => ({ canDo: [], wants: [], goal: 'win', hours: 6, availability: [], ...o });

test('role: +4 for a role you want, +2 for a different role when you did not say, 0 otherwise', () => {
  const me = person({ canDo: ['Design'], wants: ['Frontend'] });
  assert.equal(fitFor(me, person({ canDo: ['Frontend'], goal: 'learn', hours: 20 })).score, 4);
  assert.equal(fitFor(me, person({ canDo: ['Backend'], goal: 'learn', hours: 20 })).score, 0, 'you said what you want; this is not it');
  const open = person({ canDo: ['Design'] });
  assert.equal(fitFor(open, person({ canDo: ['Backend'], goal: 'learn', hours: 20 })).score, 2, 'different skills, nothing asked');
  assert.equal(fitFor(open, person({ canDo: ['Design'], goal: 'learn', hours: 20 })).score, 0, 'the same skill');
});

test('two roles: the one that fits best counts', () => {
  const me = person({ canDo: ['Design'], wants: ['Pitch'] });
  const them = fitFor(me, person({ canDo: ['Backend', 'Pitch'], goal: 'learn', hours: 20 }));
  assert.equal(them.score, 4);
  assert.deepEqual(them.role, { kind: 'wanted', roles: ['Pitch'] });
});

test('two people: both sides count (geometric mean out of 100)', () => {
  const a = person({ canDo: ['Design'], wants: ['Frontend'], availability: ['sat_am', 'sat_pm', 'sun_pm'] });
  const b = person({ canDo: ['Frontend'], wants: ['Design'], availability: ['sat_am', 'sat_pm', 'sun_pm'] });
  // each side: role 4 + goal 2 + hours 1 + free time 2 = 9
  assert.equal(soloMatch(a, b).score, 100);
  const c = person({ canDo: ['Frontend'], wants: ['Data'], availability: ['sat_am', 'sat_pm', 'sun_pm'] });
  // a likes c (9), c does not want a's role (0 + 2 + 1 + 2 = 5): √(9/9 × 5/9) = 74.5
  assert.equal(soloMatch(a, c).score, 75);
  assert.equal(soloMatch(a, c).score, soloMatch(c, a).score, 'the same from either side');
  assert.equal(toHundred(9, 0), 0, 'nothing from one side is nothing overall');
});

test('missing data adds nothing and is flagged; no reason is made up', () => {
  const a = person({ canDo: ['Design'], goal: 'win', hours: 6 });
  const b = person({ canDo: ['Design'], goal: 'learn', hours: 20 });
  const m = soloMatch(a, b);
  assert.equal(m.score, 0);
  assert.deepEqual(m.reasons, [], 'no matches, no reasons');
  assert.equal(m.missing, true, 'free time not filled in');
});

test('reasons: at most three, from what actually matched', () => {
  const a = person({ canDo: ['Design'], wants: ['Frontend'], availability: ['mon_eve'] });
  const b = person({ canDo: ['Frontend'], wants: ['Design'], availability: ['mon_eve'] });
  assert.deepEqual(soloMatch(a, b).reasons.map((r) => r.kind), ['wanted', 'theyWant', 'goal']);
});

test('a team: +4 needed, +3 a role it lacks, +0.5 one already, −2 two already', () => {
  const team = { counts: { Backend: 1, Design: 2 }, needs: ['Pitch'], goal: 'learn', hours: 30, availability: [] };
  assert.equal(teamFit(team, person({ canDo: ['Pitch'] })).score, 4);
  assert.equal(teamFit(team, person({ canDo: ['Frontend'] })).score, 3);
  assert.equal(teamFit(team, person({ canDo: ['Backend'] })).score, 0.5);
  assert.equal(teamFit(team, person({ canDo: ['Design'] })).score, 0, '−2 is floored at 0');
  assert.equal(teamFit(team, person({ canDo: ['Design', 'Pitch'] })).score, 4, 'the best of two roles');
});

test('a team and a person: both sides count', () => {
  const team = { counts: { Design: 1 }, needs: ['Frontend'], goal: 'win', hours: 6, availability: ['sat_am'] };
  const fe = person({ canDo: ['Frontend'], availability: ['sat_am'] });
  // team side 4 + 2 + 1 + 1 = 8; person side 4 + 2 + 1 + 1 = 8: √(8/9 × 8/9) = 88.9
  assert.equal(teamMatch(team, fe).score, 89);
  assert.deepEqual(teamMatch(team, fe).reasons[0], { kind: 'needed', roles: ['Frontend'] });
});

test('the same input always gives the same order', () => {
  const list = [{ id: 'b', score: 50 }, { id: 'a', score: 50 }, { id: 'c', score: 80 }];
  assert.deepEqual(rank(list).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(rank([...list].reverse()).map((x) => x.id), ['c', 'a', 'b']);
});
