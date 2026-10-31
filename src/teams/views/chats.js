/* HTML: the chat list and one chat. */
import { L } from '../../shared/i18n.js?v=20261101g';
import { tr } from '../../shared/i18n.js?v=20261101g';

import { esc } from '../../shared/core.js?v=20261101g';
import { cupFor } from '../../shared/cup.js?v=20261101g';
import { REVEAL_AT, closesText, isCold, sugarMeter, sugarOf } from '../../shared/sugar.js?v=20261101g';
import { S, U } from '../state.js?v=20261101g';
import { COMP, compOf, textOf } from '../competitions.js?v=20261101g';
import { answerButtons } from './cards.js?v=20261101g';
import { P } from '../sample-people.js?v=20261101g';
import { PASS_TEXT, isGroup, needsOf, nick, personOf, spots, teamRoles, teamsIn, voters } from '../rules.js?v=20261101g';
import { chatName, tooBig } from '../chats.js?v=20261101g';

// Invitations (spec §16 Screen 5): waiting for your answer, sent, accepted
function invitations() {
  const list = S.requests || [];
  const inbox = list.filter((r) => !r.mine && r.status === 'pending');
  const sent = list.filter((r) => r.mine && r.status === 'pending');
  const open = list.filter((r) => r.status === 'chatting');
  if (!inbox.length && !sent.length && !open.length) return '';
  const row = (r, actions) => `
    <li class="req">
      <span class="avatar avatar--cup" aria-hidden="true">${cupFor({ field: r.field })}</span>
      <div class="req__body"><strong>${esc(r.alias)}</strong><small>${esc(textOf(COMP[r.comp] || r.competition || compOf(r.comp), 'name'))}</small>${r.note ? `<p class="req__note">${esc(r.note)}</p>` : ''}</div>
      <div class="req__act">${actions}</div>
    </li>`;
  const group = (title, items, actions) => (items.length ? `<h3 class="req-title">${title}</h3><ul class="reqs">${items.map((r) => row(r, actions(r))).join('')}</ul>` : '');
  return `
  <h2 class="sec-title">${L`Invitations`}</h2>
  ${group(L`Waiting for your answer`, inbox, answerButtons)}
  ${group(L`Sent`, sent, (r) => `<span class="meta">${L`Waiting`}</span><button class="link-btn" data-act="invite-withdraw" data-id="${r.id}" type="button">${L`Withdraw`}</button>`)}
  ${group(L`Accepted`, open, () => `<span class="meta">${L`The chat room opens in the next step.`}</span>`)}`;
}

export function viewChats() {
  const done = (c) => isCold(c) || c.status === 'closed';
  const chats = [...S.chats].sort((a, b) => done(a) - done(b) || b.at - a.at);
  return `
  <header class="head"><div><h1>${L`Teams & chats`}</h1><p class="sub">${L`Chat to half sugar, then team up.`}</p></div></header>
  ${U.user ? invitations() : ''}
  ${S.teams.length ? `
  <h2 class="sec-title">${L`Your teams`}</h2>
  ${S.teams.map((t) => `
  <a class="card my-team" href="#/team/${t.id}">
    <span class="team-cups" aria-hidden="true">${t.members.map((m) => cupFor(personOf(m))).join('')}</span>
    <div><strong>${esc(t.name)}</strong><p class="meta">${esc(compOf(t.comp).name)} · ${spots(t)}</p></div>
    <i class="ph ph-caret-right" aria-hidden="true"></i>
  </a>`).join('')}` : ''}
  <h2 class="sec-title">${L`Chats`}</h2>
  ${chats.length ? `<ul class="threads">${chats.map((c) => {
    const last = c.msgs[c.msgs.length - 1];
    return `<li class="${done(c) ? 'is-cold' : ''}"><a href="#/chat/${c.id}">
      <span class="avatar avatar--cup" aria-hidden="true">${c.kind === 'team' ? cupFor(P[teamsIn(c.comp).find((t) => t.id === c.ref).members[0]]) : cupFor(P[c.ref])}</span>
      <span class="threads__body"><strong>${esc(chatName(c))}</strong><small>${esc(compOf(c.comp).name)} · ${c.teamed ? L`Teamed up` : c.status === 'closed' ? L`Ended` : isCold(c) ? L`Gone cold` : `${sugarOf(c)}% sugar`}</small><span class="threads__last">${esc(last ? last.text : '')}</span></span>
    </a></li>`;
  }).join('')}</ul>` : `<p class="empty">${L`No chats yet. Pick a competition and say hi to someone.`}</p>`}`;
}

// names: a function that turns a sender id into the name shown above their message (group chats only)
export function bubbles(msgs, typing, names) {
  return msgs.map((m) => {
    // System notes are saved in English (with {0}, {1} for names) and shown in the chosen language
    if (m.from === 'sys') return `<li class="msg msg--sys">${esc(tr(m.text, m.vars || []))}</li>`;
    const name = names && m.from !== 'me' && m.who ? `<small class="msg__who">${esc(names(m.who))}</small>` : '';
    return `<li class="msg msg--${m.from}">${name}${esc(m.text)}</li>`;
  }).join('') + (typing ? '<li class="msg msg--them msg--typing" aria-label="Typing"><span></span><span></span><span></span></li>' : '');
}

