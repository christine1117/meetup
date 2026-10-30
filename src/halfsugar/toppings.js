/* ---------- Toppings ----------
   Rewards that land in your cup.
   Every milestone earns one gift box: reaching half sugar, a mutual Mystery Cup
   refill, or a boba run where you both check in. All boxes draw from the same
   toppings, with a small chance of a secret one.
   A gift box shows three closed boxes; you pick one. */

import { esc, later, pick, uid } from '../shared/core.js?v=20261030f';
import { L } from '../shared/i18n.js?v=20261030f';
import { drinkFor, flavor } from '../shared/flavors.js?v=20261030f';
import { EXPLODE, LAYER_ICON, PIECE, WIDE_VIEW, cupArt, shadow, toppingDefs } from '../shared/cup.js?v=20261030f';
import { P } from './people.js?v=20261030f';
import { S, U, save } from './state.js?v=20261030f';
import { toast } from './ui.js?v=20261030f';
import { renderModal } from './modal.js?v=20261030f';


export const TOPPINGS = [
  { id: 'coconut', name: 'Coconut jelly', tier: 'small' },
  { id: 'aloe', name: 'Aloe vera', tier: 'small' },
  { id: 'grass', name: 'Grass jelly', tier: 'small' },
  { id: 'redbean', name: 'Red bean', tier: 'small' },
  { id: 'pudding', name: 'Egg pudding', tier: 'small' },
  { id: 'crystal', name: 'Crystal boba', tier: 'small' },
  { id: 'foam', name: 'Cheese foam', tier: 'small' },
  { id: 'tiger', name: 'Brown sugar stripes', tier: 'small' },
  { id: 'taroball', name: 'Taro balls', tier: 'small' },
  { id: 'mochi', name: 'Mochi', tier: 'small' },
  { id: 'brulee', name: 'Crème brûlée', tier: 'small' },
  { id: 'golden', name: 'Golden pearl', tier: 'secret' },
  { id: 'galaxy', name: 'Galaxy jelly', tier: 'secret' },
  { id: 'sakura', name: 'Sakura jelly', tier: 'secret' },
];
export const TOPPING = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
export const SECRET_CHANCE = 0.1;
export const TIER_NAME = { small: 'Topping', secret: 'Secret topping' };
export const TIER_HOW = {
  small: 'Reach half sugar, refill a Mystery Cup together, or both show up to a boba run.',
  secret: 'Found by luck in any gift box.',
};

// Three different toppings for the three boxes. Every box draws from the same toppings.
export function rollBoxes() {
  const out = [];
  while (out.length < 3) {
    const tier = Math.random() < SECRET_CHANCE ? 'secret' : 'small';
    const pool = TOPPINGS.filter((t) => t.tier === tier && !out.includes(t.id));
    if (pool.length) out.push(pick(pool).id);
  }
  return out;
}

export const myToppings = () => Object.keys(S.toppings || {}).filter((k) => TOPPING[k] && S.toppings[k] > 0);
// Your cup shows up to 5 toppings, and you choose which. Until you choose, the first 5 you own.
export const MAX_SHOWN = 5;
export const shownToppings = () => {
  const own = myToppings();
  return Array.isArray(S.shown) ? S.shown.filter((k) => own.includes(k)) : own.slice(0, MAX_SHOWN);
};
export const toppingsOf = (pid) => (pid === 'me' ? shownToppings() : (P[pid].toppings || []));



// Your base drink with your toppings in it
export function drinkCup(p, ids = [], cls = '') {
  return `<svg class="cup drink ${EXPLODE.test(cls) ? 'cup-x' : ''} ${cls}" viewBox="${EXPLODE.test(cls) ? WIDE_VIEW : '-2 -6 28 34'}" role="img" aria-label="${esc(drinkFor(p))}${ids.length ? esc(L`, with ${ids.length} toppings`) : ''}">${cupArt(flavor(p.field)[1], { cls, ids, level: 0.82, color2: p.field2 ? flavor(p.field2)[1] : '' })}</svg>`;
}

// A topping on its own, for chips and gift boxes
export function toppingIcon(k) {
  const id = 'ti' + uid();
  const art = PIECE[k] ? PIECE[k](id, 0, 0, 1, 0) : LAYER_ICON[k](id);
  return `<svg class="ti" viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">${toppingDefs(id)}${shadow(0, 0.02, 1)}${art}</svg>`;
}

// Five fixed slots for what is in a cup: filled ones show the topping, empty ones a dashed circle
export const toppingSlots = (ids) => `<ul class="slots" aria-label="${esc(ids.length ? ids.map((k) => L(TOPPING[k].name)).join(', ') : L`No toppings yet`)}">${Array.from({ length: MAX_SHOWN }, (_, i) => {
  const k = ids[i];
  return k ? `<li class="slot slot--${TOPPING[k].tier}" title="${esc(L(TOPPING[k].name))}">${toppingIcon(k)}</li>` : '<li class="slot slot--empty" aria-hidden="true"></li>';
}).join('')}</ul>`;

export const toppingChip = (k, count = 1) => `<span class="tchip tchip--${TOPPING[k].tier}">${toppingIcon(k)}${esc(L(TOPPING[k].name))}${count > 1 ? `<b>×${count}</b>` : ''}</span>`;

// Gift boxes wait in a queue until you open them
export function earnBox(tier, reason, vars = []) {
  S.boxes = S.boxes || [];
  S.boxes.push({ id: uid(), tier, reason, vars });
  save();
  toast(L`You earned a gift box!`);
  later(700, () => { if (!U.modal) openNextBox(); });
}

export function openNextBox() {
  if (!(S.boxes || []).length) return;
  const box = S.boxes[0];
  U.modal = { type: 'box', box, contents: rollBoxes(), picked: null, phase: 'pick' };
  renderModal();
}
