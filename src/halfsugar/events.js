/* ---------- Events ---------- */

import { $ } from '../shared/core.js?v=20261030e';
import { SEED_POSTS, hasEvent, rolesOf } from './people.js?v=20261030e';
import { D, U } from './state.js?v=20261030e';
import { closeModal, renderModal } from './modal.js?v=20261030e';
import { clock, countdownText, dropEnd } from './screens/mystery.js?v=20261030e';
import { render } from './shell.js?v=20261030e';
import { formData, forms } from './forms.js?v=20261030e';
import { acts } from './actions.js?v=20261030e';


document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
});

// A mouse wheel over the topping row scrolls it sideways
document.addEventListener('wheel', (event) => {
  const row = event.target.closest && event.target.closest('.pick-strip');
  if (!row || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const max = row.scrollWidth - row.clientWidth;
  if (max <= 0) return;
  event.preventDefault();
  row.scrollLeft = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
}, { passive: false });

// Remember which sections on Me are open
document.addEventListener('toggle', (event) => {
  const d = event.target;
  if (d.matches && d.matches('details[data-sec]')) U.openSec[d.dataset.sec] = d.open;
}, true);

// Tap a big cup to pull it apart, tap again to put it back
document.addEventListener('click', (event) => {
  const c = event.target.closest('.cup-x');
  if (c && !c.closest('button, a')) c.classList.toggle('is-apart');
});

// Enter in a tag box adds the tag instead of sending the form
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && U.modal) { closeModal(); return; }
  const el = event.target.closest('[data-tag-input], [data-role-input]');
  if (!el || event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  acts[el.hasAttribute('data-role-input') ? 'role-add' : 'tag-add'](el);
});

// Words that usually mean someone is recruiting, not starting a discussion
export const RECRUITING = /\b(co-?founders?|teammates?|team members?|collaborators?|hiring|recruit(ing)?|join (my|our) team|(looking for|need|seeking) (a |an |some |someone |people |)(designers?|developers?|engineers?|marketers?|partners?|photographers?|editors?|analysts?|researchers?|writers?|people to))\b|徵|找隊友|招募|找夥伴|合夥人/i;
document.addEventListener('input', (event) => {
  if (event.target.id !== 'f-text' || U.nudgeOff) return;
  const box = $('#brew-nudge');
  if (box) box.hidden = !RECRUITING.test(event.target.value);
});

// Competitions and hackathons ask which one it is
document.addEventListener('change', (event) => {
  if (event.target.id === 'f-role') {
    const form = event.target.closest('form');
    const b = SEED_POSTS.find((x) => x.id === form.dataset.id);
    const role = b && rolesOf(b).find((r) => r.name === event.target.value);
    const hint = $('.role-hint', form);
    if (hint) hint.textContent = (role && role.desc) || '';
    return;
  }
  if (event.target.id !== 'f-kind') return;
  U.draft.kind = event.target.value;
  const box = $('.event-fields');
  if (box) box.hidden = !hasEvent(U.draft.kind);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  forms[form.dataset.form](form, formData(form));
});

window.addEventListener('hashchange', () => {
  if (U.modal) { U.modal = null; renderModal(); }
  U.target = null;
  U.dm = null;
  U.compose = null;
  U.booking = null;
  U.confirmReset = false;
  // Arriving from Explore's "Move to Brew": open the Brew form with the text
  if (U.pendingBrew != null) { U.compose = 'post'; U.draft = { kind: 'side', roles: [] }; }
  render();
});

// Tick once a second. Only the numbers change, the page is not redrawn.
setInterval(() => {
  if (D.phase === 'live') {
    const left = D.ends - Date.now();
    const el = document.getElementById('drop-timer');
    if (el) el.textContent = clock(left);
    if (left <= 0) dropEnd();
  }
  const count = document.getElementById('drop-count');
  if (count) count.textContent = countdownText(new Date());
}, 1000);
