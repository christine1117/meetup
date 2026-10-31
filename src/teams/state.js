/* Saved data for team mode: your competition cards, teams and chats.
   Your profile is saved separately (see ../shared/profile.js). */

import { readProfile, writeProfile } from '../shared/profile.js?v=20261031c';
import { MAX_ROLES } from './options.js?v=20261031c';

export const KEY = 'halfsugar.teams.v1';
export const blank = () => ({ me: null, cards: {}, chats: [], teams: [], compCache: {} });
export function load() {
  try {
    const s = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    ['chats', 'teams'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    s.chats.forEach((c) => { c.votes = c.votes || {}; });
    // Older versions stored role slots; now a team just has an optional "still need" list
    s.teams.forEach((t) => { if (!t.needs) t.needs = (t.roles || []).filter((r) => !r.by).map((r) => r.name); delete t.roles; });
    Object.values(s.cards).forEach((c) => { c.topics = c.topics || []; c.canDo = (c.canDo || []).slice(0, MAX_ROLES); });
    if (!s.compCache || typeof s.compCache !== 'object') s.compCache = {};
    return s;
  } catch {
    return blank();
  }
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage is off; the page still works */ }
}
export let S = load();

// The profile lives in shared/profile.js (and in your account when signed in)
export function syncMe() {
  const me = readProfile();
  if (me) S.me = me;
}
export function saveMe(me) {
  S.me = me;
  save();
  writeProfile(me);
}
syncMe();
export const U = { form: null, hi: null, typing: {}, confirmReset: false, auth: 'signup', authMsg: null, busy: false, user: null, needProfile: false };
U.lastPath = null;
