/* ---------- Screen: Me ----------
   Your drink and toppings on top, then your profile (shared with team mode). */

import { esc } from '../../shared/core.js?v=20261030e';
import { L } from '../../shared/i18n.js?v=20261030e';
import { drinkFor } from '../../shared/flavors.js?v=20261030e';
import { S, U } from '../state.js?v=20261030e';
import { MAX_SHOWN, TOPPING, drinkCup, myToppings, shownToppings, toppingIcon, toppingSlots } from '../toppings.js?v=20261030e';
import { profileForm } from './profile-form.js?v=20261030e';


export function viewMe() {
  return `
  <header class="head">
    <div><h1 lang="en">${L`Me`}</h1><p class="sub">${L`Your profile and your usual. Change them any time.`}</p></div>
  </header>
  <section class="receipt mydrink">
    <div class="mydrink__cup">${drinkCup(S.me, shownToppings(), 'cup--profile')}</div>
    <div class="mydrink__info">
      <p class="receipt__label">${L`Your usual`}</p>
      <p class="receipt__item">1 × ${esc(drinkFor(S.me))}</p>
      <div class="slots-row">${toppingSlots(shownToppings())}<span class="receipt__meta">${L`In your cup ${shownToppings().length}/${MAX_SHOWN}`}</span></div>
      <div class="pick-toppings">
        <p class="receipt__meta">${myToppings().length ? L`Your toppings. Tap to add or take out.` : L`No toppings yet.`}</p>
        <div class="strip-wrap">
        <button class="strip-arrow" data-act="strip" data-dir="-1" type="button" aria-label="${esc(L`Scroll left`)}"><i class="ph ph-caret-left" aria-hidden="true"></i></button>
        <div class="pick-strip">${myToppings().map((k) => {
          const on = shownToppings().includes(k);
          return `<button class="tchip tchip--${TOPPING[k].tier} tchip-btn ${on ? 'is-on' : ''}" data-act="topping-toggle" data-id="${k}" type="button" aria-pressed="${on}">${toppingIcon(k)}${esc(L(TOPPING[k].name))}${S.toppings[k] > 1 ? `<b>×${S.toppings[k]}</b>` : ''}<i class="ph ${on ? 'ph-check' : 'ph-plus'}" aria-hidden="true"></i></button>`;
        }).join('')}</div>
        <button class="strip-arrow" data-act="strip" data-dir="1" type="button" aria-label="${esc(L`Scroll right`)}"><i class="ph ph-caret-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="btnrow">
        ${(S.boxes || []).length ? `<button class="btn btn--primary btn--sm gift-cta" data-act="box-next" type="button"><i class="ph ph-gift" aria-hidden="true"></i>${L`Open gift box (${S.boxes.length})`}</button>` : ''}
        <button class="btn btn--ghost btn--sm" data-act="profile" data-pid="me" type="button">${L`See my profile`}</button>
      </div>
    </div>
  </section>
  ${profileForm(S.me, false)}
  <section class="panel note">
    <h2>${L`Demo mode`}</h2>
    <p><a class="inline-link" href="#/about">${L`What is Half Sugar?`}</a></p>
    <p>${L`Not connected to a server yet. Your data stays in this browser, and the other people are simulated.`}</p>
    <button class="btn btn--ghost btn--sm" data-act="dev-box" type="button">Dev: get a gift box</button>
    ${U.confirmReset
      ? `<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">${L`Yes, clear it`}</button><button class="btn btn--ghost" data-act="reset-no" type="button">${L`Cancel`}</button></div>`
      : `<button class="btn btn--ghost" data-act="reset" type="button">${L`Clear all data`}</button>`}
  </section>`;
}
