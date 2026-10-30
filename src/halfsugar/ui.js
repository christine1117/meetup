export const app = document.getElementById('app');
export const toastEl = document.getElementById('toast');

export const ORIGIN = { explore: 'Explore', build: 'Brew', drop: 'Mystery Cup' };
export const originName = (o) => L(ORIGIN[o]);

/* ---------- Small pieces ---------- */

import { esc } from '../shared/core.js?v=20261030f';
import { L } from '../shared/i18n.js?v=20261030f';
import { flavorChip } from '../shared/flavors.js?v=20261030f';
import { cupFor } from '../shared/cup.js?v=20261030f';








// Name and cup open that person's profile
export const whoAttrs = (p) => `data-act="profile" data-pid="${p.id || 'me'}" type="button"`;
export const byline = (p, full = false) => `
  <p class="byline">
    <button class="avatar avatar--cup avatar-btn" ${whoAttrs(p)} tabindex="-1" aria-hidden="true">${cupFor(p)}</button>
    <span><button class="name-btn" ${whoAttrs(p)}>${esc(p.alias)}</button> ${flavorChip(p)}${full ? `<br><small>${esc(p.doing)}</small>` : ''}</span>
  </p>`;

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 3200);
}
