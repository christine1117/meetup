/* ---------- Conversations ---------- */

import { later, uid } from '../shared/core.js?v=20261030f';
import { L } from '../shared/i18n.js?v=20261030f';
import { REVEAL_AT, sugarOf } from '../shared/sugar.js?v=20261030f';
import { P } from './people.js?v=20261030f';
import { learnWeights, stampMatch } from './matching.js?v=20261030f';
import { S, U, save } from './state.js?v=20261030f';
import { viewing } from './router.js?v=20261030f';
import { toast } from './ui.js?v=20261030f';
import { earnBox } from './toppings.js?v=20261030f';
import { render } from './shell.js?v=20261030f';


export const thread = (tid) => S.threads.find((t) => t.id === tid);
export const threadFor = (origin, ref) => S.threads.find((t) => t.origin === origin && t.ref === ref);

export function createThread(pid, origin, ref, status, intro, vars) {
  const t = { id: uid(), pid, origin, ref, status, msgs: [], li: 0, reveal: { me: false, them: false }, booking: null, unread: 0, at: Date.now() };
  if (intro) t.msgs.push({ from: 'sys', text: intro, vars, at: Date.now() });
  stampMatch(t);
  S.threads.push(t);
  return t;
}

// System notes pass an English key (and vars) so they can be shown in either language
export function pushMsg(t, from, text, vars) {
  const before = sugarOf(t);
  t.msgs.push({ from, text, vars, at: Date.now() });
  sugarNotes(t, before);
  t.at = Date.now();
  if (from !== 'me' && !viewing(t.id)) t.unread += 1;
  save();
  render();
}

export function themReply(t, delay = 1700) {
  U.typing[t.id] = true;
  render();
  later(delay, () => {
    U.typing[t.id] = false;
    if (!thread(t.id)) return;
    const p = P[t.pid];
    const line = p.lines[t.li % p.lines.length];
    t.li += 1;
    pushMsg(t, 'them', line);
  });
}

export function scheduleAccept(t) {
  later(3200, () => {
    if (!thread(t.id) || t.status !== 'pending') return;
    t.status = 'open';
    pushMsg(t, 'sys', 'They accepted. Take your first sip.');
    toast(L`${P[t.pid].alias} accepted your response`);
    themReply(t, 1500);
  });
}

export function resolveReveal(t) {
  if (!thread(t.id) || !t.reveal.me || t.reveal.them) return;
  const mine = t.msgs.filter((m) => m.from === 'me').length;
  if (mine >= 2) {
    t.reveal.them = true;
    pushMsg(t, 'sys', 'You both popped the seal. Identities are unlocked.');
    toast(L`Seal popped`);
  } else {
    t.reveal.me = false;
    pushMsg(t, 'them', "Let's sip a bit longer before we pop the seal.");
  }
}

// Add a note in the chat when it reaches half sugar or full sugar.
// System notes are saved as English keys and translated when shown.
export function sugarNotes(t, before) {
  const after = sugarOf(t);
  if (before < REVEAL_AT && after >= REVEAL_AT && !t.reveal.them) {
    t.msgs.push({ from: 'sys', text: 'Half sugar! You can pop the seal now.', at: Date.now() });
    learnWeights();
  }
  if (before < 100 && after >= 100) {
    t.msgs.push({ from: 'sys', text: 'Full sugar. Maybe it is time for a boba run?', at: Date.now() });
  }
  // Reaching half sugar earns a gift box, once per chat
  if (before < REVEAL_AT && after >= REVEAL_AT && !(t.rewards && t.rewards.half)) {
    t.rewards = { ...t.rewards, half: true };
    earnBox('small', 'For reaching half sugar with {0}.', [P[t.pid].alias]);
  }
}
