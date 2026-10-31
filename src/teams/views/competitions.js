/* HTML: the competition list and one competition's page. */

import { esc, safeUrl } from '../../shared/core.js?v=20261031z';
import { L } from '../../shared/i18n.js?v=20261031z';
import { cupFor } from '../../shared/cup.js?v=20261031z';
import { field, select } from '../../shared/forms.js?v=20261031z';
import { CATEGORIES, categoryName, categoryOf, teamSizeText, trackText } from '../../shared/contract.js?v=20261031z';
import { S, U } from '../state.js?v=20261031z';
import { DAYS, PARTS, goalName, goalOptions, hourOptions, hoursName, slotsText } from '../options.js?v=20261031z';
import { COMP, DATA, compOf, dataState, dateText, regionName, searchText, textOf, trackNameOf, whenText } from '../competitions.js?v=20261031z';
import { P } from '../sample-people.js?v=20261031z';
import { defaultMax, isFull, sizeChoices, myTeam, needsOf, personOf, recommendations, spots, teamsIn } from '../rules.js?v=20261031z';
import { personCard, roleChecks, teamCard } from './cards.js?v=20261031z';
import { signInPrompt } from './profile.js?v=20261031z';

export const PAGE = 20;  // competitions per page

// "$0" is not worth saying
const prizeOf = (c) => (c.prize && /[1-9]/.test(c.prize) ? c.prize : '');
const whenLine = (c) => `${esc(whenText(c))}${c.where ? ` · ${esc(c.where)}` : ''}${prizeOf(c) ? ` · ${esc(L`${prizeOf(c)} in prizes`)}` : ''}`;

// Page numbers: 1 … 4 5 6 … 12, with previous / next
function pager(page, pages) {
  if (pages < 2) return '';
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = (n, label, aria) => `<button class="pager__btn ${n === page ? 'is-on' : ''}" data-act="page" data-value="${n}" type="button" ${n === page ? 'aria-current="page"' : ''} ${aria ? `aria-label="${esc(aria)}"` : ''}>${label}</button>`;
  const parts = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) parts.push('<span class="pager__gap" aria-hidden="true">…</span>');
    parts.push(btn(n, n));
  });
  return `
  <nav class="pager" aria-label="${esc(L`Pages`)}">
    ${page > 1 ? btn(page - 1, '<i class="ph ph-caret-left" aria-hidden="true"></i>', L`Previous page`) : ''}
    ${parts.join('')}
    ${page < pages ? btn(page + 1, '<i class="ph ph-caret-right" aria-hidden="true"></i>', L`Next page`) : ''}
  </nav>`;
}

