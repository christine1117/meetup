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
import { enabledProviders, loadProfile, returningFromSignIn } from '../shared/account.js?v=20261031b';
import { logError } from '../shared/log.js?v=20261031b';
import { whoAmI } from './forms.js?v=20261031b';

import { $ } from '../shared/core.js?v=20261031b';
import { at } from '../shared/cup.js?v=20261031b';
import { closesText } from '../shared/sugar.js?v=20261031b';
import { S, U, saveMe } from './state.js?v=20261031b';
import { loadComps } from './competitions.js?v=20261031b';
import { go, route } from './router.js?v=20261031b';
import { chatById } from './chats.js?v=20261031b';
import { closeModal } from './views/modal.js?v=20261031b';
import { PAGE } from './views/competitions.js?v=20261031b';
import { render } from './render.js?v=20261031b';
import { formData, forms } from './forms.js?v=20261031b';
import { acts } from './actions.js?v=20261031b';

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
document.addEventListener('input', (e) => {
  if (e.target.id !== 'c-search') return;
  U.q = e.target.value;
  U.shown = PAGE;
  const at = e.target.selectionStart;
  render({ focus: 'c-search' });
  const el = document.getElementById('c-search');
  if (el) el.setSelectionRange(at, at);
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
  U.confirmReset = false;
  U.authMsg = null;
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

render();
loadComps(render);

// Already logged in on this browser? Bring the profile back from the account.
// (The account library only loads when there is a saved login.)
let hasLogin = false;
try { hasLogin = !!localStorage.getItem('halfsugar.auth'); } catch { /* storage is off */ }
if (hasLogin || returningFromSignIn()) {
  whoAmI().then(async (user) => {
    U.user = user;
    if (user) {
      const me = await loadProfile();
      if (me) saveMe(me);
      else if (!S.me) U.needProfile = true;
    }
    // Tidy the address after a sign-in link (?code=...), keeping the #/ route
    if (returningFromSignIn()) history.replaceState(null, '', location.pathname + location.hash);
    render();
  }).catch((err) => logError('account', err));
}

// Which other accounts (Google, Apple, LinkedIn) are switched on, for the sign-in buttons
enabledProviders().then((list) => { U.providers = list; if (list.length && !S.me) render(); });
