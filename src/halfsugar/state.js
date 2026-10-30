// Everything Half Sugar saves lives under this key (the profile too, see shared/profile.js)
export const KEY = 'meetup.v1';

/* ---------- State ---------- */

import { P } from './people.js?v=20261030f';


export const blank = () => ({ me: null, myThoughts: [], myPosts: [], threads: [], drops: 0, toppings: {}, boxes: [] });

export function load() {
  try {
    const saved = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    // Old or damaged data: keep lists as lists and drop chats with people who no longer exist
    ['myThoughts', 'myPosts', 'threads', 'boxes'].forEach((k) => { if (!Array.isArray(saved[k])) saved[k] = []; });
    if (!saved.toppings || typeof saved.toppings !== 'object') saved.toppings = {};
    if (saved.me && typeof saved.me !== 'object') saved.me = null;
    // Older profiles kept only a LinkedIn link; it is now one contact of any kind
    if (saved.me && saved.me.linkedin && !saved.me.contact) Object.assign(saved.me, { contactType: 'linkedin', contact: saved.me.linkedin });
    saved.threads = saved.threads.filter((t) => t && P[t.pid] && Array.isArray(t.msgs));
    return saved;
  } catch {
    return blank();
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* Storage is unavailable. The page still works for this visit. */
  }
}

export let S = load();

// Screen state that does not need to be saved
export const U = {
  compose: null, target: null, booking: null, typing: {}, confirmReset: false,
  cat: 'all', dm: null, typingPost: null, openSec: {},
  draft: { kind: 'side', roles: [] },
  quiz: { step: 0, field: '', field2: '', stage: '', curious: [], share: [], meet: '', city: '' },
};
export const D = { phase: 'idle', pid: null, msgs: [], ends: 0, li: 0, typing: false, result: null };
U.lastPath = null;
