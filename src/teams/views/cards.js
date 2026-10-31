/* HTML: person and team cards in the recommendations, and the say-hi box. */
import { L } from '../../shared/i18n.js?v=20261031u';

import { esc } from '../../shared/core.js?v=20261031u';
import { flavorChip } from '../../shared/flavors.js?v=20261031u';
import { cupFor } from '../../shared/cup.js?v=20261031u';
import { S, U } from '../state.js?v=20261031u';
import { roleChips } from '../ui.js?v=20261031u';
import { ROLES, cardTopics, goalName, hoursName } from '../options.js?v=20261031u';
import { P } from '../sample-people.js?v=20261031u';
import { freshRoles } from '../matching.js?v=20261031u';
import { chatWith, myTeam, needsOf, roleCounts, sideOf, spots, teamRoles } from '../rules.js?v=20261031u';

export function personCard(p, cid) {
  const card = S.cards[cid];
  const mine = myTeam(cid);
  const fresh = freshRoles(p.canDo, roleCounts(sideOf(cid), cid), mine ? needsOf(mine) : []);
  const existing = chatWith(cid, 'person', p.id);
  return `
    <article class="card tcard">
      <div class="tcard__top">
        <button class="avatar avatar--cup avatar-btn" data-act="open" data-kind="person" data-ref="${p.id}" data-comp="${cid}" type="button" tabindex="-1" aria-hidden="true">${cupFor(p)}</button>
        <div><button class="name-btn" data-act="open" data-kind="person" data-ref="${p.id}" data-comp="${cid}" type="button"><strong>${esc(p.alias)}</strong></button> ${flavorChip(p)}<p class="meta">${esc(p.city)} · ${esc(goalName(p.goal))} · ${esc(hoursName(p.hours))}</p></div>
      </div>
      <dl class="brief">
        <div><dt>${L`Role`}</dt><dd class="chips">${roleChips(p.canDo, fresh)}</dd></div>
        ${p.topics.length ? `<div><dt>${L`Cares about`}</dt><dd class="chips">${roleChips(p.topics, cardTopics(card))}</dd></div>` : ''}
        <div><dt>${L`Built`}</dt><dd>${esc(p.work)}</dd></div>
      </dl>
      ${hiBox(cid, 'person', p.id, existing, mine ? L`Invite ${p.alias}` : L`Say hi`)}
    </article>`;
}

export function teamCard(t, cid) {
  const card = S.cards[cid];
  const existing = chatWith(cid, 'team', t.id);
  const counts = roleCounts(t.members, cid);
  return `
    <article class="card tcard tcard--team">
      <div class="tcard__top">
        <button class="team-cups avatar-btn" data-act="open" data-kind="team" data-ref="${t.id}" data-comp="${cid}" type="button" tabindex="-1" aria-hidden="true">${t.members.map((m) => cupFor(P[m])).join('')}</button>
        <div><button class="name-btn" data-act="open" data-kind="team" data-ref="${t.id}" data-comp="${cid}" type="button"><strong>${esc(t.name)}</strong></button> <span class="tag">${spots(t)}</span><p class="meta">${esc(goalName(P[t.members[0]].goal))} · ${esc(hoursName(P[t.members[0]].hours))}</p></div>
      </div>
      ${t.pitch ? `<p class="pitch">${esc(t.pitch)}</p>` : ''}
      <dl class="brief">
        <div><dt>${L`Roles`}</dt><dd class="chips">${roleChips(teamRoles(t))}</dd></div>
        ${needsOf(t).length ? `<div><dt>${L`Still need`}</dt><dd class="chips">${roleChips(needsOf(t), card.canDo)}</dd></div>` : ''}
        ${!needsOf(t).length && freshRoles(card.canDo, counts).length ? `<div><dt>${L`You’d add`}</dt><dd class="chips">${roleChips(freshRoles(card.canDo, counts), card.canDo)}</dd></div>` : ''}
      </dl>
      ${hiBox(cid, 'team', t.id, existing, L`Say hi to the team`)}
    </article>`;
}

export function hiBox(cid, kind, ref, existing, label) {
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chat/${existing.id}">${L`Open chat`}</a>`;
  const key = `${kind}:${ref}`;
  const team = myTeam(cid);
  const note = kind === 'team' ? L`Everyone on the team will see this. Names stay hidden until you team up.`
    : team && team.members.length > 1 ? L`Your whole team will be in this chat. Names stay hidden until you team up.`
      : L`Say what you can bring. Names stay hidden until you team up.`;
  if (U.hi === key) {
    return `
      <form class="stack reply" data-form="hi" data-kind="${kind}" data-ref="${ref}" data-comp="${cid}" novalidate>
        <label class="sr" for="c-hi">${L`Your message`}</label>
        <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(note)}"></textarea>
        <div class="btnrow">
          <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
          <button class="btn btn--ghost btn--sm" data-act="hi" data-key="" type="button">${L`Cancel`}</button>
        </div>
      </form>`;
  }
  return `<button class="btn btn--dark btn--sm" data-act="hi" data-key="${key}" type="button">${esc(label)}</button>`;
}

// Tick boxes for roles. withOther adds "Other" with a box to write your own.
export function roleChecks(name, picked, list = ROLES, withOther = false) {
  const custom = picked.filter((r) => !list.includes(r));
  const boxes = list.map((r) => `<label class="check"><input type="checkbox" name="${name}" value="${esc(r)}" ${picked.includes(r) ? 'checked' : ''}><span>${esc(L(r))}</span></label>`).join('');
  const other = withOther ? `
    <label class="check"><input type="checkbox" name="${name}" value="__other" ${custom.length ? 'checked' : ''}><span>${L`Other`}</span></label>
    <input class="other-input" name="${name}Other" value="${esc(custom.join(', '))}" maxlength="40" placeholder="${esc(L`Write your own`)}" aria-label="${esc(L`Other role`)}">` : '';
  return `<div class="checks">${boxes}${other}</div>`;
}
