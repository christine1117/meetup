/* HTML: the competition list and one competition's page. */

import { esc, safeUrl } from '../../shared/core.js?v=20261030g';
import { cupFor } from '../../shared/cup.js?v=20261030g';
import { field, select } from '../../shared/forms.js?v=20261030g';
import { teamSizeText, trackText } from '../../shared/contract.js?v=20261030g';
import { S, U } from '../state.js?v=20261030g';
import { roleChips } from '../ui.js?v=20261030g';
import { GOALS, HOURS, TOPICS, goalName, hoursName } from '../options.js?v=20261030g';
import { COMP, DATA, REGION_NAME, SOURCE_NAME, compOf, dataState, dateText, whenText } from '../competitions.js?v=20261030g';
import { P } from '../sample-people.js?v=20261030g';
import { SIZE_CHOICES, defaultMax, isFull, myTeam, needsOf, personOf, recommendations, spots, teamsIn } from '../rules.js?v=20261030g';
import { personCard, roleChecks, teamCard } from './cards.js?v=20261030g';

export const PAGE = 30;
export function viewComps() {
  if (dataState === 'loading') return '<p class="empty">Loading competitions…</p>';
  if (dataState === 'error') return '<p class="empty">Could not load competitions. Refresh to try again.</p>';
  const q = (U.q || '').trim().toLowerCase();
  const region = U.region || 'all';
  const list = DATA.items.filter((c) => (region === 'all' || c.region === region)
    && (!q || [c.name, c.organizer, c.kind, ...(c.tags || [])].join(' ').toLowerCase().includes(q)));
  const mine = Object.keys(S.cards).filter((id) => COMP[id]);
  const shown = U.shown || PAGE;
  const updated = DATA.updatedAt ? dateText(Date.parse(DATA.updatedAt)) : '';
  const row = (c) => `
    <li>
      <a class="card comp" href="#/comp/${esc(c.id)}">
        <div class="comp__top">
          <span class="kind-chip">${esc(c.kind)}</span>
          <span class="src">${esc(REGION_NAME[c.region] || '')} · ${esc(SOURCE_NAME[c.source] || '')}</span>
          ${myTeam(c.id) ? '<span class="tag">In a team</span>' : S.cards[c.id] ? '<span class="tag">Joined</span>' : ''}
        </div>
        <h2>${esc(c.name)}</h2>
        ${c.organizer ? `<p class="meta">${esc(c.organizer)}</p>` : ''}
        <p class="comp__when"><i class="ph ph-calendar-blank" aria-hidden="true"></i>${esc(whenText(c))}${c.where ? ` · ${esc(c.where)}` : ''}${c.prize ? ` · ${esc(c.prize)} in prizes` : ''}</p>
        <p class="comp__size"><i class="ph ph-users-three" aria-hidden="true"></i>${esc(teamSizeText(c.team))}</p>
      </a>
    </li>`;
  return `
  <header class="head"><div><h1>Competitions</h1><p class="sub">Open now. Pick one to find a team.</p></div></header>
  <div class="comp-tools">
    <div class="seg" role="group" aria-label="Where">
      ${[['all', 'All'], ['tw', 'Taiwan'], ['intl', 'International']].map(([v, l]) => `<button class="seg__btn ${region === v ? 'is-on' : ''}" data-act="region" data-value="${v}" type="button" aria-pressed="${region === v}">${l}</button>`).join('')}
    </div>
    <label class="sr" for="c-search">Search competitions</label>
    <input class="comp-search" id="c-search" type="search" placeholder="Search: AI, design, 創業…" value="${esc(U.q || '')}" autocomplete="off">
  </div>
  ${mine.length && !q ? `<h2 class="sec-title">You joined</h2><ul class="comp-list">${mine.map((id) => row(COMP[id])).join('')}</ul><h2 class="sec-title">All open competitions</h2>` : ''}
  ${list.length ? `<ul class="comp-list">${list.slice(0, shown).map(row).join('')}</ul>` : '<p class="empty">Nothing matches. Try another word.</p>'}
  ${list.length > shown ? `<button class="btn btn--ghost more-btn" data-act="more" type="button">Show more (${list.length - shown} left)</button>` : ''}
  <p class="credit">${list.length} open · Updated ${esc(updated)} from ${DATA.sources.map((x) => `<a class="inline-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join(', ')}. Details and sign-up are on each official page.</p>`;
}

export function cardForm(cid, withTeam) {
  const prev = S.cards[cid] || Object.values(S.cards)[0] || { canDo: [], topics: [], goal: 'win', hours: 6 };
  return `
  <form class="panel stack" data-form="card" data-comp="${cid}" data-team="${withTeam ? 1 : ''}" novalidate>
    <h2>${withTeam ? 'Start a team' : 'Your competition card'}</h2>
    ${withTeam ? field('team', 'Team name', '', { req: true, ph: 'e.g. Clear Air' }) : ''}
    ${withTeam ? field('pitch', 'What are you building?', '', { area: true, ph: 'One or two sentences. You can change it later.' }) : ''}
    <div class="field"><p class="field__label">Your role <span class="hint-inline">Pick 1 or 2</span></p>${roleChecks('canDo', prev.canDo)}</div>
    <div class="row2">
      ${select('goal', 'Your goal', GOALS, prev.goal)}
      ${select('hours', 'Time each week', HOURS, String(prev.hours))}
    </div>
    <div class="field"><p class="field__label">What you care about <span class="hint-inline">Optional</span></p>${roleChecks('topics', prev.topics || [], TOPICS)}</div>
    ${withTeam ? select('max', 'Team size limit', SIZE_CHOICES.map((n) => [String(n), `${n} people`]), String(defaultMax(cid)), compOf(cid).team && compOf(cid).team.max ? `The rules say ${teamSizeText(compOf(cid).team).toLowerCase()}.` : 'Check the official rules.') : ''}
    ${withTeam ? `<div class="field"><p class="field__label">Still need <span class="hint-inline">Optional. Can include a role you already have.</span></p>${roleChecks('needs', [])}</div>` : ''}
    <p class="error" id="card-error" hidden>Pick 1 or 2 roles${withTeam ? ' and add a team name' : ''}.</p>
    <div class="btnrow">
      <button class="btn btn--primary" type="submit">${withTeam ? 'Create team' : 'Join'}</button>
      <button class="btn btn--ghost" data-act="form" data-what="" type="button">Cancel</button>
    </div>
  </form>`;
}

