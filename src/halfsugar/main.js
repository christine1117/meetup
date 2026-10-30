/* =========================================================
   Half Sugar app
   Demo mode: there is no backend. Data lives in this browser's
   localStorage, the other people (PEOPLE) are simulated, and
   their replies are pre-written lines.
   To make this a real multi-user product, replace load / save
   and themReply with calls to a backend.

   Files: people (sample people), state (saved data), matching,
   conversations, simulate (sample replies), toppings, modal, screens/*
   (one per page), shell (layout + render), forms, actions, events.
   Shared pieces (cup drawing, sugar rules, profile) are in ../shared.

   Interface text goes through L`...` (see shared/i18n.js), so it can be
   shown in English or Traditional Chinese. What people write
   (posts, messages, profiles) stays in the language it was written in.
   ========================================================= */

import '../shared/log.js?v=20261030e';
import { later } from '../shared/core.js?v=20261030e';
import { logError } from '../shared/log.js?v=20261030e';
import { learnWeights } from './matching.js?v=20261030e';
import { S } from './state.js?v=20261030e';
import { resolveReveal, scheduleAccept } from './conversations.js?v=20261030e';
import { scheduleIncoming } from './simulate.js?v=20261030e';
import { render } from './shell.js?v=20261030e';
// Clicks, typing and timers are wired up here
import './events.js?v=20261030e';


/* ---------- Start ---------- */

// After a reload, pick the unfinished simulations back up.
// If old data trips this up, still draw the page.
try {
  S.threads.forEach((t) => {
    if (t.status === 'pending') scheduleAccept(t);
    if (t.reveal && t.reveal.me && !t.reveal.them) later(2600, () => resolveReveal(t));
  });
  learnWeights();
  S.myThoughts.forEach((item) => scheduleIncoming(item, 'thought'));
  S.myPosts.forEach((item) => scheduleIncoming(item, 'post'));
} catch (err) {
  logError('start', err);
}

render();
