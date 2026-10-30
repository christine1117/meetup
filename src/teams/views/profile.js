/* HTML: create an account, log in, and the Me page (the same profile as Half Sugar). */

import { FIELDS, LOGO, fieldName, flavorName } from '../../shared/flavors.js?v=20261030g';
import { field, select } from '../../shared/forms.js?v=20261030g';
import { CONTACTS, MEETS } from '../../shared/profile.js?v=20261030g';
import { S, U } from '../state.js?v=20261030g';
import { esc } from '../../shared/core.js?v=20261030g';

// The same profile as Half Sugar: visible from the start, then sealed details
export function profileFields(me) {
  return `
    <fieldset class="panel stack">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>Visible from the start</legend>
      ${field('alias', 'Nickname', me.alias, { req: true, hint: 'Not your real name.' })}
      <div class="row2">
        ${select('field', 'Field (your flavor)', FIELDS.map((f) => [f, `${fieldName(f)}, ${flavorName(f)}`]), me.field || 'Design')}
        ${field('city', 'City', me.city, { ph: 'e.g. Taipei' })}
      </div>
      ${select('meet', 'How you like to meet', MEETS, me.meet || 'both')}
      ${field('curious', 'Curious about', (me.curious || []).join(', '), { ph: 'e.g. Climate tech, Pricing', hint: 'Separate with commas.' })}
      ${field('fun', 'Fun fact', me.fun, { ph: 'Something people would not guess about you' })}
    </fieldset>
    <fieldset class="panel panel--locked stack">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>Sealed until you team up</legend>
      <div class="row2">${field('name', 'Real name', me.name)}${field('title', 'Job title', me.title)}</div>
      <div class="row2">${field('school', 'School', me.school)}${field('company', 'Company', me.company)}</div>
      <div class="row2">
        ${select('contactType', 'Contact', CONTACTS, me.contactType || 'instagram')}
        ${field('contact', 'Handle or link', me.contact, { ph: 'e.g. @yourname' })}
      </div>
    </fieldset>`;
}

const accountFields = (newAccount) => `
    <fieldset class="panel stack">
      <legend><i class="ph ph-user-circle" aria-hidden="true"></i>Your account</legend>
      <div class="row2">
        ${field('email', 'Email', '', { type: 'email', req: true, auto: 'email', ph: 'you@example.com' })}
        ${field('password', 'Password', '', { type: 'password', req: true, auto: newAccount ? 'new-password' : 'current-password', hint: newAccount ? 'At least 8 characters.' : '' })}
      </div>
    </fieldset>`;

const note = () => (U.authMsg ? `<p class="${U.authMsg.ok ? 'ok-note' : 'error'}" role="status">${esc(U.authMsg.text)}</p>` : '');
const busy = (label) => (U.busy ? 'disabled>One moment…' : `>${label}`);

// Sign up (with the profile), log in, or (signed in without a profile yet) fill in the profile
export function authForms({ withProfile = true } = {}) {
  if (U.needProfile) {
    return `
    <form class="stack" data-form="me" novalidate>
      <p class="lead">You are signed in. Fill in your profile to start.</p>
      ${profileFields({})}
      <p class="error" id="me-error" hidden>Please add a nickname.</p>
      <button class="btn btn--primary" type="submit">Save profile</button>
    </form>`;
  }
  if (U.auth === 'login') {
    return `
    <form class="stack" data-form="login" novalidate>
      ${accountFields(false)}
      ${note()}
      <button class="btn btn--primary" type="submit" ${busy('Log in')}</button>
      <p class="hint">New here? <button class="link-btn" data-act="auth-mode" data-mode="signup" type="button">Create an account</button></p>
    </form>`;
  }
  return `
    <form class="stack" data-form="signup" data-local="${withProfile ? '' : '1'}" novalidate>
      ${accountFields(true)}
      ${withProfile ? profileFields({}) : ''}
      <p class="hint">One account and one profile for Half Sugar and team mode.</p>
      ${note()}
      <button class="btn btn--primary" type="submit" ${busy('Create account')}</button>
      <p class="hint">Already have an account? <button class="link-btn" data-act="auth-mode" data-mode="login" type="button">Log in</button></p>
    </form>`;
}

export function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}<span class="logo__sub">Teams</span></p>
      <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button">Dev: skip</button>
    </div>
    <h1 class="t-hero">Find teammates by what they can do.</h1>
    <p class="lead">Real competitions from Devpost, MLH and 獎金獵人. Names stay hidden until you team up.</p>
    ${authForms()}
  </main>`;
}

// Signed out, but a profile already lives in this browser: make it an account, or log in
export function viewAccount() {
  return `
  <header class="head"><div><h1>Account</h1><p class="sub">${U.auth === 'login' ? 'Log in to bring back your profile.' : 'Save your profile to an account, so it is there on any device.'}</p></div></header>
  ${authForms({ withProfile: false })}`;
}

export function viewMe() {
  return `
  <header class="head"><div><h1>Me</h1><p class="sub">Shared with Half Sugar. The sealed part unlocks when you team up.</p></div></header>
  <form class="stack" data-form="me" novalidate>
    ${profileFields(S.me)}
    <p class="error" id="me-error" hidden>Please add a nickname.</p>
    <button class="btn btn--primary" type="submit">Save</button>
  </form>
  <section class="panel note">
    <h2>Account</h2>
    ${U.user
      ? `<p>Signed in as <b>${esc(U.user.email)}</b>. Your profile is saved to your account.</p>
         <button class="btn btn--ghost" data-act="logout" type="button">Log out</button>`
      : `<p>Not signed in: your profile is only in this browser.</p>
         <a class="btn btn--dark btn--sm" href="#/account">Create an account or log in</a>`}
  </section>
  <section class="panel note">
    <h2>About this version</h2>
    <p>Competitions are real and refreshed daily. People and chats are still samples, and your teams and chats stay in this browser.</p>
    <p><a class="inline-link" href="../">Open Half Sugar</a></p>
    ${U.confirmReset
      ? '<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">Yes, clear it</button><button class="btn btn--ghost" data-act="reset-no" type="button">Cancel</button></div>'
      : '<button class="btn btn--ghost" data-act="reset" type="button">Clear team data</button>'}
  </section>`;
}