export function viewChat(c) {
  const open = c.status === 'open' && !c.teamed;
  const cold = isCold(c);
  const live = open && !cold;
  const sugar = sugarOf(c);
  const team = c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref) : null;
  const p = c.kind === 'person' ? P[c.ref] : null;
  const group = isGroup(c);
  const info = p
    ? `Role: ${p.canDo.join(', ')}${p.topics.length ? ` · Cares about ${p.topics.join(', ')}` : ''}`
    : `Roles: ${teamRoles(team).join(', ')}${needsOf(team).length ? ` · Still need ${needsOf(team).join(', ')}` : ''} · ${spots(team)}`;
  // In a group chat, say who wrote each message (nicknames until you team up)
  const names = group ? (id) => (c.kind === 'person' && id !== c.ref ? `${nick(id, c)} · your team` : nick(id, c)) : null;
  let action = '';
  if (c.teamed) action = `<a class="btn btn--primary btn--sm" href="#/team/${c.team}">${L`Open team`}</a>`;
  else if (live && tooBig(c)) action = `<button class="btn btn--sm" type="button" disabled>${L`Team is full`}</button>`;
  else if (live && c.votes.me) action = `<button class="btn btn--sm" type="button" disabled>${L`You said yes`}</button>`;
  else if (live && sugar >= REVEAL_AT) action = `<button class="btn btn--primary btn--sm" data-act="teamup" data-id="${c.id}" type="button"><i class="ph ph-handshake" aria-hidden="true"></i>${L`Team up`}</button>`;
  else if (live) action = `<button class="btn btn--sm" type="button" disabled>${L`Team up at ${REVEAL_AT}%`}</button>`;
  const showVotes = live && (sugar >= REVEAL_AT || Object.keys(c.votes).length);
  let bottom;
  if (c.status === 'closed') bottom = `<p class="cold"><i class="ph ph-door-open" aria-hidden="true"></i>${L`This chat ended. No hard feelings: names were never shown.`}</p>`;
  else if (cold) bottom = `<p class="cold"><i class="ph ph-snowflake" aria-hidden="true"></i>${L`This chat went cold: no reply for 3 days.`}</p>`;
  else if (U.leave === c.id) bottom = `
    <div class="panel leave">
      <p class="field__label">${L`End this chat?`}</p>
      <p class="meta">${L`We send this for you. No reason needed.`}</p>
      <blockquote class="leave__quote">${esc(L(PASS_TEXT))}</blockquote>
      <p class="meta">${L`Names stay hidden, and you won’t be shown to each other again in this competition.`}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="leave-send" data-id="${c.id}" type="button">${L`Send and end chat`}</button>
        <button class="btn btn--ghost btn--sm" data-act="leave" data-id="" type="button">${L`Keep chatting`}</button>
      </div>
    </div>`;
  else bottom = `
    <div class="devrow"><button class="btn btn--ghost btn--sm" data-act="dev-time" data-id="${c.id}" type="button">Dev: +5 min</button><button class="btn btn--ghost btn--sm" data-act="dev-days" data-id="${c.id}" type="button">Dev: +3 days</button><button class="btn btn--ghost btn--sm" data-act="dev-pass" data-id="${c.id}" type="button">Dev: they pass</button></div>
    <form class="composer" data-form="msg" data-id="${c.id}">
      <label class="sr" for="c-msg">${L`Message`}</label>
      <input id="c-msg" name="msg" autocomplete="off" placeholder="${group ? L`Message everyone` : L`Say something`}">
      <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
    </form>`;
  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="Back"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1><button class="name-btn name-btn--big" data-act="open" data-kind="${c.kind}" data-ref="${c.ref}" data-comp="${c.comp}" type="button">${esc(chatName(c))}<i class="ph ph-caret-right" aria-hidden="true"></i></button></h1>
        <p class="sub">${esc(compOf(c.comp).name)}${group && p ? ' · with your team' : ''}</p>
        <div class="meta-row">${sugarMeter(sugar)}${live ? `<span class="expiry">${closesText(c)}</span>` : ''}</div>
      </div>
      <div class="chat__tools">
        ${live ? `<button class="btn btn--ghost btn--sm" data-act="call" data-id="${c.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>${L`Video`}</button>` : ''}
        ${action}
        ${live && U.leave !== c.id ? `<button class="btn btn--ghost btn--sm" data-act="leave" data-id="${c.id}" type="button">${L`Not a fit`}</button>` : ''}
      </div>
    </header>
    <p class="chat__info">${esc(info)}</p>
    ${showVotes ? `
    <div class="votes" aria-label="Who said yes">
      <span class="votes__label">${L`Everyone says yes to team up`}</span>
      <ul>${voters(c).map((v) => `<li class="${c.votes[v] ? 'is-yes' : ''}"><i class="ph ${c.votes[v] ? 'ph-check-circle' : 'ph-circle-dashed'}" aria-hidden="true"></i>${esc(nick(v, c))}<span class="sr">${c.votes[v] ? ': yes' : ': waiting'}</span></li>`).join('')}</ul>
    </div>` : ''}
    <ul class="log" id="log">${bubbles(c.msgs, U.typing[c.id], names)}</ul>
    ${bottom}
  </section>`;
}
