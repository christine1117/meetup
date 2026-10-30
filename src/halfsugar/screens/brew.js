/* ---------- Screen: Build ---------- */

import { esc } from '../../shared/core.js?v=20261030e';
import { L, LANG } from '../../shared/i18n.js?v=20261030e';
import { cupFor } from '../../shared/cup.js?v=20261030e';
import { field, select } from '../../shared/forms.js?v=20261030e';
import { BREW_KINDS, MAX_ROLES, P, ROLE_SUGGESTIONS, SEED_POSTS, hasEvent, kindName, openRoles, rolesOf } from '../people.js?v=20261030e';
import { BREW_TOP_PICKS, dayKey, normTag, topPicks } from '../matching.js?v=20261030e';
import { S, U } from '../state.js?v=20261030e';
import { byline } from '../ui.js?v=20261030e';
import { threadFor } from '../conversations.js?v=20261030e';
import { responsesBlock } from './explore.js?v=20261030e';


export const dateText = (d) => new Date(`${d}T00:00`).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' });

// Kind of project, and for competitions which one and when it closes
export const brewHead = (b) => `
      <p class="brew-kind">
        <span class="kind-chip">${hasEvent(b.kind) ? '<i class="ph ph-trophy" aria-hidden="true"></i>' : ''}${esc(kindName(b.kind))}</span>
        ${hasEvent(b.kind) && b.event ? `<span class="brew-kind__event">${esc(b.event)}</span>` : ''}
        ${b.deadline ? `<span class="meta">${L`Deadline ${dateText(b.deadline)}`}</span>` : ''}
      </p>`;

// The roles a Brew needs. Filled ones are ticked off; the author can tick and untick.
export function rolesList(b, mine) {
  const roles = rolesOf(b);
  const filled = roles.filter((r) => r.filled).length;
  return `
      <ul class="roles">${roles.map((r, i) => `
        <li class="role ${r.filled ? 'is-filled' : ''}">
          <i class="ph ${r.filled ? 'ph-check-circle' : 'ph-circle'}" aria-hidden="true"></i>
          ${r.desc
            ? `<details class="role__more"><summary class="role__name">${esc(r.name)}</summary><p>${esc(r.desc)}</p></details>`
            : `<span class="role__name">${esc(r.name)}</span>`}
          ${mine
            ? `<button class="btn btn--ghost btn--sm" data-act="role-toggle" data-id="${b.id}" data-i="${i}" type="button">${r.filled ? L`Reopen` : L`Mark filled`}</button>`
            : r.filled ? `<span class="role__tag">${L`Filled`}</span>` : ''}
        </li>`).join('')}
      </ul>
      <p class="fill">${roles.length && filled === roles.length
        ? `<strong class="done"><i class="ph ph-check" aria-hidden="true"></i>${L`Team complete`}</strong>`
        : `<span class="dots" aria-hidden="true">${[...roles].sort((x, y) => y.filled - x.filled).map((r) => `<i class="${r.filled ? 'on' : ''}"></i>`).join('')}</span><span class="meta">${L`${filled}/${roles.length} filled`}</span>`}</p>`;
}

export const brewExtras = (b, mine) => (b.offer || b.duration ? `
      <details class="more">
      <summary>${L`Details`}</summary>
      <dl class="brief">
        ${b.offer ? `<div><dt>${mine ? L`I can offer` : L`Offers`}</dt><dd>${esc(b.offer)}</dd></div>` : ''}
        ${b.duration ? `<div><dt>${L`Time`}</dt><dd>${esc(b.duration)}</dd></div>` : ''}
      </dl>
      </details>` : '');

