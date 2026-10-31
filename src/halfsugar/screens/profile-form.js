/* ---------- Screen: profile ---------- */

import { accountFields, authNote, busyAttr } from './account.js?v=20261031a';
import { esc } from '../../shared/core.js?v=20261031a';
import { L } from '../../shared/i18n.js?v=20261031a';
import { FIELDS, fieldName, flavorName, flavorsLabel } from '../../shared/flavors.js?v=20261031a';
import { field, select } from '../../shared/forms.js?v=20261031a';
import { CONTACTS, MEETS } from '../../shared/profile.js?v=20261031a';
import { MAX_TAGS, TAG_SUGGESTIONS, myCurious, normTag } from '../matching.js?v=20261031a';
import { S, U } from '../state.js?v=20261031a';


// Type tags (Enter or a comma adds one) or tap a suggestion. scope is 'quiz' or 'me'.
export function tagEditor(scope, key, list, label) {
  const left = TAG_SUGGESTIONS.filter((x) => !list.some((t) => normTag(t) === normTag(x))).slice(0, scope === 'me' ? 8 : 14);
  return `
      <div class="field tags" role="group" aria-labelledby="${key}-label">
        <p class="field__label" id="${key}-label">${label}</p>
        ${list.length ? `<ul class="tags__list">${list.map((t) => `<li class="tag-chip">${esc(L(t))}<button type="button" data-act="tag-remove" data-scope="${scope}" data-key="${key}" data-value="${esc(t)}" aria-label="${esc(L`Remove ${t}`)}"><i class="ph ph-x" aria-hidden="true"></i></button></li>`).join('')}</ul>` : ''}
        ${list.length < MAX_TAGS ? `
        <div class="tags__add">
          <input id="c-tag-${key}" data-tag-input data-scope="${scope}" data-key="${key}" autocomplete="off" aria-label="${esc(label)}" placeholder="${esc(L`Type and press Enter`)}">
          <button class="btn btn--ghost btn--sm" data-act="tag-add" data-scope="${scope}" data-key="${key}" type="button">${L`Add`}</button>
        </div>
        <div class="tags__suggest">${left.map((x) => `<button class="cat cat--sm" data-act="tag-add" data-scope="${scope}" data-key="${key}" data-value="${esc(x)}" type="button">+ ${esc(L(x))}</button>`).join('')}</div>` : `<p class="hint">${L`Up to ${MAX_TAGS}.`}</p>`}
      </div>`;
}

// The list a tag button edits: your saved card, or the onboarding answers
export function tagList(scope, key) {
  if (scope !== 'me') return U.quiz[key];
  if (!Array.isArray(S.me[key])) S.me[key] = key === 'curious' ? [...myCurious()] : [];
  return S.me[key];
}

// The first-time form skips what the quick questions already asked
// On Me each half of the card folds into a short summary; tap Edit to open it
export function secStart(key, icon, title, summary) {
  return `<details class="panel sec ${key === 'sealed' ? 'panel--locked' : ''}" data-sec="${key}" ${U.openSec[key] ? 'open' : ''}>
      <summary class="sec__head">
        <span class="sec__title"><i class="ph ${icon}" aria-hidden="true"></i>${title}</span>
        <span class="sec__edit">${L`Edit`}</span>
        <div class="sec__sum">${summary}</div>
      </summary>
      <div class="sec__body stack">`;
}

export function publicSummary(me) {
  const line = [me.alias, flavorsLabel(me), me.city].filter(Boolean).map(esc).join(' · ');
  const tags = (label, list) => (list.length ? `<p class="meta">${label}: ${esc(list.join(', '))}</p>` : '');
  const meet = (MEETS.find(([v]) => v === me.meet) || [])[1];
  return `<p><strong>${line}</strong></p>${meet ? `<p class="meta">${L`Meet`}: ${esc(L(meet))}</p>` : ''}${tags(L`Curious`, myCurious())}${me.fun ? `<p class="meta">${L`Fun fact`}: ${esc(me.fun)}</p>` : ''}`;
}

export function sealedSummary(me) {
  const keys = [['name', L`name`], ['title', L`title`], ['school', L`school`], ['company', L`company`], ['contact', L`contact`]];
  const filled = keys.filter(([k]) => me[k]);
  return `<p class="meta">${filled.length ? L`${filled.length} of 5 filled: ${filled.map(([, l]) => l).join(', ')}` : L`Nothing added yet.`}</p>`;
}

export function profileForm(me, first) {
  me = me || {};
  const fold = !first;
  return `
  <form data-form="profile" class="stack profile-form ${fold ? 'is-folding' : ''}" novalidate>
    ${fold ? secStart('public', 'ph-eye', L`Visible from the start`, publicSummary(me)) : `<fieldset class="panel">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>${L`Visible from the start`}</legend>`}
      ${field('alias', L`Nickname`, me.alias, { req: true, hint: L`Not your real name.` })}
      ${first ? '' : `
      <div class="row2">
        ${select('field', L`Field (your flavor)`, FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`]), me.field || FIELDS[0])}
        ${select('field2', L`Second field (optional)`, [['', L`None`], ...FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`])], me.field2 || '')}
      </div>
      <div class="row2">
        ${field('city', L`City`, me.city, { ph: L`e.g. Taipei` })}
        ${select('meet', L`How you like to meet`, MEETS.map(([v, l]) => [v, L(l)]), me.meet || 'both')}
      </div>
      ${tagEditor('me', 'curious', myCurious(), L`Curious about`)}`}
      ${field('fun', L`Fun fact`, me.fun ?? me.proof, { ph: L`Something people would not guess about you` })}
    ${fold ? '</div></details>' : '</fieldset>'}
    ${fold ? secStart('sealed', 'ph-lock-simple', L`Sealed until you both pop the seal`, sealedSummary(me)) : `<fieldset class="panel panel--locked">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed until you both pop the seal`}</legend>`}
      <div class="row2">
        ${field('name', L`Real name`, me.name)}
        ${field('title', L`Job title`, me.title)}
      </div>
      <div class="row2">
        ${field('school', L`School`, me.school)}
        ${field('company', L`Company`, me.company)}
      </div>
      <div class="row2 row2--contact">
        ${select('contactType', L`Contact`, CONTACTS.map(([v, l]) => [v, L(l)]), me.contactType || 'instagram')}
        ${field('contact', L`Handle or link`, me.contact, { ph: L`e.g. @yourname` })}
      </div>
    ${fold ? '</div></details>' : '</fieldset>'}
    ${first && !U.user ? `<fieldset class="panel">
      <legend><i class="ph ph-user-circle" aria-hidden="true"></i>${L`Your account`}</legend>
      ${accountFields(true)}
      <p class="hint">${L`One account for Half Sugar and team mode.`}</p>
    </fieldset>` : ''}
    <p class="error" id="profile-error" hidden>${L`Please add a nickname.`}</p>
    ${first ? authNote() : ''}
    <button class="btn btn--primary save-btn" type="submit" ${first ? busyAttr() : ''}>${first ? (U.busy ? L`One moment…` : L`Start sipping`) : L`Save`}</button>
  </form>`;
}