export function viewComp(cid) {
  if (dataState === 'loading' && !S.compCache[cid]) return '<p class="empty">Loading…</p>';
  const c = compOf(cid);
  const card = S.cards[cid];
  const team = myTeam(cid);
  const recs = card ? recommendations(cid) : [];
  return `
  <a class="back-link" href="#/comps"><i class="ph ph-arrow-left" aria-hidden="true"></i>All competitions</a>
  <section class="card comp comp--head">
    <div class="comp__top"><span class="kind-chip">${esc(c.kind)}</span><span class="src">${esc(REGION_NAME[c.region] || '')}</span></div>
    <h1>${esc(c.name)}</h1>
    ${c.organizer ? `<p class="meta">${esc(c.organizer)}</p>` : ''}
    ${c.url ? `<p class="comp__when"><i class="ph ph-calendar-blank" aria-hidden="true"></i>${esc(whenText(c))}${c.where ? ` · ${esc(c.where)}` : ''}${c.prize ? ` · ${esc(c.prize)} in prizes` : ''}</p>` : ''}
    ${(c.tracks || []).length ? '' : `<p class="comp__size"><i class="ph ph-users-three" aria-hidden="true"></i>${esc(teamSizeText(c.team))}</p>`}
    ${c.summary ? `<p class="comp__sum">${esc(c.summary)}</p>` : ''}
    ${(c.tracks || []).length || c.eligibility ? `
    <div class="comp__rules">
      ${(c.tracks || []).length ? `
      <p class="field__label"><i class="ph ph-users-three" aria-hidden="true"></i>Team size</p>
      <ul class="tracks">${c.tracks.map((t) => `<li><b>${esc(trackText(t))}</b><q>${esc(t.evidence)}</q></li>`).join('')}</ul>` : ''}
      ${c.eligibility ? `<p class="field__label"><i class="ph ph-identification-card" aria-hidden="true"></i>Who can enter</p><p class="comp__elig">${esc(c.eligibility)}</p>` : ''}
      <p class="meta">Read from the official page. Check the rules there before you sign up.</p>
    </div>` : ''}
    ${(c.tags || []).length ? `<p class="chips">${roleChips(c.tags)}</p>` : ''}
    ${safeUrl(c.url) ? `<div class="btnrow"><a class="btn btn--ghost btn--sm" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">Official page<i class="ph ph-arrow-up-right" aria-hidden="true"></i></a><span class="meta">Listed on ${esc(SOURCE_NAME[c.source] || '')}. Sign up there too.</span></div>` : ''}
  </section>

  ${!card ? (U.form ? cardForm(cid, U.form === 'team') : `
  <section class="panel join">
    <h2>Join this competition</h2>
    <div class="join__choices">
      <button class="choice" data-act="form" data-what="solo" type="button"><i class="ph ph-user-plus" aria-hidden="true"></i><b>I need a team</b><span>Fill in a card and meet people</span></button>
      <button class="choice" data-act="form" data-what="team" type="button"><i class="ph ph-users-three" aria-hidden="true"></i><b>I have a team, we need more people</b><span>Invite friends, find the rest here</span></button>
    </div>
  </section>`) : `
  ${team ? `
  <a class="card my-team" href="#/team/${team.id}">
    <span class="team-cups" aria-hidden="true">${team.members.map((m) => cupFor(personOf(m))).join('')}</span>
    <div><strong>${esc(team.name)}</strong><p class="meta">${spots(team)}${needsOf(team).length ? ` · Still need: ${esc(needsOf(team).join(', '))}` : ''}</p></div>
    <i class="ph ph-caret-right" aria-hidden="true"></i>
  </a>` : `
  <section class="mycard">
    <p class="meta">Your card · <b>${esc(card.canDo.join(', '))}</b> · ${esc(goalName(card.goal))} · ${esc(hoursName(card.hours))}${card.topics.length ? ` · Cares about ${esc(card.topics.join(', '))}` : ''}</p>
  </section>`}
  ${team && isFull(team) ? `<p class="empty">Your team is full (${spots(team)}). Good luck!</p>` : `
  <h2 class="sec-title">${team ? 'People for your team' : 'Recommended for you'}</h2>
  <p class="meta sample-note">Sample people for now. Real profiles show up here once sign-ups open.</p>
  ${recs.length ? recs.map((r) => (r.kind === 'person' ? personCard(P[r.ref], cid) : teamCard(teamsIn(cid).find((t) => t.id === r.ref), cid))).join('') : '<p class="empty">No one else is looking right now.</p>'}`}`}`;
}
