/* HTML: create an account, log in, and the Me page. */
import { L, langSwitch } from '../../shared/i18n.js?v=20261031d';

import { FIELDS, LOGO, fieldName, flavorName } from '../../shared/flavors.js?v=20261031d';
import { field, select } from '../../shared/forms.js?v=20261031d';
import { CONTACTS, CURIOUS_GROUPS, MAX_CURIOUS, MEETS } from '../../shared/profile.js?v=20261031d';
import { S, U } from '../state.js?v=20261031d';
import { esc } from '../../shared/core.js?v=20261031d';

// "Curious about": what you picked is shown; "Choose more" opens every group of choices.
// Ticking a box does not redraw the page, so a ticked box stays where it is until you save.
// The groups' names and the choices are shown in the chosen language; English is what is saved.
const box = (x, on) => `<label class="check"><input type="checkbox" name="curious" value="${esc(x)}" ${on ? 'checked' : ''}><span>${esc(L(x))}</span></label>`;
function curiousChecks(picked) {
  const groups = CURIOUS_GROUPS.map(([name, list]) => {
    const rest = list.filter((x) => !picked.includes(x));
    return rest.length ? `<p class="choose__group">${esc(L(name))}</p><div class="checks">${rest.map((x) => box(x, false)).join('')}</div>` : '';
  }).join('');
  return `
    <div class="checks">${picked.length ? picked.map((x) => box(x, true)).join('') : `<p class="hint">${L`Nothing picked yet.`}</p>`}</div>
    <details class="choose">
      <summary><span class="choose__more">${picked.length ? L`Show more topics` : L`Pick topics`}</span><span class="choose__less">${L`Show less`}</span><i class="ph ph-caret-down" aria-hidden="true"></i></summary>
      ${groups}
    </details>
    <p class="hint" id="curious-full" hidden>${L`You can pick up to ${MAX_CURIOUS}. Untick one to choose another.`}</p>`;
}

// The profile: visible from the start, then sealed details
export function profileFields(me) {
  return `
    <fieldset class="panel stack">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>${L`Visible from the start`}</legend>
      ${field('alias', L`Nickname`, me.alias, { req: true, hint: L`Not your real name.` })}
      <div class="row2">
        ${select('field', L`Field (your flavor)`, FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`]), me.field || 'Design')}
        ${field('city', L`City`, me.city, { ph: L`e.g. Taipei` })}
      </div>
      ${select('meet', L`How you like to meet`, MEETS.map(([v, l]) => [v, L(l)]), me.meet || 'both')}
      <div class="field"><p class="field__label">${L`Curious about`} <span class="hint-inline">${L`Up to ${MAX_CURIOUS}`}</span></p>${curiousChecks(me.curious || [])}</div>
      ${field('fun', L`Fun fact`, me.fun, { ph: L`Something people would not guess about you` })}
    </fieldset>
    <fieldset class="panel panel--locked stack">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed until you team up`}</legend>
      <div class="row2">${field('name', L`Real name`, me.name)}${field('title', L`Job title`, me.title)}</div>
      <div class="row2">${field('school', L`School`, me.school)}${field('company', L`Company`, me.company)}</div>
      <div class="row2">
        ${select('contactType', L`Contact`, CONTACTS.map(([v, l]) => [v, L(l)]), me.contactType || 'instagram')}
        ${field('contact', L`Handle or link`, me.contact, { ph: L`e.g. @yourname` })}
      </div>
    </fieldset>`;
}

const accountFields = (newAccount) => `
    <fieldset class="panel stack">
      <legend><i class="ph ph-user-circle" aria-hidden="true"></i>${L`Your account`}</legend>
      <div class="row2">
        ${field('email', L`Email`, '', { type: 'email', req: true, auto: 'email', ph: 'you@example.com' })}
        ${field('password', L`Password`, '', { type: 'password', req: true, auto: newAccount ? 'new-password' : 'current-password', hint: newAccount ? L`At least 8 characters.` : '' })}
      </div>
    </fieldset>`;

// "Continue with Google / Apple / LinkedIn", for the ones switched on in Supabase
const providerButtons = () => ((U.providers || []).length ? `
    <div class="oauth">
      ${U.providers.map(([id, name, icon]) => `<button class="btn btn--ghost oauth__btn" data-act="oauth" data-provider="${id}" type="button"><i class="ph ${icon}" aria-hidden="true"></i>${L`Continue with ${name}`}</button>`).join('')}
      <p class="oauth__or"><span>${L`or with email`}</span></p>
    </div>` : '');

