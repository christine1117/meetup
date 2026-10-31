/* Matching, as pure functions (spec.md §7–§9; tested in tests/matching.test.js).

   Every pairing is scored from both sides, each side 0–9 points, then
   combined: MatchScore = 100 × √(A/9 × B/9), from 0 to 100. It only orders the
   list; it is not a chance of teaming up. Missing data adds nothing.

   Points on each side (the spec's 2 topic points are 2 points for free time,
   since cards no longer ask for topics):
     role        two people: +4 the other has a role you want; +2 you did not
                 say what you want and their role is different from yours
                 a team's view: +4 a role it says it needs, +3 a role it has
                 none of, +0.5 it has one, −2 it has two or more
                 a person's view of a team: +4 it needs your role, +2 it has
                 none of your role yet
     goal        +2 the same goal
     time        +1 hours a week within 3 of each other
     free time   +1 one or two shared free slots, +2 three or more

   Each result also says why, as plain facts (kind + roles / slots); the page
   turns them into words. No reason is made up: only what added points. */

export const MAX_FIT = 9;
export const overlap = (a = [], b = []) => a.filter((x) => b.includes(x));
const clip = (n) => Math.max(0, Math.min(MAX_FIT, n));
export const toHundred = (a, b) => Math.round(100 * Math.sqrt((clip(a) / MAX_FIT) * (clip(b) / MAX_FIT)));

// Goal, time and free time: the same from either side
function shared(a, b) {
  const reasons = [];
  let points = 0;
  if (a.goal && a.goal === b.goal) { points += 2; reasons.push({ kind: 'goal', goal: a.goal }); }
  if (Number.isFinite(Number(a.hours)) && Number.isFinite(Number(b.hours)) && Math.abs(a.hours - b.hours) <= 3) {
    points += 1;
    reasons.push({ kind: 'hours' });
  }
  const free = overlap(a.availability, b.availability);
  if (free.length) { points += free.length >= 3 ? 2 : 1; reasons.push({ kind: 'free', slots: free }); }
  return { points, reasons, missing: !(a.availability || []).length || !(b.availability || []).length };
}

// How good B is for A, from A's side (spec §7.2)
export function fitFor(a, b) {
  const wanted = overlap(b.canDo, a.wants);
  let role = 0;
  let why = null;
  if (wanted.length) { role = 4; why = { kind: 'wanted', roles: wanted }; }
  else if (!(a.wants || []).length && (b.canDo || []).length && !overlap(b.canDo, a.canDo).length) { role = 2; why = { kind: 'different', roles: b.canDo }; }
  const s = shared(a, b);
  return { score: clip(role + s.points), role: why, reasons: s.reasons, missing: s.missing };
}

// Two people without a team (spec §7.3)
export function soloMatch(me, them) {
  const mine = fitFor(me, them);
  const theirs = fitFor(them, me);
  const roleReasons = [mine.role, theirs.role && theirs.role.kind === 'wanted' ? { kind: 'theyWant', roles: theirs.role.roles } : null];
  return { score: toHundred(mine.score, theirs.score), reasons: [...roleReasons, ...mine.reasons].filter(Boolean).slice(0, 3), missing: mine.missing };
}

// A team's view of someone (spec §8.2). team: { counts: role -> how many, needs, goal, hours, availability }
export function teamFit(team, person) {
  let best = { points: -Infinity, role: null };
  (person.canDo || []).forEach((r) => {
    const n = team.counts[r] || 0;
    const points = team.needs.includes(r) ? 4 : n === 0 ? 3 : n === 1 ? 0.5 : -2;
    if (points > best.points) best = { points, role: r };
  });
  if (best.role === null) best = { points: 0, role: null };
  const why = best.points === 4 ? { kind: 'needed', roles: [best.role] } : best.points === 3 ? { kind: 'newRole', roles: [best.role] } : null;
  const s = shared(team, person);
  return { score: clip(best.points + s.points), role: why, reasons: s.reasons, missing: s.missing };
}

// Someone's view of a team (spec §8.3)
export function personFitsTeam(person, team) {
  const open = overlap(person.canDo, team.needs);
  let role = 0;
  if (open.length) role = 4;
  else if ((person.canDo || []).some((r) => !team.counts[r])) role = 2;
  return clip(role + shared(person, team).points);
}

// A team and someone without one: both sides (spec §8.4)
export function teamMatch(team, person) {
  const theirs = teamFit(team, person);
  return { score: toHundred(theirs.score, personFitsTeam(person, team)), reasons: [theirs.role, ...theirs.reasons].filter(Boolean).slice(0, 3), missing: theirs.missing };
}

// Roles worth pointing out on a card: ones your side lacks or asked for
export const freshRoles = (roles = [], counts = {}, needs = []) => roles.filter((r) => needs.includes(r) || !counts[r]);

// Highest score first; the same score in a fixed order (by id), so the list is the same every time
export const rank = (list) => [...list].sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
