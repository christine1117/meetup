/* HTML: sign-up and the Me page (the same fields as Half Sugar). */

import { FIELDS, LOGO, fieldName, flavorName } from '../../shared/flavors.js?v=20261030e';
import { field, select } from '../../shared/forms.js?v=20261030e';
import { CONTACTS, MEETS } from '../../shared/profile.js?v=20261030e';
import { S, U } from '../state.js?v=20261030e';

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

export function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}<span class="logo__sub">Teams</span></p>
      <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button">Dev: skip</button>
    </div>
    <h1 class="t-hero">Find teammates by what they can do.</h1>
    <p class="lead">Real competitions from Devpost, MLH and 獎金獵人. Names stay hidden until you team up.</p>
    <form class="stack" data-form="me" novalidate>
      ${profileFields({})}
      <p class="hint">One profile for Half Sugar and team mode.</p>
      <p class="error" id="me-error" hidden>Please add a nickname.</p>
      <button class="btn btn--primary" type="submit">Start</button>
    </form>
  </main>`;
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
    <h2>About this version</h2>
    <p>Competitions are real and refreshed daily. People and chats are samples until accounts exist, and your data stays in this browser.</p>
    <p><a class="inline-link" href="../">Open Half Sugar</a></p>
    ${U.confirmReset
      ? '<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">Yes, clear it</button><button class="btn btn--ghost" data-act="reset-no" type="button">Cancel</button></div>'
      : '<button class="btn btn--ghost" data-act="reset" type="button">Clear team data</button>'}
  </section>`;
}