export function viewComps() {
  if (dataState === 'loading') return `<p class="empty">${L`Loading competitions…`}</p>`;
  if (dataState === 'error') return `<p class="empty">${L`Could not load competitions. Refresh to try again.`}</p>`;
  const q = (U.q || '').trim().toLowerCase();
  const region = U.region || 'all';
  const cat = U.cat || 'all';
  const inRegion = DATA.items.filter((c) => (region === 'all' || c.region === region) && (!q || searchText(c).includes(q)));
  const list = inRegion.filter((c) => cat === 'all' || categoryOf(c) === cat);
  // "All": Taiwan first, then international, each by closing date (the list is already in that order)
  if (region === 'all') list.sort((a, b) => (a.region !== 'tw') - (b.region !== 'tw'));
  const counts = {};
  inRegion.forEach((c) => { const k = categoryOf(c); counts[k] = (counts[k] || 0) + 1; });
  const mine = Object.keys(S.cards).filter((id) => COMP[id]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const page = Math.min(U.page || 1, pages);
  const updated = DATA.updatedAt ? dateText(Date.parse(DATA.updatedAt)) : '';
  const row = (c) => `
    <li>
      <a class="card comp" href="#/comp/${esc(c.id)}">
        <div class="comp__top">
          <span class="kind-chip">${esc(categoryName(categoryOf(c)))}</span>
          ${myTeam(c.id) ? `<span class="tag">${L`In a team`}</span>` : S.cards[c.id] ? `<span class="tag">${L`Joined`}</span>` : ''}
        </div>
        <h2>${esc(textOf(c, 'name'))}</h2>
        ${textOf(c, 'organizer') ? `<p class="meta">${esc(textOf(c, 'organizer'))}</p>` : ''}
        <p class="comp__when"><i class="ph ph-calendar-blank" aria-hidden="true"></i>${whenLine(c)}</p>
        <p class="comp__size"><i class="ph ph-users-three" aria-hidden="true"></i>${esc(teamSizeText(c.team))}</p>
      </a>
    </li>`;
  return `
  <header class="head"><div><h1>${L`Competitions`}</h1><p class="sub">${L`Open now. Pick one to find a team.`}</p></div></header>
  <div class="comp-tools">
    <div class="seg" role="group" aria-label="${esc(L`Where`)}">
      ${[['all', 'All'], ['tw', 'Taiwan'], ['intl', 'International']].map(([v, l]) => `<button class="seg__btn ${region === v ? 'is-on' : ''}" data-act="region" data-value="${v}" type="button" aria-pressed="${region === v}">${L(l)}</button>`).join('')}
    </div>
    <label class="sr" for="c-search">${L`Search competitions`}</label>
    <input class="comp-search" id="c-search" type="search" placeholder="${esc(L`Search: AI, design, startup…`)}" value="${esc(U.q || '')}" autocomplete="off">
  </div>
  <div class="cats" role="group" aria-label="${esc(L`Category`)}">
    <button class="cat ${cat === 'all' ? 'is-on' : ''}" data-act="cat" data-value="all" type="button" aria-pressed="${cat === 'all'}">${L`All`} <span>${inRegion.length}</span></button>
    ${CATEGORIES.filter(([id]) => counts[id]).map(([id]) => `<button class="cat ${cat === id ? 'is-on' : ''}" data-act="cat" data-value="${id}" type="button" aria-pressed="${cat === id}">${esc(categoryName(id))} <span>${counts[id]}</span></button>`).join('')}
  </div>
  ${mine.length && !q && cat === 'all' ? `<h2 class="sec-title">${L`You joined`}</h2><ul class="comp-list">${mine.map((id) => row(COMP[id])).join('')}</ul><h2 class="sec-title">${L`All open competitions`}</h2>` : ''}
  ${list.length ? `<ul class="comp-list">${list.slice((page - 1) * PAGE, page * PAGE).map(row).join('')}</ul>` : `<p class="empty">${L`Nothing matches. Try another word.`}</p>`}
  ${pager(page, pages)}
  <p class="credit">${L`${list.length} open · Updated ${esc(updated)} from ${DATA.sources.map((x) => `<a class="inline-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join(', ')}.`} ${L`Details and sign-up are on each official page.`}</p>`;
}

// When you usually work: days across, morning / afternoon / evening down
const slotGrid = (picked = []) => `
  <div class="avail" role="group">
    <span></span>${DAYS.map(([, day]) => `<span class="avail__day">${esc(L(day))}</span>`).join('')}
    ${PARTS.map(([p, part]) => `<span class="avail__part">${esc(L(part))}</span>${DAYS.map(([d, day]) => `<label class="avail__cell"><input type="checkbox" name="when" value="${d}_${p}" ${picked.includes(`${d}_${p}`) ? 'checked' : ''} aria-label="${esc(`${L(day)} ${L(part)}`)}"><span aria-hidden="true"></span></label>`).join('')}`).join('')}
  </div>`;

// The participation card (spec §4): what you bring to this competition. withTeam: also start a team.
export function cardForm(cid, withTeam, editing = false) {
  // A new card starts from your card in another competition, without that competition's idea
  const prev = S.cards[cid] || { ...(Object.values(S.cards)[0] || { canDo: [], wants: [], goal: 'win', hours: 6, built: '', availability: [] }), idea: '' };
  const rules = compOf(cid).team && compOf(cid).team.max ? L`The rules say ${teamSizeText(compOf(cid).team)}.` : L`Check the official rules.`;
  return `
  <form class="panel stack" data-form="card" data-comp="${cid}" data-team="${withTeam ? 1 : ''}" novalidate>
    <h2>${withTeam ? L`Start a team` : editing ? L`Edit your card` : L`Your competition card`}</h2>
    ${withTeam ? field('team', L`Team name`, '', { req: true, ph: L`e.g. Clear Air` }) : ''}
    <div class="field"><p class="field__label">${L`Your role`} <span class="hint-inline">${L`Pick 1 or 2`}</span></p>${roleChecks('canDo', prev.canDo, undefined, true)}</div>
    <div class="field"><p class="field__label">${withTeam ? L`Still need` : L`Roles you are looking for`} <span class="hint-inline">${L`Optional`}</span></p>${roleChecks(withTeam ? 'needs' : 'wants', withTeam ? [] : prev.wants || [], undefined, true)}</div>
    <div class="row2">
      ${select('goal', L`Your goal`, goalOptions(), prev.goal)}
      ${select('hours', L`Time each week`, hourOptions(), String(prev.hours))}
    </div>
    ${field('idea', L`Your idea for this competition`, prev.idea || '', { area: true, ph: L`e.g. An app that helps students find study partners`, hint: L`Optional. Even a rough idea helps others decide.` })}
    ${field('built', L`Something you have built`, prev.built || '', { ph: L`e.g. A bus app used by 2,000 riders`, hint: L`Optional. A project, a product or a competition you took part in.` })}
    <div class="field"><p class="field__label">${withTeam ? L`When does your team usually work?` : L`When do you usually work?`} <span class="hint-inline">${L`Optional`}</span></p>${slotGrid(prev.availability || [])}</div>
    ${withTeam ? select('max', L`Team size limit`, sizeChoices(cid).map((n) => [String(n), L`${n} people`]), String(defaultMax(cid)), rules) : ''}
    <p class="error" id="card-error" hidden></p>
    <div class="btnrow">
      <button class="btn btn--primary" type="submit" ${U.busy ? 'disabled' : ''}>${withTeam ? L`Create team` : editing ? L`Save card` : L`Join`}</button>
      <button class="btn btn--ghost" data-act="form" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>`;
}

// Your card in this competition, with an edit button
function myCard(cid, card) {
  const facts = [goalName(card.goal), hoursName(card.hours), slotsText(card.availability)];
  return `
  <section class="panel mycard">
    <div class="mycard__top">
      <h2>${L`Your card`}</h2>
      <button class="btn btn--ghost btn--sm" data-act="form" data-what="edit" type="button">${L`Edit`}</button>
    </div>
    <p><b>${esc(card.canDo.map((r) => L(r)).join(L`, `))}</b>${card.wants && card.wants.length ? ` · ${L`Looking for ${esc(card.wants.map((r) => L(r)).join(L`, `))}`}` : ''}</p>
    <p class="meta">${facts.filter(Boolean).map(esc).join(' · ')}</p>
    ${card.idea ? `<p class="mycard__line"><span class="meta">${L`Idea`}</span> ${esc(card.idea)}</p>` : ''}
    ${card.built ? `<p class="mycard__line"><span class="meta">${L`Built`}</span> ${esc(card.built)}</p>` : ''}
  </section>`;
}

// One track's rule (the quote it came from stays in the data for checking, not on the page)
const trackItem = (t) => `<li>${esc(trackText(t, trackNameOf(t)))}</li>`;

export function viewComp(cid) {
  if (dataState === 'loading' && !S.compCache[cid]) return `<p class="empty">${L`Loading…`}</p>`;
  const c = compOf(cid);
  const card = S.cards[cid];
  const team = myTeam(cid);
  const recs = card ? recommendations(cid) : [];
  const tracks = c.tracks || [];
  // Only worth a list when the rules differ by track (plan, age group…)
  const byTrack = tracks.length > 1 || tracks.some((t) => t.name);
  const elig = textOf(c, 'eligibility');
  return `
  <a class="back-link" href="#/comps"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`All competitions`}</a>
  <section class="card comp comp--head">
    <div class="comp__top"><span class="kind-chip">${esc(categoryName(categoryOf(c)))}</span></div>
    <h1>${esc(textOf(c, 'name'))}</h1>
    ${textOf(c, 'organizer') ? `<p class="meta">${esc(textOf(c, 'organizer'))}</p>` : ''}
    ${textOf(c, 'summary') ? `<p class="comp__sum">${esc(textOf(c, 'summary'))}</p>` : ''}
    <ul class="facts">
      <li><i class="ph ph-calendar-blank" aria-hidden="true"></i><span>${whenLine(c)}</span></li>
      <li class="facts__size"><i class="ph ph-users-three" aria-hidden="true"></i><span>${esc(teamSizeText(c.team))}${byTrack ? `<ul class="tracks">${tracks.map(trackItem).join('')}</ul>` : ''}</span></li>
      ${elig ? `<li><i class="ph ph-identification-card" aria-hidden="true"></i><span><b>${L`Eligibility`}</b> ${esc(elig)}</span></li>` : ''}
    </ul>
    ${safeUrl(c.url) ? `<div class="btnrow"><a class="btn btn--ghost btn--sm" href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener">${L`Official page`}<i class="ph ph-arrow-up-right" aria-hidden="true"></i></a></div>` : ''}
  </section>

  ${!card && !U.user ? `
  <section class="panel join">
    <h2>${L`Join this competition`}</h2>
    ${signInPrompt(L`Sign in to fill in a card. It stays with your account, on any device.`)}
  </section>` : card && U.form === 'edit' ? cardForm(cid, false, true) : !card ? (U.form && U.form !== 'edit' ? cardForm(cid, U.form === 'team') : `
  <section class="panel join">
    <h2>${L`Join this competition`}</h2>
    <div class="join__choices">
      <button class="choice" data-act="form" data-what="solo" type="button"><i class="ph ph-user-plus" aria-hidden="true"></i><b>${L`I don’t have a team yet`}</b><span>${L`Fill in a card. We suggest people and teams for you.`}</span></button>
      <button class="choice" data-act="form" data-what="team" type="button"><i class="ph ph-users-three" aria-hidden="true"></i><b>${L`I have a team and need people`}</b><span>${L`Create your team. We suggest people for it.`}</span></button>
    </div>
  </section>`) : `
  ${team ? `
  <a class="card my-team" href="#/team/${team.id}">
    <span class="team-cups" aria-hidden="true">${team.members.map((m) => cupFor(personOf(m))).join('')}</span>
    <div><strong>${esc(team.name)}</strong><p class="meta">${spots(team)}${needsOf(team).length ? ` · ${L`Still need: ${esc(needsOf(team).map((r) => L(r)).join(', '))}`}` : ''}</p></div>
    <i class="ph ph-caret-right" aria-hidden="true"></i>
  </a>` : `
  ${myCard(cid, card)}`}
  ${team && isFull(team) ? `<p class="empty">${L`Your team is full (${spots(team)}). Good luck!`}</p>` : `
  <h2 class="sec-title">${team ? L`People for your team` : L`Recommended for you`}</h2>
  <p class="meta sample-note">${L`Sample people for now. Real profiles show up here once more people sign up.`}</p>
  ${recs.length ? recs.map((r) => (r.kind === 'person' ? personCard(P[r.ref], cid) : teamCard(teamsIn(cid).find((t) => t.id === r.ref), cid))).join('') : `<p class="empty">${L`No one else is looking right now.`}</p>`}`}`}`;
}
