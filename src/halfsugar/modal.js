/* ---------- Pop-up window: gift boxes and profiles ---------- */

import { $, esc } from '../shared/core.js?v=20261030f';
import { L, tr } from '../shared/i18n.js?v=20261030f';
import { drinkFor, flavorChip } from '../shared/flavors.js?v=20261030f';
import { contactOf } from '../shared/profile.js?v=20261030f';
import { P } from './people.js?v=20261030f';
import { STAGES, myCurious, myShare } from './matching.js?v=20261030f';
import { S, U } from './state.js?v=20261030f';
import { MAX_SHOWN, TIER_NAME, TOPPING, drinkCup, toppingIcon, toppingSlots, toppingsOf } from './toppings.js?v=20261030f';
import { render } from './shell.js?v=20261030f';


export const modalEl = document.createElement('div');
modalEl.id = 'modal';
document.body.appendChild(modalEl);
export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const giftSvg = (tier) => `
  <svg class="gift__art" viewBox="0 0 60 60" aria-hidden="true">
    <rect class="gift__body" x="9" y="27" width="42" height="27" rx="4"/>
    <rect class="gift__ribbon" x="27" y="27" width="6" height="27"/>
    <g class="gift__lid">
      <rect class="gift__top" x="6" y="18" width="48" height="11" rx="3"/>
      <rect class="gift__ribbon" x="27" y="18" width="6" height="11"/>
      <path class="gift__bow" d="M30 18c-4-8-13-8-11-2 1 3 7 3 11 2zm0 0c4-8 13-8 11-2-1 3-7 3-11 2z"/>
    </g>
  </svg>`;

export function boxModal(m) {
  const opened = m.phase === 'open';
  const got = opened && TOPPING[m.contents[m.picked]];
  const left = (S.boxes || []).length;
  return `
    <div class="modal__card modal__card--box" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="${esc(L`Close`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
      <p class="tier-tag">${L`Gift box`}</p>
      <h2 id="modal-title">${opened ? L`You got ${esc(L(got.name))}!` : L`Pick a box.`}</h2>
      <p class="sub">${esc(tr(m.box.reason, m.box.vars))}</p>
      <div class="gifts">
        ${m.contents.map((k, i) => `
        <button class="gift ${m.picked === i ? 'is-picked' : ''} ${m.picked !== null && m.picked !== i ? 'is-other' : ''} is-${m.phase}" data-act="box-pick" data-i="${i}" type="button" ${m.phase === 'pick' ? '' : 'disabled'} aria-label="${esc(L`Box ${i + 1}`)}">
          ${giftSvg()}
          ${opened ? `<span class="gift__prize">${toppingIcon(k)}</span><small class="gift__name">${esc(L(TOPPING[k].name))}</small>` : ''}
        </button>`).join('')}
      </div>
      ${opened ? `
      <p class="prize-line"><span class="tier-tag tier-tag--${got.tier}">${L(TIER_NAME[got.tier])}</span>${(S.toppings[got.id] || 0) > 1 ? `<span class="meta">${L`You now have ${S.toppings[got.id]}.`}</span>` : ''}</p>
      <div class="btnrow btnrow--center">
        ${left ? `<button class="btn btn--primary" data-act="box-next" type="button">${L`Open next box (${left})`}</button>` : `<button class="btn btn--primary" data-act="modal-close" type="button">${L`Add to my cup`}</button>`}
        <a class="btn btn--ghost" href="#/me">${L`See my cup`}</a>
      </div>` : `<p class="meta">${L`The other two open after you pick.`}</p>`}
    </div>`;
}

// What anyone can see about a person, plus their sealed details once you have both popped the seal
export function profileModal(pid) {
  const me = pid === 'me';
  const p = me ? { ...S.me, curious: myCurious(), share: myShare() } : P[pid];
  const ids = toppingsOf(pid);
  const t = me ? null : S.threads.find((x) => x.pid === pid);
  const revealed = t && t.reveal.me && t.reveal.them;
  const stage = (STAGES.find(([v]) => v === p.stage) || [])[1];
  const fun = p.fun || p.proof;
  const chips = (list) => list.map((x) => `<span>${esc(x)}</span>`).join('');
  return `
    <div class="modal__card modal__card--profile" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="${esc(L`Close`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
      <div class="pf__top">
        <div class="pf__cup">${drinkCup(p, ids, 'cup--profile')}</div>
        <div class="pf__who">
          <h2 id="modal-title">${esc(me ? S.me.alias : p.alias)}</h2>
          <p>${flavorChip(p)}</p>
          <p class="meta">${[stage && L(stage), p.city].filter(Boolean).map(esc).join(', ')}</p>
          <p class="pf__drink">${esc(drinkFor(p))}</p>
        </div>
      </div>
      <div class="slots-row">${toppingSlots(ids.slice(0, MAX_SHOWN))}</div>
      <dl class="brief">
        ${p.doing ? `<div><dt>${L`Working on`}</dt><dd>${esc(p.doing)}</dd></div>` : ''}
        ${fun ? `<div><dt>${L`Fun fact`}</dt><dd>${esc(fun)}</dd></div>` : ''}
      </dl>
      ${p.curious && p.curious.length ? `<div class="pf__tags"><p class="field__label">${L`Curious about`}</p><p class="chips">${chips(p.curious)}</p></div>` : ''}
      ${p.share && p.share.length ? `<div class="pf__tags"><p class="field__label">${L`Can share`}</p><p class="chips">${chips(p.share)}</p></div>` : ''}
      ${me ? '' : revealed ? `
      <dl class="brief brief--locked">
        <div><dt>${L`Name`}</dt><dd>${esc(p.real.name)}</dd></div>
        <div><dt>${L`School`}</dt><dd>${esc(p.real.school)}</dd></div>
        <div><dt>${L`Company`}</dt><dd>${esc(p.real.company)}</dd></div>
        <div><dt>${L`Job title`}</dt><dd>${esc(p.real.title)}</dd></div>
        ${contactOf(p.real) ? `<div><dt>${esc(L(contactOf(p.real)[0]))}</dt><dd>${esc(contactOf(p.real)[1])}</dd></div>` : ''}
      </dl>` : `<p class="pf__sealed"><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Name, school and company stay sealed until you both pop the seal.`}</p>`}
      <div class="pf__actions">
        ${me
          ? ''
          : t ? `<a class="btn btn--dark btn--sm" href="#/chats/${t.id}">${L`Open chat`}</a>`
          : `<form class="stack" data-form="hi" data-pid="${pid}" novalidate>
              <label class="sr" for="c-hi">${L`Say hi`}</label>
              <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(L`Say hi. Start with what caught your eye.`)}"></textarea>
              <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
            </form>`}
      </div>
    </div>`;
}

export function renderModal() {
  const m = U.modal;
  document.body.classList.toggle('modal-open', !!m);
  if (!m) { modalEl.innerHTML = ''; return; }
  const wasOpen = !!modalEl.firstElementChild;
  modalEl.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__backdrop" data-act="modal-close"></div>
      ${m.type === 'box' ? boxModal(m) : profileModal(m.pid)}
    </div>`;
  if (!wasOpen) $('.modal__card', modalEl).focus();
}

export function closeModal() {
  U.modal = null;
  renderModal();
  render();
}
