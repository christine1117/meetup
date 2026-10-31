/* Team and chat rules applied to your saved data: who is in which team,
   team size limits, who has to say yes, and the scores behind the
   recommendations (using matching.js).
   A chat with a team is a group chat: the whole team is in it. Everyone
   has to say yes to team up. Anyone can end it politely. */
import { L } from '../shared/i18n.js?v=20261031w';
import { cardTopics } from './options.js?v=20261031w';

import { S } from './state.js?v=20261031w';
import { compOf } from './competitions.js?v=20261031w';
import { P, demoPeople, seedTeam } from './sample-people.js?v=20261031w';
import { roleFit, vibe } from './matching.js?v=20261031w';

export const personOf = (id) => (id === 'me' ? { ...S.me, alias: L`You`, id: 'me' } : P[id]);
// Every team in a competition: other people's, plus the ones you are in
export const teamsIn = (cid) => {
  const seed = seedTeam(cid);
  return [...(seed && !S.teams.some((x) => x.id === seed.id) ? [seed] : []), ...S.teams.filter((t) => t.comp === cid)];
};
export const myTeam = (cid) => S.teams.find((t) => t.comp === cid && t.members.includes('me'));
export const members = (t) => (t.members.length === 1 ? L`1 member` : L`${t.members.length} members`);
// Each team sets its own size limit, never above what the competition's rules allow
export const DEFAULT_MAX = 5;
export const SIZE_CHOICES = [2, 3, 4, 5, 6, 8, 10];
const ruleSize = (cid) => (compOf(cid) && compOf(cid).team) || {};
// The most (and fewest) people the rules allow per team, when they say
const rulesMax = (cid) => { const t = ruleSize(cid); return t.max >= 2 && !t.unlimited ? t.max : null; };
const rulesMin = (cid) => Math.max(2, ruleSize(cid).min || 0);
// A new team starts with the competition's own limit when we know it
export const defaultMax = (cid) => rulesMax(cid) || Math.max(DEFAULT_MAX, rulesMin(cid));
// The limits a team can pick: from the rules' minimum up to the rules' maximum (and not below its members)
export function sizeChoices(cid, atLeast = 0) {
  const max = rulesMax(cid);
  // Every number up to the rules' maximum (up to 10, then the maximum itself); the usual list if they do not say
  const list = max ? [...Array.from({ length: Math.min(max, 10) - 1 }, (_, i) => i + 2), ...(max > 10 ? [max] : [])] : SIZE_CHOICES;
  const ok = list.filter((n) => n >= Math.max(rulesMin(cid), atLeast));
  return ok.length ? ok : [Math.max(rulesMin(cid), atLeast)];
}
// Whatever was picked (or saved before the rules were known) stays within the rules
export const withinRules = (cid, n) => Math.min(n || defaultMax(cid), rulesMax(cid) || Infinity);
export const teamMax = (t) => withinRules(t.comp, t.max);
export const isFull = (t) => t.members.length >= teamMax(t);
export const spots = (t) => L`${t.members.length} of ${teamMax(t)} spots`;
export const myRoles = (cid) => (S.cards[cid] ? S.cards[cid].canDo : []);
export const teamRoles = (t) => [...new Set(t.members.flatMap((m) => (m === 'me' ? myRoles(t.comp) : P[m].canDo)))];
export const needsOf = (t) => t.needs || [];
export const inATeam = (pid, cid) => teamsIn(cid).some((t) => t.members.includes(pid));
export const chatWith = (cid, kind, ref) => S.chats.find((c) => c.comp === cid && c.kind === kind && c.ref === ref);
export const passed = (cid, kind, ref) => { const c = chatWith(cid, kind, ref); return c && c.status === 'closed'; };

/* Who is in a chat, and who has to say yes.
   A chat with a team (or from your team) is a group chat: the whole team is in it.
   Everyone has to say yes to team up. Anyone can end it politely. */
export const sideTeam = (c) => (c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref) : myTeam(c.comp));
export function voters(c) {
  const t = sideTeam(c);
  const list = c.kind === 'team' ? ['me', ...t.members] : [...(t ? t.members : ['me']), c.ref];
  return [...new Set(list)];
}
export const isGroup = (c) => voters(c).length > 2;
export const nick = (id, c) => (id === 'me' ? L`You` : c && c.revealed ? P[id].real.name : P[id].alias);
export const PASS_TEXT = 'Thanks for chatting! I don’t think it’s the right fit this time. Good luck with the competition.';

export function roleCounts(ids, cid) {
  const n = {};
  ids.forEach((m) => (m === 'me' ? myRoles(cid) : P[m].canDo).forEach((r) => { n[r] = (n[r] || 0) + 1; }));
  return n;
}
export const sideOf = (cid) => { const t = myTeam(cid); return t ? t.members : ['me']; };
export function personScore(p, cid) {
  const t = myTeam(cid);
  const card = S.cards[cid];
  return roleFit(p.canDo, roleCounts(sideOf(cid), cid), t ? needsOf(t) : []) + vibe(p, { ...card, topics: cardTopics(card) }) + p.reply;
}
export function teamScore(t, cid) {
  const lead = P[t.members[0]];
  const topics = [...new Set(t.members.flatMap((m) => P[m].topics))];
  const card = S.cards[cid];
  return roleFit(myRoles(cid), roleCounts(t.members, cid), needsOf(t)) + vibe({ ...lead, topics }, { ...card, topics: cardTopics(card) }) + lead.reply;
}
export function recommendations(cid) {
  const mine = myTeam(cid);
  if (mine && isFull(mine)) return [];
  // Anyone you (or they) passed on is not shown again in this competition
  const people = demoPeople(cid).filter((p) => !inATeam(p.id, cid) && !passed(cid, 'person', p.id))
    .map((p) => ({ kind: 'person', ref: p.id, score: personScore(p, cid) }));
  const teams = mine ? [] : teamsIn(cid).filter((t) => !t.members.includes('me') && !isFull(t) && !passed(cid, 'team', t.id))
    .map((t) => ({ kind: 'team', ref: t.id, score: teamScore(t, cid) }));
  return [...people, ...teams].sort((a, b) => b.score - a.score);
}

// Names unlock once you are on the same team, or after teaming up in a chat
export const knows = (pid) => S.teams.some((t) => t.members.includes('me') && t.members.includes(pid)) || S.chats.some((c) => c.ref === pid && c.revealed);
