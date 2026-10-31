/* HTML: the pop-up for a person or a team. */
import { L } from '../../shared/i18n.js?v=20261101c';

import { $, esc } from '../../shared/core.js?v=20261101c';
import { flavorChip } from '../../shared/flavors.js?v=20261101c';
import { cupFor } from '../../shared/cup.js?v=20261101c';
import { S, U } from '../state.js?v=20261101c';
import { avatar, roleChips } from '../ui.js?v=20261101c';
import { cardTopics, goalName, hoursName } from '../options.js?v=20261101c';
import { compOf } from '../competitions.js?v=20261101c';
import { P } from '../sample-people.js?v=20261101c';
import { freshRoles } from '../matching.js?v=20261101c';
import { chatWith, isFull, knows, myRoles, myTeam, needsOf, personOf, roleCounts, sideOf, spots, teamsIn } from '../rules.js?v=20261101c';

export const modalEl = document.createElement('div');
modalEl.id = 'modal';
document.body.appendChild(modalEl);

// The bottom of the pop-up: say hi right there, or go to the chat you already have
export function modalAction(cid, kind, ref, mineAlready) {
  if (mineAlready) return '';
  const c = chatWith(cid, kind, ref);
  if (c && c.status === 'closed') return `<p class="meta">${L`This chat ended.`}</p>`;
  if (c) return location.hash === `#/chat/${c.id}` ? '' : `<a class="btn btn--dark btn--sm" href="#/chat/${c.id}">${L`Open chat`}</a>`;
  if (!S.cards[cid]) return `<a class="btn btn--dark btn--sm" href="#/comp/${cid}">Join ${esc(compOf(cid).name)} to say hi</a>`;
  if (kind === 'team' && myTeam(cid)) return `<p class="meta">${L`You are already in a team for this competition.`}</p>`;
  const team = myTeam(cid);
  const full = kind === 'team' ? isFull(teamsIn(cid).find((t) => t.id === ref)) : team && isFull(team);
  if (full) return `<p class="meta">${kind === 'team' ? L`This team is full.` : L`Your team is full.`}</p>`;
  const note = kind === 'team' ? L`Everyone on the team will see this. Names stay hidden until you team up.`
    : team && team.members.length > 1 ? L`Your whole team will be in this chat. Names stay hidden until you team up.`
      : L`Say what you can bring. Names stay hidden until you team up.`;
  return `
    <form class="stack" data-form="hi" data-kind="${kind}" data-ref="${ref}" data-comp="${cid}" novalidate>
      <label class="sr" for="c-hi">${L`Your message`}</label>
      <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(note)}"></textarea>
      <button class="btn btn--dark btn--sm" type="submit">${kind === 'person' && team ? L`Invite` : L`Say hi`}</button>
    </form>`;
}

export function personModal(pid, cid) {
  const p = P[pid];
  const known = knows(pid);
  const card = S.cards[cid];
  const team = myTeam(cid);
  const fresh = card ? freshRoles(p.canDo, roleCounts(sideOf(cid), cid), team ? needsOf(team) : []) : [];
  return `
    <div class="modal__card" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="Close"><i class="ph ph-x" aria-hidden="true"></i></button>
      <div class="pf__top">
        <div class="pf__cup">${cupFor(p, 'cup--profile')}</div>
        <div class="pf__who">
          <h2 id="modal-title">${esc(known ? p.real.name : p.alias)}</h2>
          <p>${flavorChip(p)}</p>
          <p class="meta">${esc(p.city)} · ${esc(goalName(p.goal))}</p>
          <p class="meta">${esc(hoursName(p.hours))}</p>
        </div>
      </div>
      <dl class="brief">
        <div><dt>${L`Role`}</dt><dd class="chips">${roleChips(p.canDo, fresh)}</dd></div>
        ${p.topics.length ? `<div><dt>${L`Cares about`}</dt><dd class="chips">${roleChips(p.topics, cardTopics(card))}</dd></div>` : ''}
        <div><dt>${L`Built`}</dt><dd>${esc(p.work)}</dd></div>
      </dl>
      ${known ? `
      <dl class="brief brief--locked">
        <div><dt>${L`Name`}</dt><dd>${esc(p.real.name)}</dd></div>
        <div><dt>${L`School`}</dt><dd>${esc(p.real.school)}</dd></div>
        <div><dt>${L`Contact`}</dt><dd>${esc(p.real.contact)}</dd></div>
      </dl>` : `<p class="pf__sealed"><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Name and school stay hidden until you team up.`}</p>`}
      <div class="pf__actions">${modalAction(cid, 'person', pid, known)}</div>
    </div>`;
}

export function teamModal(tid, cid) {
  const t = teamsIn(cid).find((x) => x.id === tid);
  const mine = t.members.includes('me');
  const card = S.cards[cid];
  return `
    <div class="modal__card" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="Close"><i class="ph ph-x" aria-hidden="true"></i></button>
      <div class="pf__top">
        <span class="team-cups team-cups--big" aria-hidden="true">${t.members.map((m) => cupFor(personOf(m))).join('')}</span>
        <div class="pf__who">
          <h2 id="modal-title">${esc(t.name)}</h2>
          <p class="meta">${esc(compOf(cid).name)} · ${spots(t)}</p>
        </div>
      </div>
      ${t.pitch ? `<div class="pf__tags"><p class="field__label">${L`What we’re building`}</p><p class="pitch pitch--big">${esc(t.pitch)}</p></div>` : ''}
      ${needsOf(t).length ? `<div class="pf__tags"><p class="field__label">${L`Still need`}</p><p class="chips">${roleChips(needsOf(t), card ? card.canDo : [])}</p></div>` : ''}
      <div class="pf__tags">
        <p class="field__label">${L`Who’s in it`}</p>
        <ul class="mates">${t.members.map((m) => {
          const p = personOf(m);
          const name = m === 'me' ? L`You` : mine ? p.real.name : p.alias;
          return `<li>${m === 'me' ? avatar(p) : `<button class="avatar avatar--cup avatar-btn" data-act="open" data-kind="person" data-ref="${m}" data-comp="${cid}" type="button" aria-label="${esc(name)}">${cupFor(p)}</button>`}<div><strong>${esc(name)}</strong><p class="chips chips--sm">${roleChips(m === 'me' ? myRoles(cid) : p.canDo)}</p></div></li>`;
        }).join('')}</ul>
      </div>
      ${mine ? '' : `<p class="pf__sealed"><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Names stay hidden until you team up.`}</p>`}
      <div class="pf__actions">${mine ? `<a class="btn btn--dark btn--sm" href="#/team/${t.id}">${L`Open team`}</a>` : modalAction(cid, 'team', tid, false)}</div>
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
      ${m.kind === 'team' ? teamModal(m.ref, m.comp) : personModal(m.ref, m.comp)}
    </div>`;
  if (!wasOpen) $('.modal__card', modalEl).focus();
}

export function closeModal() {
  U.modal = null;
  renderModal();
}
