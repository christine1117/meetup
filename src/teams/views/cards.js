/* HTML: person and team cards in the recommendations, and the say-hi box. */

import { esc } from '../../shared/core.js?v=20261030d';
import { flavorChip } from '../../shared/flavors.js?v=20261030d';
import { cupFor } from '../../shared/cup.js?v=20261030d';
import { S, U } from '../state.js?v=20261030d';
import { roleChips } from '../ui.js?v=20261030d';
import { ROLES, goalName, hoursName } from '../options.js?v=20261030d';
import { P } from '../sample-people.js?v=20261030d';
import { freshRoles } from '../matching.js?v=20261030d';
import { chatWith, myTeam, needsOf, roleCounts, sideOf, spots, teamRoles } from '../rules.js?v=20261030d';

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
        <div><dt>Role</dt><dd class="chips">${roleChips(p.canDo, fresh)}</dd></div>
        ${p.topics.length ? `<div><dt>Cares about</dt><dd class="chips">${roleChips(p.topics, card.topics)}</dd></div>` : ''}
        <div><dt>Built</dt><dd>${esc(p.work)}</dd></div>
      </dl>
      ${hiBox(cid, 'person', p.id, existing, mine ? `Invite ${p.alias}` : 'Say hi')}
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
        <div><dt>Roles</dt><dd class="chips">${roleChips(teamRoles(t))}</dd></div>
        ${needsOf(t).length ? `<div><dt>Still need</dt><dd class="chips">${roleChips(needsOf(t), card.canDo)}</dd></div>` : ''}
        ${!needsOf(t).length && freshRoles(card.canDo, counts).length ? `<div><dt>You’d add</dt><dd class="chips">${roleChips(freshRoles(card.canDo, counts), card.canDo)}</dd></div>` : ''}
      </dl>
      ${hiBox(cid, 'team', t.id, existing, 'Say hi to the team')}
    </article>`;
}

export function hiBox(cid, kind, ref, existing, label) {
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chat/${existing.id}">Open chat</a>`;
  const key = `${kind}:${ref}`;
  const team = myTeam(cid);
  const note = kind === 'team' ? 'Everyone on the team will see this. Names stay hidden until you team up.'
    : team && team.members.length > 1 ? 'Your whole team will be in this chat. Names stay hidden until you team up.'
      : 'Say what you can bring. Names stay hidden until you team up.';
  if (U.hi === key) {
    return `
      <form class="stack reply" data-form="hi" data-kind="${kind}" data-ref="${ref}" data-comp="${cid}" novalidate>
        <label class="sr" for="c-hi">Your message</label>
        <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(note)}"></textarea>
        <div class="btnrow">
          <button class="btn btn--dark btn--sm" type="submit">Send</button>
          <button class="btn btn--ghost btn--sm" data-act="hi" data-key="" type="button">Cancel</button>
        </div>
      </form>`;
  }
  return `<button class="btn btn--dark btn--sm" data-act="hi" data-key="${key}" type="button">${esc(label)}</button>`;
}

export const roleChecks = (name, picked, list = ROLES) => `<div class="checks">${list.map((r) => `<label class="check"><input type="checkbox" name="${name}" value="${r}" ${picked.includes(r) ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>`;
