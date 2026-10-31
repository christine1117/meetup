/* =========================================================
   Half Sugar: find teammates for competitions
   Find teammates for competitions and hackathons by what people can
   do, not where they studied.

   1. Pick a competition and fill in a competition card
   2. See recommended people and teams (different roles first), say hi
   3. Chat to half sugar, then the Team up button unlocks
   4. Both tap it: names are revealed and you become a team with a group chat
   Friends join a team through an invite link, no chat needed.

   Competitions are real: the crawler (crawler/run.js) collects them once a
   day from Devpost, MLH and 獎金獵人 into data/competitions.json.
   People and chats are still samples until accounts exist; your data stays in
   this browser.

   This file wires up events and starts the app. The rest lives in:
   competitions (data), rules + matching (logic), chats, views/* (HTML),
   render, forms, actions. Shared pieces are in ../shared.
   ========================================================= */
import { enabledProviders, loadProfile, returningFromSignIn, saveProfile, signInFailed } from '../shared/account.js?v=20261031z';
import { L } from '../shared/i18n.js?v=20261031z';
import { logError } from '../shared/log.js?v=20261031z';
import { whoAmI } from './forms.js?v=20261031z';

import { $ } from '../shared/core.js?v=20261031z';
import { at } from '../shared/cup.js?v=20261031z';
import { closesText } from '../shared/sugar.js?v=20261031z';
import { S, U, saveMe } from './state.js?v=20261031z';
import { MAX_CURIOUS, isUnsynced, markUnsynced } from '../shared/profile.js?v=20261031z';
import { loadComps } from './competitions.js?v=20261031z';
import { loadCards } from './server.js?v=20261031z';
import { go, route } from './router.js?v=20261031z';
import { chatById } from './chats.js?v=20261031z';
import { closeModal } from './views/modal.js?v=20261031z';
import { curiousChecks } from './views/profile.js?v=20261031z';
import { render } from './render.js?v=20261031z';
import { autosave, formData, forms } from './forms.js?v=20261031z';
import { acts } from './actions.js?v=20261031z';

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
});
// Escape closes the pop-up; tapping the big cup takes it apart
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && U.modal) closeModal();
});
document.addEventListener('click', (e) => {
  const c = e.target.closest('.cup-x');
  if (c && !c.closest('button, a')) c.classList.toggle('is-apart');
});
// The My order page also saves while you type, once you pause
let typingPause;
document.addEventListener('input', (e) => {
  const auto = e.target.form && e.target.form.dataset.auto && e.target.name !== 'curious' ? e.target.form : null;
  if (auto) {
    clearTimeout(typingPause);
    typingPause = setTimeout(() => autosave(auto), 700);
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'c-search') return;
  U.q = e.target.value;
  U.page = 1;
  const at = e.target.selectionStart;
  render({ focus: 'c-search' });
  const el = document.getElementById('c-search');
  if (el) el.setSelectionRange(at, at);
});
// "Curious about": a ticked topic moves up to the picked ones (and back when unticked).
// Stop at MAX_CURIOUS ticks and say why.
// The Me page (data-auto) saves after every change.
document.addEventListener('change', (e) => {
  const form = e.target.closest('form');
  if (e.target.name === 'curious') {
    const wrap = e.target.closest('[data-curious]');
    const picked = [...wrap.querySelectorAll('input[name="curious"]:checked')].map((x) => x.value);
    if (e.target.checked && picked.length > MAX_CURIOUS) {
      e.target.checked = false;
      $('#curious-full', wrap).hidden = false;
      return;
    }
    wrap.innerHTML = curiousChecks(picked, wrap.querySelector('details').open);
    const same = [...wrap.querySelectorAll('input[name="curious"]')].find((x) => x.value === e.target.value);
    if (same) same.focus({ preventScroll: true });
  }
  if (form && form.dataset.auto) autosave(form);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form](form, formData(form));
});
document.addEventListener('toggle', (e) => {
  if (e.target.matches && e.target.matches('details[data-team]')) U.teamOpen = e.target.open ? e.target.dataset.team : null;
}, true);
window.addEventListener('hashchange', () => {
  // A friend's invite link: join that team straight away (demo: only your own teams exist here)
  const r = route();
  if (r.name === 'join') {
    const t = S.teams.find((x) => x.code === r.id);
    go(t ? 'team/' + t.id : 'comps');
    return;
  }
  U.form = null;
  U.hi = null;
  U.leave = null;
  if (U.modal) closeModal();
  U.authMsg = null;
  U.saved = false;
  render();
});
setInterval(() => {
  const r = route();
  if (r.name === 'chat') {
    const c = chatById(r.id);
    const el = $('.expiry');
    if (c && el) el.textContent = closesText(c);
  }
}, 30000);

// Back from Google / LinkedIn: say "Signing you in…" until the account answers
const back = returningFromSignIn();
U.busy = back;
// Cancelled at Google / LinkedIn, or it failed there
if (signInFailed()) {
  U.authMsg = { text: L`Sign-in did not finish. Please try again.` };
  history.replaceState(null, '', location.pathname + location.hash);
}
render();
loadComps(render);

// Already signed in on this browser, or just back from signing in? Bring the profile back.
// (The account library only loads when there is a saved login.)
let hasLogin = false;
try { hasLogin = !!localStorage.getItem('halfsugar.auth'); } catch { /* storage is off */ }
if (hasLogin || back) {
  whoAmI().then(async (user) => {
    U.user = user;
    if (!user) return;
    const me = await loadProfile();
    if (S.me && (!me || isUnsynced())) {
      // Made in this browser before signing in, or changed here while the account missed it
      await saveProfile(S.me);
      markUnsynced(false);
    } else if (me) saveMe(me);
    else U.needProfile = true;               // new here: fill in the profile next
    // Your participation cards (one per competition)
    await loadCards().catch((err) => logError('cards', err));
  }).catch((err) => {
    logError('account', err);
    if (back) U.authMsg = { text: L`Sign-in did not finish. Please try again.` };
  }).finally(() => {
    U.busy = false;
    // Tidy the address (?code=...), keeping the #/ route
    if (back) history.replaceState(null, '', location.pathname + location.hash);
    render();
  });
}

// Which sign-ins (Google, LinkedIn) are switched on in Supabase
enabledProviders().then((list) => { U.providers = list; });
