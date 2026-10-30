/* ---------- Buttons ---------- */

import { $, later } from '../shared/core.js?v=20261030e';
import { L } from '../shared/i18n.js?v=20261030e';
import { CLOSE_AFTER_DAYS, REVEAL_AT, isCold, sugarOf } from '../shared/sugar.js?v=20261030e';
import { MAX_ROLES, P, openRoles, rolesOf } from './people.js?v=20261030e';
import { MAX_TAGS, normTag } from './matching.js?v=20261030e';
import { D, KEY, S, U, save } from './state.js?v=20261030e';
import { go } from './router.js?v=20261030e';
import { toast } from './ui.js?v=20261030e';
import { createThread, pushMsg, resolveReveal, sugarNotes, thread } from './conversations.js?v=20261030e';
import { MAX_SHOWN, earnBox, openNextBox, shownToppings } from './toppings.js?v=20261030e';
import { REDUCED_MOTION, closeModal, renderModal } from './modal.js?v=20261030e';
import { syncRoleDescs } from './screens/brew.js?v=20261030e';
import { dropDecide, dropEnd, dropStart } from './screens/mystery.js?v=20261030e';
import { render } from './shell.js?v=20261030e';
import { tagList } from './screens/profile-form.js?v=20261030e';


export function takeResponse(el) {
  const list = el.dataset.key === 'thought' ? S.myThoughts : S.myPosts;
  const item = list.find((x) => x.id === el.dataset.id);
  if (!item) return {};
  const i = item.responses.findIndex((r) => r.pid === el.dataset.pid);
  const [resp] = i >= 0 ? item.responses.splice(i, 1) : [];
  return { item, resp };
}

