/* ---------- Accounts ----------
   The same account and profile as team mode (see ../../shared/account.js). */

import { esc } from '../../shared/core.js?v=20261030g';
import { L } from '../../shared/i18n.js?v=20261030g';
import { field } from '../../shared/forms.js?v=20261030g';
import { U } from '../state.js?v=20261030g';

export const accountFields = (isNew) => `
    <div class="row2">
      ${field('email', L`Email`, '', { type: 'email', req: true, auto: 'email', ph: 'you@example.com' })}
      ${field('password', L`Password`, '', { type: 'password', req: true, auto: isNew ? 'new-password' : 'current-password', hint: isNew ? L`At least 8 characters.` : '' })}
    </div>`;

export const authNote = () => (U.authMsg ? `<p class="${U.authMsg.ok ? 'ok-note' : 'error'}" role="status">${esc(U.authMsg.text)}</p>` : '');
export const busyAttr = () => (U.busy ? 'disabled' : '');

export function loginForm() {
  return `
    <form class="stack" data-form="login" novalidate>
      <fieldset class="panel stack">
        <legend><i class="ph ph-user-circle" aria-hidden="true"></i>${L`Log in`}</legend>
        ${accountFields(false)}
      </fieldset>
      ${authNote()}
      <button class="btn btn--primary" type="submit" ${busyAttr()}>${U.busy ? L`One moment…` : L`Log in`}</button>
    </form>`;
}

// On Me: signed in, or a way to save this profile to an account
export function accountPanel() {
  if (U.user) {
    return `
  <section class="panel note">
    <h2>${L`Account`}</h2>
    <p>${L`Signed in as ${`<b>${esc(U.user.email)}</b>`}. Your profile is saved to your account.`}</p>
    <button class="btn btn--ghost" data-act="logout" type="button">${L`Log out`}</button>
  </section>`;
  }
  if (U.authView === 'login') {
    return `
  <section class="panel note">
    <h2>${L`Account`}</h2>
    ${loginForm()}
    <p class="hint">${L`No account yet?`} <button class="link-btn" data-act="auth-view" data-view="" type="button">${L`Create one with this profile`}</button></p>
  </section>`;
  }
  return `
  <section class="panel note">
    <h2>${L`Account`}</h2>
    <p>${L`Not signed in: your profile is only in this browser. Make an account to keep it on any device.`}</p>
    <form class="stack" data-form="signup" novalidate>
      ${accountFields(true)}
      ${authNote()}
      <button class="btn btn--dark btn--sm" type="submit" ${busyAttr()}>${U.busy ? L`One moment…` : L`Create account`}</button>
    </form>
    <p class="hint">${L`Already have an account?`} <button class="link-btn" data-act="auth-view" data-view="login" type="button">${L`Log in`}</button></p>
  </section>`;
}
