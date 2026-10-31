/* Saved data for team mode. Your participation cards live on the server
   (server.js) and are loaded when you sign in; teams and chats are still
   kept in this browser for now. Your profile is saved separately
   (see ../shared/profile.js). */

import { readProfile, writeProfile } from '../shared/profile.js?v=20261101d';

export const KEY = 'halfsugar.teams.v1';
export const blank = () => ({ me: null, cards: {}, chats: [], teams: [], compCache: {} });
export function load() {
  try {
    const s = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    ['chats', 'teams'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    s.chats.forEach((c) => { c.votes = c.votes || {}; });
    // Older versions stored role slots; now a team just has an optional "still need" list
    s.teams.forEach((t) => { if (!t.needs) t.needs = (t.roles || []).filter((r) => !r.by).map((r) => r.name); delete t.roles; });
    s.cards = {}; // from the server only (older versions kept them here)
    if (!s.compCache || typeof s.compCache !== 'object') s.compCache = {};
    return s;
  } catch {
    return blank();
  }
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...S, cards: {} })); } catch { /* storage is off; the page still works */ }
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
export const U = { form: null, hi: null, typing: {}, authMsg: null, busy: false, user: null, needProfile: false };
U.lastPath = null;
