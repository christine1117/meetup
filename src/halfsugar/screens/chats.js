/* ---------- Screen: chats ---------- */

import { esc } from '../../shared/core.js?v=20261030e';
import { L, LANG, tr } from '../../shared/i18n.js?v=20261030e';
import { cup, cupFor } from '../../shared/cup.js?v=20261030e';
import { CLOSE_AFTER_DAYS, REVEAL_AT, closesText, isCold, sugarMeter, sugarOf } from '../../shared/sugar.js?v=20261030e';
import { field, select } from '../../shared/forms.js?v=20261030e';
import { P } from '../people.js?v=20261030e';
import { S, U } from '../state.js?v=20261030e';
import { originName } from '../ui.js?v=20261030e';
import { bubbles } from './mystery.js?v=20261030e';


export const shownName = (t) => (t.reveal.them ? P[t.pid].real.name : P[t.pid].alias);

export function viewChats() {
  const list = [...S.threads].sort((a, b) => isCold(a) - isCold(b) || b.at - a.at);
  return `
  <header class="head">
    <div><h1>${L`Chats`}</h1><p class="sub">${L`Every chat starts with a first sip.`}</p></div>
  </header>
  ${list.length ? `<ul class="threads">${list.map((t) => {
    const last = t.msgs[t.msgs.length - 1];
    const status = isCold(t) ? L`went cold` : L`${sugarOf(t)}% sugar`;
    return `
    <li class="${isCold(t) ? 'is-cold' : ''}">
      <a href="#/chats/${t.id}">
        <span class="avatar ${t.reveal.them ? 'avatar--on' : 'avatar--cup'}" aria-hidden="true">${t.reveal.them ? esc(P[t.pid].real.name.charAt(0)) : cupFor(P[t.pid])}</span>
        <span class="threads__body">
          <strong>${esc(shownName(t))}</strong>
          <small>${L`${originName(t.origin)}, ${status}`}${t.status === 'pending' ? L`, waiting for them to accept` : ''}</small>
          <span class="threads__last">${last ? esc(last.from === 'sys' ? tr(last.text, last.vars) : last.text) : ''}</span>
        </span>
        ${t.unread ? `<span class="badge" aria-label="${esc(L`${t.unread} unread`)}">${t.unread}</span>` : ''}
      </a>
    </li>`;
  }).join('')}</ul>` : `
  <div class="empty">
    ${cup('var(--milk)', { level: 0, cls: 'cup--lg' })}
    <p>${L`No cups yet.`}</p>
    <div class="btnrow btnrow--center">
      <a class="btn btn--dark btn--sm" href="#/explore">${L`Respond to a thought`}</a>
      <a class="btn btn--ghost btn--sm" href="#/drop">${L`Try a Mystery Cup`}</a>
    </div>
  </div>`}`;
}

export function viewThread(t) {
  const p = P[t.pid];
  const both = t.reveal.me && t.reveal.them;
  const sugar = sugarOf(t);
  const cold = isCold(t);
  const today = new Date().toISOString().slice(0, 10);

  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="${esc(L`Back to chats`)}"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1><button class="name-btn name-btn--big" data-act="profile" data-pid="${t.pid}" type="button">${esc(shownName(t))}<i class="ph ph-caret-right" aria-hidden="true"></i></button></h1>
        <p class="sub">${L`${originName(t.origin)}, ${esc(p.city)}`}</p>
        <div class="meta-row">${sugarMeter(sugar)}${t.status === 'open' && !cold ? `<span class="expiry">${closesText(t)}</span>` : ''}</div>
      </div>
      ${t.status === 'open' && !cold ? `
      <div class="chat__tools">
        <button class="btn btn--ghost btn--sm" data-act="call" data-id="${t.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>${L`Call`}</button>
        <button class="btn btn--ghost btn--sm" data-act="book-open" data-id="${t.id}" type="button"><i class="ph ph-person-simple-walk" aria-hidden="true"></i>${L`Boba run`}</button>
        ${both ? '' : t.reveal.me
          ? `<button class="btn btn--sm" type="button" disabled>${L`Waiting for them to pop`}</button>`
          : sugar >= REVEAL_AT
            ? `<button class="btn btn--primary btn--sm" data-act="reveal" data-id="${t.id}" type="button">${L`Pop the seal`}</button>`
            : `<button class="btn btn--sm" type="button" disabled>${L`Pop the seal at ${REVEAL_AT}%`}</button>`}
      </div>` : ''}
    </header>



    ${U.booking === t.id ? `
    <form class="panel stack" data-form="book" data-id="${t.id}" novalidate>
      <h2>${L`Go on a boba run`}</h2>
      <div class="row2">
        ${select('kind', L`Type`, [['Boba shop, 1-on-1', L`Boba shop, 1-on-1`], ['Café', L`Café`], ['Small dinner table', L`Small dinner table`]], 'Boba shop, 1-on-1')}
        ${field('area', L`Area`, S.me.city || '', { req: true, ph: L`e.g. Taipei, Da'an` })}
      </div>
      <div class="row2">
        ${field('date', L`Date`, '', { type: 'date', req: true, min: today })}
        ${select('time', L`Time`, ['12:00', '15:00', '19:00'], '15:00')}
      </div>
      <p class="hint">${L`Demo: no real booking is made.`}</p>
      <p class="error" id="book-error" hidden>${L`Please add an area and a date.`}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" type="submit">${L`Send invite`}</button>
        <button class="btn btn--ghost btn--sm" data-act="book-close" type="button">${L`Cancel`}</button>
      </div>
    </form>` : ''}

    ${t.booking ? `<div class="booking">
      <i class="ph ph-calendar-check" aria-hidden="true"></i>
      <span>${esc(bookingLabel(t.booking))}</span>
      ${t.booking.met ? `<strong class="done"><i class="ph ph-check" aria-hidden="true"></i>${L`You both showed up`}</strong>`
        : t.booking.me ? `<span class="meta">${L`Waiting for them to check in`}</span>`
        : `<button class="btn btn--dark btn--sm" data-act="checkin" data-id="${t.id}" type="button"><i class="ph ph-map-pin" aria-hidden="true"></i>${L`I'm here`}</button>`}
    </div>` : ''}

    <ul class="log" id="log">${bubbles(t.msgs, U.typing[t.id])}</ul>

    ${cold
      ? `<p class="cold"><i class="ph ph-snowflake" aria-hidden="true"></i>${L`This cup went cold. Nobody replied for ${CLOSE_AFTER_DAYS} days, so the chat closed.`}</p>`
      : t.status === 'open'
        ? `<div class="devrow"><button class="btn btn--ghost btn--sm" data-act="dev-time" data-id="${t.id}" type="button">Dev: +5 min</button><button class="btn btn--ghost btn--sm" data-act="dev-days" data-id="${t.id}" type="button">Dev: +${CLOSE_AFTER_DAYS} days</button></div>`
        : ''}

    ${cold ? '' : t.status === 'pending'
      ? `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`Waiting for them to accept your response`}</p>`
      : `<form class="composer" data-form="msg" data-id="${t.id}">
          <label class="sr" for="c-msg">${L`Message`}</label>
          <input id="c-msg" name="msg" autocomplete="off" placeholder="${esc(L`Say something`)}">
          <button class="btn btn--dark" type="submit" aria-label="${esc(L`Send`)}"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
        </form>`}
  </section>`;
}

// The booking line is built when shown, so it follows the current language
export function bookingLabel(b) {
  const day = new Date(`${b.date}T${b.time}`).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return L`${day}, ${b.time}. ${L(b.kind)}, ${b.area}`;
}
