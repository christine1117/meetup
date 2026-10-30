/* ---------- Screen: onboarding ----------
   A few quick questions, one per screen, then the profile form.
   Single-choice answers move on by themselves. */

import { esc } from '../../shared/core.js?v=20261030f';
import { L } from '../../shared/i18n.js?v=20261030f';
import { FIELDS, LOGO, drinkFor, fieldName, flavor, flavorName } from '../../shared/flavors.js?v=20261030f';
import { cup, cupFor } from '../../shared/cup.js?v=20261030f';
import { field } from '../../shared/forms.js?v=20261030f';
import { MEETS } from '../../shared/profile.js?v=20261030f';
import { U } from '../state.js?v=20261030f';
import { profileForm, tagEditor } from './profile-form.js?v=20261030f';


export const QUIZ_STEPS = 3;

export function quizStep(q) {
  const option = (key, value, label, art = '') => `
    <button class="option ${q[key] === value ? 'is-on' : ''}" data-act="quiz-pick" data-key="${key}" data-value="${esc(value)}" type="button" aria-pressed="${q[key] === value}">${art}<span>${esc(label)}</span></button>`;

  if (q.step === 0) {
    return `
    <h2 class="quiz__q">${L`First, pick your flavor.`}</h2>
    <p class="quiz__hint">${L`Your field is your flavor. Two fields? Pick a second one.`}</p>
    <div class="options options--flavors">${FIELDS.map((f) => {
      const i = [q.field, q.field2].indexOf(f);
      const tag = q.field2 ? [L`Main`, L`Second`][i] : '';
      return `<button class="option ${i >= 0 ? 'is-on' : ''}" data-act="quiz-field" data-value="${f}" type="button" aria-pressed="${i >= 0}">${cup(flavor(f)[1], { cls: 'cup--option' })}<span>${esc(L`${fieldName(f)}, ${flavorName(f)}`)}${tag ? `<small>${tag}</small>` : ''}</span></button>`;
    }).join('')}</div>
    ${q.field ? `<p class="quiz__preview">${cupFor(q, 'cup--lg')}<span>${esc(drinkFor(q))}</span></p>` : ''}`;
  }
  if (q.step === 1) {
    return `
    <h2 class="quiz__q">${L`How do you like to meet?`}</h2>
    <div class="options">${MEETS.map(([v, l]) => option('meet', v, L(l))).join('')}</div>
    ${field('city', L`Which city are you in?`, q.city, { ph: L`e.g. Taipei` })}`;
  }
  if (q.step === 2) {
    return `
    <h2 class="quiz__q">${L`What are you curious about?`}</h2>
    <p class="quiz__hint">${L`Things you would love to hear about. Type your own or tap one.`}</p>
    ${tagEditor('quiz', 'curious', q.curious, L`Curious about`)}`;
  }
  return `
    <h2 class="quiz__q">${L`Last step: a little about you.`}</h2>
    ${profileForm(null, true)}`;
}

export function viewOnboard() {
  const q = U.quiz;
  const shown = U.quizShown;
  U.quizShown = q.step;
  const canNext = [q.field, q.meet, q.curious.length][q.step];
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}</p>
      <div class="btnrow">
        <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button"><i class="ph ph-fast-forward" aria-hidden="true"></i>Dev: skip</button>
      </div>
    </div>
    ${q.step === 0 ? `
    <div class="onboard__hero">
      <div>
        <h1 lang="en">${L`Boba chat, not coffee chat.`}</h1>
        <p class="lead">${L`Meet the person before the résumé. A few quick questions, then you are in.`}</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </div>
    <p class="onboard__about"><a href="#/about">${L`New here? Read what Half Sugar is and what the boba words mean.`}</a></p>` : ''}
    <div class="progress" role="progressbar" aria-label="${esc(L`Setup progress`)}" aria-valuemin="1" aria-valuemax="${QUIZ_STEPS + 1}" aria-valuenow="${q.step + 1}"><span style="width:${((q.step + 1) / (QUIZ_STEPS + 1)) * 100}%"></span></div>
    <section class="quiz ${shown === q.step ? '' : 'enter'}">${quizStep(q)}</section>
    <div class="quiz__nav">
      ${q.step ? `<button class="btn btn--ghost" data-act="quiz-back" type="button"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`Back`}</button>` : '<span></span>'}
      ${q.step < QUIZ_STEPS ? `<button class="btn btn--primary" data-act="quiz-next" type="button" ${canNext ? '' : 'disabled'}>${L`Next`}</button>` : ''}
    </div>
  </main>`;
}