export function brewCard(b) {
  const p = P[b.by];
  const existing = threadFor('build', b.id);
  const open = openRoles(b);
  return `
    <article class="card brew ${open.length ? '' : 'is-complete'}">
      ${brewHead(b)}
      <h3 class="post-title">${esc(b.title)}</h3>
      ${rolesList(b, false)}
      ${brewExtras(b, false)}
      ${byline(p)}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Applied. Open chat`}</a>`
        : !open.length ? ''
        : U.target === b.id
          ? `<form class="stack reply" data-form="apply" data-id="${b.id}" novalidate>
              ${select('role', L`Apply for`, open.map((r) => [r.name, r.name]), open[0].name)}
              <p class="hint role-hint">${esc(open[0].desc || '')}</p>
              ${field('reply', L`Why you are a fit`, '', { area: true, rows: 3, req: true, ph: L`Say what you would bring. They cannot see your titles` })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">${L`Send anonymously`}</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">${L`Cancel`}</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${b.id}" type="button">${L`Apply anonymously`}</button>`}
    </article>`;
}

// Roles for a new Brew: type one or tap a suggestion, then describe it if you like
export function roleEditor() {
  const roles = U.draft.roles;
  const left = ROLE_SUGGESTIONS.filter((x) => !roles.some((r) => normTag(r.name) === normTag(x)));
  return `
    <div class="field tags" role="group" aria-labelledby="roles-label">
      <p class="field__label" id="roles-label">${L`Roles you need`}</p>
      ${roles.length ? `<ul class="role-drafts">${roles.map((r, i) => `
        <li class="role-draft">
          <div class="role-draft__head">
            <strong>${esc(r.name)}</strong>
            <button class="icon-btn" type="button" data-act="role-remove" data-i="${i}" aria-label="${esc(L`Remove ${r.name}`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
          </div>
          <textarea id="rd-${i}" data-role-desc="${i}" rows="2" aria-label="${esc(L`What the ${r.name} will do`)}" placeholder="${esc(L`What will they do? (optional)`)}">${esc(r.desc)}</textarea>
        </li>`).join('')}</ul>` : ''}
      ${roles.length < MAX_ROLES ? `
      <div class="tags__add">
        <input id="c-role" data-role-input autocomplete="off" aria-label="${esc(L`Roles you need`)}" placeholder="${esc(L`Type a role and press Enter`)}">
        <button class="btn btn--ghost btn--sm" data-act="role-add" type="button">${L`Add`}</button>
      </div>
      <div class="tags__suggest">${left.map((x) => `<button class="cat cat--sm" data-act="role-add" data-value="${esc(x)}" type="button">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    </div>`;
}

// Keep what was typed in the description boxes before the form is drawn again
export function syncRoleDescs() {
  document.querySelectorAll('[data-role-desc]').forEach((box) => {
    const role = U.draft.roles[Number(box.dataset.roleDesc)];
    if (role) role.desc = box.value;
  });
}

export function viewBuild() {
  // Text carried over from an Explore post that was really looking for people
  const prefill = U.pendingBrew || '';
  U.pendingBrew = null;
  const open = SEED_POSTS.filter((b) => openRoles(b).length);
  const forYou = topPicks(open.map((b) => P[b.by]), BREW_TOP_PICKS, dayKey() + 'brew').map((p) => SEED_POSTS.find((b) => b.by === p.id));
  const rest = SEED_POSTS.filter((b) => !forYou.includes(b));
  const d = U.draft;

  return `
  <header class="head">
    <div><h1 lang="en">${L`Brew`}</h1><p class="sub" lang="en">${L`I need someone for something.`}</p></div>
    <button class="btn btn--primary" data-act="compose" data-what="post" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`Start a brew`}</button>
  </header>

  ${U.compose === 'post' ? `
  <form class="panel stack" data-form="post" novalidate>
    ${field('title', L`What are you building?`, prefill, { area: true, req: true, ph: L`e.g. A shared-kitchen platform for home cooks` })}
    <div class="row2">
      ${select('kind', L`What kind of project`, BREW_KINDS.map(([v, l]) => [v, L(l)]), d.kind)}
      ${field('duration', L`Time`, '', { ph: L`e.g. One call, a four-week project` })}
    </div>
    <div class="row2 event-fields" ${hasEvent(d.kind) ? '' : 'hidden'}>
      ${field('event', L`Which competition`, '', { ph: L`e.g. Taipei Climate Hackathon` })}
      ${field('deadline', L`Deadline`, '', { type: 'date' })}
    </div>
    ${roleEditor()}
    ${field('offer', L`I can offer (optional)`, '')}
    <p class="error" id="post-error" hidden>${L`Add at least one role.`}</p>
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  ${S.myPosts.length ? `
  <section class="mine">
    <h2>${L`Your brews`}</h2>
    ${S.myPosts.map((b) => `
    <article class="card card--mine brew">
      ${b.kind ? brewHead(b) : ''}
      <h3 class="post-title">${esc(b.title)}</h3>
      ${rolesList(b, true)}
      ${brewExtras(b, true)}
      ${b.sentTo ? `
      <div class="sent">
        <p class="meta"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>${L`Sent to ${b.sentTo.length} people who fit`}</p>
        <ul class="sent__list">${b.sentTo.map((pid) => `<li><span class="avatar avatar--cup" aria-hidden="true">${cupFor(P[pid])}</span>${esc(P[pid].alias)}</li>`).join('')}</ul>
      </div>` : ''}
      ${openRoles(b).length ? responsesBlock(b, 'post') : ''}
    </article>`).join('')}
  </section>` : ''}

  ${forYou.length ? `
  <section class="mine">
    <h2>${L`Top picks`}</h2>
    ${forYou.map(brewCard).join('')}
  </section>` : ''}

  <section class="mine">
    <h2>${forYou.length ? L`More brews` : L`All brews`}</h2>
    ${rest.map(brewCard).join('')}
  </section>`;
}
