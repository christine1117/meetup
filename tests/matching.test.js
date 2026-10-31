import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitFor, rank, soloMatch, teamFit, teamMatch, toHundred } from '../src/teams/matching.js';

// spec.md §21 "Recommendation" acceptance criteria, one test each where it applies here
const person = (o) => ({ canDo: [], wants: [], goal: 'win', hours: 6, availability: [], curious: [], ...o });

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
  const free = ['sat_am', 'sat_pm', 'sun_pm'];
  const curious = ['AI products', 'Music'];
  const a = person({ canDo: ['Design'], wants: ['Frontend'], availability: free, curious });
  const b = person({ canDo: ['Frontend'], wants: ['Design'], availability: free, curious });
  // each side: role 4 + goal 2 + hours 1 + free time 2 + curious 2 = 11
  assert.equal(soloMatch(a, b).score, 100);
  const c = person({ canDo: ['Frontend'], wants: ['Data'], availability: free, curious });
  // a likes c (11), c does not want a's role (0 + 2 + 1 + 2 + 2 = 7): √(11/11 × 7/11) = 79.8
  assert.equal(soloMatch(a, c).score, 80);
  assert.equal(soloMatch(a, c).score, soloMatch(c, a).score, 'the same from either side');
  assert.equal(toHundred(9, 0), 0, 'nothing from one side is nothing overall');
});

test('shared "Curious about" topics: one point each, up to two', () => {
  const a = person({ canDo: ['Design'], wants: ['Frontend'], goal: 'learn', hours: 30 });
  const b = (curious) => person({ canDo: ['Backend'], goal: 'win', hours: 6, curious });
  assert.equal(fitFor({ ...a, curious: ['Music', 'Travel', 'Food'] }, b(['Music'])).score, 1);
  assert.equal(fitFor({ ...a, curious: ['Music', 'Travel', 'Food'] }, b(['Music', 'Travel', 'Food'])).score, 2, 'at most two');
  assert.equal(fitFor({ ...a, curious: [] }, b(['Music'])).score, 0, 'not filled in: nothing');
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
  // team side 4 + 2 + 1 + 1 = 8; person side 4 + 2 + 1 + 1 = 8: √(8/11 × 8/11) = 72.7
  assert.equal(teamMatch(team, fe).score, 73);
  assert.deepEqual(teamMatch(team, fe).reasons[0], { kind: 'needed', roles: ['Frontend'] });
});

test('the same input always gives the same order', () => {
  const list = [{ id: 'b', score: 50 }, { id: 'a', score: 50 }, { id: 'c', score: 80 }];
  assert.deepEqual(rank(list).map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(rank([...list].reverse()).map((x) => x.id), ['c', 'a', 'b']);
});