export const acts = {
  compose(el) {
    U.compose = el.dataset.what || null;
    if (U.compose === 'post') U.draft = { kind: 'side', roles: [] };
    if (U.compose === 'thought') U.nudgeOff = false;
    render({ fresh: true, focus: U.compose === 'thought' ? 'f-text' : U.compose === 'post' ? 'f-title' : null });
  },
  target(el) { U.target = el.dataset.id || null; render({ fresh: true, focus: U.target ? 'f-reply' : null }); },

  accept(el) {
    const key = el.dataset.key;
    const { item, resp } = takeResponse(el);
    if (!resp) return;
    const t = key === 'thought'
      ? createThread(resp.pid, 'explore', item.id + resp.pid, 'open', 'They responded to your thought: "{0}"', [item.text])
      : createThread(resp.pid, 'build', item.id + resp.pid, 'open', 'They applied anonymously to your post: "{0}"', [item.title]);
    t.msgs.push({ from: 'them', text: resp.text, at: Date.now() });
    save();
    go('chats/' + t.id);
  },

  decline(el) { takeResponse(el); save(); render(); },

  reveal(el) {
    const t = thread(el.dataset.id);
    if (!t || t.reveal.me || isCold(t) || sugarOf(t) < REVEAL_AT) return;
    t.reveal.me = true;
    pushMsg(t, 'sys', 'You popped your seal. Waiting for them.');
    later(2600, () => resolveReveal(t));
  },

  call(el) {
    // External video: opens a Jitsi room. The simulated person will not actually join.
    window.open(`https://meet.jit.si/HalfSugar-${el.dataset.id}`, '_blank', 'noopener');
    toast(L`Call room opened in a new tab`);
  },

  // Both check in at a boba run: a gift box
  checkin(el) {
    const t = thread(el.dataset.id);
    if (!t || !t.booking || t.booking.me) return;
    t.booking.me = true;
    pushMsg(t, 'sys', 'You checked in at the boba run.');
    later(2200, () => {
      if (!thread(t.id) || t.booking.met) return;
      t.booking.met = true;
      pushMsg(t, 'sys', '{0} checked in too. You both showed up!', [P[t.pid].alias]);
      earnBox('small', 'For showing up to a boba run with {0}.', [P[t.pid].alias]);
    });
  },

  'book-open'(el) { U.booking = el.dataset.id; render({ fresh: true, focus: 'f-area' }); },
  'book-close'() { U.booking = null; render({ fresh: true }); },

  'drop-join'() {
    D.phase = 'matching';
    render();
    later(2200, () => { if (D.phase === 'matching') dropStart(); });
  },
  'drop-end'() { dropEnd(); },
  'drop-yes'() { dropDecide(); },
  'drop-no'() { D.phase = 'result'; D.result = 'passed'; render(); },
  'drop-reset'() { D.phase = 'idle'; D.pid = null; D.msgs = []; render(); },


  cat(el) { U.cat = el.dataset.value; render(); },
  'dm-open'(el) { U.dm = { pid: el.dataset.pid, spot: el.dataset.spot }; render({ fresh: true, focus: 'f-dm' }); },
  'dm-close'() { U.dm = null; render({ fresh: true }); },

  profile(el) {
    U.modal = { type: 'profile', pid: el.dataset.pid };
    renderModal();
  },
  'modal-close'() { closeModal(); },
  // Arrows beside the topping row scroll it sideways
  strip(el) {
    const row = el.parentElement.querySelector('.pick-strip');
    if (!row) return;
    const from = row.scrollLeft;
    const to = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, from + Number(el.dataset.dir) * row.clientWidth * 0.7));
    row.scrollTo({ left: to, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    // Some browsers skip smooth scrolling; make sure the row still moves
    later(450, () => { if (row.scrollLeft === from) row.scrollLeft = to; });
  },
  'topping-toggle'(el) {
    const k = el.dataset.id;
    const list = shownToppings();
    if (list.includes(k)) S.shown = list.filter((x) => x !== k);
    else if (list.length >= MAX_SHOWN) { toast(L`Your cup holds ${MAX_SHOWN}. Take one out first.`); return; }
    else S.shown = [...list, k];
    save();
    render();
  },
  'box-next'() { openNextBox(); },
  'box-pick'(el) {
    const m = U.modal;
    if (!m || m.type !== 'box' || m.phase !== 'pick') return;
    m.picked = Number(el.dataset.i);
    m.phase = 'shake';
    renderModal();
    later(REDUCED_MOTION ? 0 : 750, () => {
      if (U.modal !== m) return;
      const k = m.contents[m.picked];
      S.shown = shownToppings();
      S.toppings[k] = (S.toppings[k] || 0) + 1;
      // A new topping goes into your cup if there is room
      if (!S.shown.includes(k) && S.shown.length < MAX_SHOWN) S.shown.push(k);
      S.boxes = S.boxes.filter((b) => b.id !== m.box.id);
      m.phase = 'open';
      save();
      renderModal();
      render();
    });
  },
  // Development shortcut: a free gift box to try the game. Remove before launch.
  'to-brew'() {
    const box = $('#f-text');
    U.pendingBrew = box ? box.value.trim() : '';
    go('build');
  },
  'nudge-off'() {
    U.nudgeOff = true;
    const box = $('#brew-nudge');
    if (box) box.hidden = true;
  },
  'dev-box'() { earnBox('small', 'A free box for testing.'); },

  'quiz-pick'(el) {
    const q = U.quiz;
    const step = q.step;
    q[el.dataset.key] = el.dataset.value;
    render();
    // The meet question shares its screen with the city, so it waits for Next
    if (el.dataset.key !== 'meet') later(220, () => { if (q.step === step) { q.step += 1; render({ fresh: true }); } });
  },
  // First pick is the main field, second pick makes it a two-flavor cup. Tap again to remove.
  'quiz-field'(el) {
    const q = U.quiz;
    const v = el.dataset.value;
    if (q.field === v) { q.field = q.field2; q.field2 = ''; }
    else if (q.field2 === v) q.field2 = '';
    else if (!q.field) q.field = v;
    else q.field2 = v;
    render();
  },
  // Add tags from a suggestion or the text box (several at once, split by commas)
  'tag-add'(el) {
    const { scope, key } = el.dataset;
    const list = tagList(scope, key);
    const input = document.getElementById(`c-tag-${key}`);
    const raw = el.dataset.value || (input ? input.value : '');
    raw.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (list.length < MAX_TAGS && !list.some((x) => normTag(x) === normTag(t))) list.push(t);
    });
    if (input) input.value = '';
    if (scope === 'me') save();
    render({ focus: `c-tag-${key}` });
  },
  'role-add'(el) {
    syncRoleDescs();
    const input = document.getElementById('c-role');
    const raw = el.dataset.value || (input ? input.value : '');
    raw.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (U.draft.roles.length < MAX_ROLES && !U.draft.roles.some((r) => normTag(r.name) === normTag(t))) U.draft.roles.push({ name: t, desc: '' });
    });
    if (input) input.value = '';
    render({ focus: 'c-role' });
  },
  'role-remove'(el) {
    syncRoleDescs();
    U.draft.roles.splice(Number(el.dataset.i), 1);
    render();
  },
  // The author ticks a role off when it is filled, or opens it again
  'role-toggle'(el) {
    const b = S.myPosts.find((x) => x.id === el.dataset.id);
    if (!b) return;
    b.roles = rolesOf(b);
    const role = b.roles[Number(el.dataset.i)];
    role.filled = !role.filled;
    save();
    if (!openRoles(b).length) toast(L`Team complete. Nice brew.`);
    render();
  },
  'tag-remove'(el) {
    const list = tagList(el.dataset.scope, el.dataset.key);
    const i = list.indexOf(el.dataset.value);
    if (i >= 0) list.splice(i, 1);
    if (el.dataset.scope === 'me') save();
    render();
  },
  'quiz-next'() {
    const city = document.getElementById('f-city');
    if (U.quiz.step === 1 && city) U.quiz.city = city.value.trim();
    U.quiz.step += 1;
    render({ fresh: true });
  },
  'quiz-back'() {
    const city = document.getElementById('f-city');
    if (U.quiz.step === 1 && city) U.quiz.city = city.value.trim();
    U.quiz.step = Math.max(0, U.quiz.step - 1);
    render({ fresh: true });
  },

  // Development shortcuts for chats. Remove before launch.
  'dev-time'(el) {
    const t = thread(el.dataset.id);
    if (!t) return;
    const before = sugarOf(t);
    t.devMin = (t.devMin || 0) + 5;
    sugarNotes(t, before);
    save();
    render();
  },
  'dev-days'(el) {
    const t = thread(el.dataset.id);
    if (!t) return;
    const shift = CLOSE_AFTER_DAYS * 86400000 + 60000;
    t.msgs.forEach((m) => { if (m.at) m.at -= shift; });
    t.at -= shift;
    save();
    render();
  },

  // Development shortcut: skip onboarding with a sample card. Remove before launch.
  'dev-skip'() {
    S.me = { alias: 'Dev', city: 'Taipei', field: 'Design', meet: 'both', curious: ['Pricing', 'AI products'], fun: 'Has tried every boba shop on one street', name: 'Dev User', title: 'Builder', school: '', company: '', contactType: 'instagram', contact: '@devuser' };
    save();
    U.lastPath = null;
    go('explore');
    render({ fresh: true });
  },


  reset() { U.confirmReset = true; render(); },
  'reset-no'() { U.confirmReset = false; render(); },
  'reset-yes'() {
    try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
    location.hash = '';
    location.reload();
  },
};
