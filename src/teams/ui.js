/* Small page pieces: the root element, toasts, role chips, avatars. */

import { esc } from '../shared/core.js?v=20261030f';
import { cupFor } from '../shared/cup.js?v=20261030f';

export const app = document.getElementById('app');
export const toastEl = document.getElementById('toast');
export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const toast = (msg) => {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 3000);
};
export const roleChips = (list, match = []) => list.map((r) => `<span class="${match.includes(r) ? 'is-match' : ''}">${esc(r)}</span>`).join('');

export const avatar = (p) => `<span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>`;