const note = () => (U.authMsg ? `<p class="${U.authMsg.ok ? 'ok-note' : 'error'}" role="status">${esc(U.authMsg.text)}</p>` : '');
const busy = (label) => (U.busy ? `disabled>${L`One moment…`}` : `>${label}`);

// Sign up (with the profile), log in, or (signed in without a profile yet) fill in the profile
export function authForms({ withProfile = true } = {}) {
  if (U.needProfile) {
    return `
    <form class="stack" data-form="me" novalidate>
      <p class="lead">${L`You are signed in. Fill in your profile to start.`}</p>
      ${profileFields({})}
      <p class="error" id="me-error" hidden>${L`Please add a nickname.`}</p>
      <button class="btn btn--primary" type="submit">${L`Save profile`}</button>
    </form>`;
  }
  if (U.auth === 'login') {
    return `
    ${providerButtons()}
    <form class="stack" data-form="login" novalidate>
      ${accountFields(false)}
      ${note()}
      <button class="btn btn--primary" type="submit" ${busy(L`Log in`)}</button>
      <p class="hint">${L`New here?`} <button class="link-btn" data-act="auth-mode" data-mode="signup" type="button">${L`Create an account`}</button></p>
    </form>`;
  }
  return `
    ${providerButtons()}
    <form class="stack" data-form="signup" data-local="${withProfile ? '' : '1'}" novalidate>
      ${accountFields(true)}
      ${withProfile ? profileFields({}) : ''}
      <p class="hint">${L`Your name, school and contact stay hidden until you team up.`}</p>
      ${note()}
      <button class="btn btn--primary" type="submit" ${busy(L`Create account`)}</button>
      <p class="hint">${L`Already have an account?`} <button class="link-btn" data-act="auth-mode" data-mode="login" type="button">${L`Log in`}</button></p>
    </form>`;
}

export function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}<span class="logo__sub">Teams</span></p>
      <div class="btnrow">${langSwitch()}<button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button">Dev: skip</button></div>
    </div>
    <h1 class="t-hero">${L`Find teammates by what they can do.`}</h1>
    <p class="lead">${L`Real competitions from Devpost, MLH and 獎金獵人. Names stay hidden until you team up.`}</p>
    ${authForms()}
  </main>`;
}

// Signed out, but a profile already lives in this browser: make it an account, or log in
export function viewAccount() {
  return `
  <header class="head"><div><h1>${L`Account`}</h1><p class="sub">${U.auth === 'login' ? L`Log in to bring back your profile.` : L`Save your profile to an account, so it is there on any device.`}</p></div></header>
  ${authForms({ withProfile: false })}`;
}

export function viewMe() {
  return `
  <header class="head"><div><h1>${L`Me`}</h1><p class="sub">${L`The sealed part unlocks when you team up.`}</p></div></header>
  <form class="stack" data-form="me" novalidate>
    ${profileFields(S.me)}
    <p class="error" id="me-error" hidden>${L`Please add a nickname.`}</p>
    <button class="btn btn--primary" type="submit">${L`Save`}</button>
  </form>
  <section class="panel note">
    <h2>${L`Account`}</h2>
    ${U.user
      ? `<p>${L`Signed in as ${`<b>${esc(U.user.email)}</b>`}. Your profile is saved to your account.`}</p>
         <button class="btn btn--ghost" data-act="logout" type="button">${L`Log out`}</button>`
      : `<p>${L`Not signed in: your profile is only in this browser.`}</p>
         <a class="btn btn--dark btn--sm" href="#/account">${L`Create an account or log in`}</a>`}
  </section>
  <section class="panel note">
    <h2>${L`About this version`}</h2>
    <p>${L`Competitions are real and refreshed daily. People and chats are still samples, and your teams and chats stay in this browser.`}</p>
    ${U.confirmReset
      ? `<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">${L`Yes, clear it`}</button><button class="btn btn--ghost" data-act="reset-no" type="button">${L`Cancel`}</button></div>`
      : `<button class="btn btn--ghost" data-act="reset" type="button">${L`Clear team data`}</button>`}
  </section>`;
}
