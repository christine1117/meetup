/* HTML: your team page with its group chat. */

import { esc } from '../../shared/core.js?v=20261030f';
import { cupFor } from '../../shared/cup.js?v=20261030f';
import { field, select } from '../../shared/forms.js?v=20261030f';
import { S, U } from '../state.js?v=20261030f';
import { avatar, roleChips } from '../ui.js?v=20261030f';
import { compOf } from '../competitions.js?v=20261030f';
import { P } from '../sample-people.js?v=20261030f';
import { SIZE_CHOICES, isFull, myRoles, needsOf, personOf, spots, teamMax } from '../rules.js?v=20261030f';
import { roleChecks } from './cards.js?v=20261030f';
import { bubbles } from './chats.js?v=20261030f';

export function viewTeam(t) {
  const link = `${location.origin}${location.pathname}#/join/${t.code}`;
  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="Back"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div><h1>${esc(t.name)}</h1><p class="sub">${esc(compOf(t.comp).name)}</p></div>
      <div class="chat__tools"><button class="btn btn--ghost btn--sm" data-act="call" data-id="${t.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>Team call</button></div>
    </header>
    <details class="panel team-info" ${U.teamOpen === t.id ? 'open' : ''} data-team="${t.id}">
      <summary><span>${spots(t)}${needsOf(t).length ? ` · still need ${esc(needsOf(t).join(', '))}` : ''}</span><span class="sec__edit">Details</span></summary>
      <ul class="mates">${t.members.map((m) => {
        const p = personOf(m);
        const roles = m === 'me' ? myRoles(t.comp) : p.canDo;
        return `<li>${m === 'me' ? avatar(p) : `<button class="avatar avatar--cup avatar-btn" data-act="open" data-kind="person" data-ref="${m}" data-comp="${t.comp}" type="button" aria-label="${esc(p.real.name)}">${cupFor(p)}</button>`}<div><strong>${esc(m === 'me' ? `You (${S.me.name || S.me.alias})` : p.real.name)}</strong><p class="chips chips--sm">${roleChips(roles)}</p><p class="meta">${esc(m === 'me' ? [S.me.title, S.me.school, S.me.company].filter(Boolean).join(' · ') : p.real.school)}${m === 'me' ? '' : ` · ${esc(p.real.contact)}`}</p></div></li>`;
      }).join('')}</ul>
      <form class="stack pitch-form" data-form="teamedit" data-id="${t.id}" novalidate>
        ${field('pitch', 'What we’re building', t.pitch || '', { area: true, ph: 'One or two sentences. People looking for a team see this.' })}
        ${select('max', 'Team size limit', SIZE_CHOICES.filter((n) => n >= t.members.length).map((n) => [String(n), `${n} people`]), String(teamMax(t)))}
        ${isFull(t) ? '' : `<div class="field"><p class="field__label">Still need <span class="hint-inline">Optional</span></p>${roleChecks('needs', needsOf(t))}</div>`}
        <button class="btn btn--ghost btn--sm" type="submit">Save</button>
      </form>
      ${isFull(t) ? '<p class="meta">The team is full. No one else can join.</p>' : `<div class="invite">
        <p class="field__label">Invite friends</p>
        <p class="meta">Friends join straight away with this link. No chat needed.</p>
        <div class="invite__row"><input readonly value="${esc(link)}" aria-label="Invite link"><button class="btn btn--ghost btn--sm" data-act="copy" data-link="${esc(link)}" type="button">Copy</button></div>
        <button class="btn btn--ghost btn--sm" data-act="dev-friend" data-id="${t.id}" type="button">Dev: a friend joins by link</button>
      </div>`}
    </details>
    <ul class="log" id="log">${bubbles(t.msgs, U.typing[t.id], (id) => P[id].real.name)}</ul>
    <form class="composer" data-form="teammsg" data-id="${t.id}">
      <label class="sr" for="c-msg">Message</label>
      <input id="c-msg" name="msg" autocomplete="off" placeholder="Message the team">
      <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
    </form>
  </section>`;
}
