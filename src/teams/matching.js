/* Matching, as pure functions (tested in tests/matching.test.js).
   Everyone says which role they take. We put different roles together:
   a role the side does not have yet scores high, a second person in the
   same role scores a little, a third scores below zero. If a team says it
   still needs a role (even one it already has), that role scores highest.
   Then: the same goal, similar hours, a shared time to work, and shared topics. */


export const overlap = (a = [], b = []) => a.filter((x) => b.includes(x));
export function roleFit(roles, counts, needs = []) {
  return Math.max(...roles.map((r) => (needs.includes(r) ? 4 : !counts[r] ? 3 : counts[r] === 1 ? 0.5 : -2)));
}
// Roles worth pointing out: ones the other side lacks or asked for
export const freshRoles = (roles, counts, needs = []) => roles.filter((r) => needs.includes(r) || !counts[r]);
export function vibe(a, b) {
  return (a.goal === b.goal ? 2 : 0)
    + (Math.abs(Number(a.hours) - Number(b.hours)) <= 3 ? 1 : 0)
    + (overlap(a.availability, b.availability).length ? 1 : 0)
    + Math.min(2, overlap(a.topics, b.topics).length);
}
