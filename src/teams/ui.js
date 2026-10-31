/* Small page pieces: the root element, toasts, role chips, avatars. */
import { L } from '../shared/i18n.js?v=20261031u';

import { esc } from '../shared/core.js?v=20261031u';
import { cupFor } from '../shared/cup.js?v=20261031u';

export const app = document.getElementById('app');
export const toastEl = document.getElementById('toast');
export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const toast = (msg) => {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 3000);
};
// Roles and topics are stored in English and shown in the chosen language
export const roleChips = (list, match = []) => list.map((r) => `<span class="${match.includes(r) ? 'is-match' : ''}">${esc(L(r))}</span>`).join('');

export const avatar = (p) => `<span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>`;
