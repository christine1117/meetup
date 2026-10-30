/* ---------- Screen: About ---------- */

import { esc } from '../../shared/core.js?v=20261030e';
import { L } from '../../shared/i18n.js?v=20261030e';
import { FIELDS, LOGO, fieldName, flavor, flavorName } from '../../shared/flavors.js?v=20261030e';
import { cup } from '../../shared/cup.js?v=20261030e';
import { CLOSE_AFTER_DAYS } from '../../shared/sugar.js?v=20261030e';
import { S } from '../state.js?v=20261030e';
import { TIER_HOW, TIER_NAME, TOPPINGS, toppingChip } from '../toppings.js?v=20261030e';


// Small grey line that explains a boba word in plain language
export const explain = (html) => `<p class="explain"><i class="ph ph-info" aria-hidden="true"></i><span>${html}</span></p>`;

export const GLOSSARY = [
  ['Me', 'ph-user', 'Your profile and your usual drink. It shows your flavor and what you are curious about, never your titles.'],
  ['Flavor', 'ph-drop', 'Your field. Each field is a boba flavor and sets the colour of your cup. Two fields make a two-flavor cup.'],
  ['Sugar', 'ph-chart-line-up', 'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.'],
  ['Explore', 'ph-compass', 'A forum by topic. Comment in public, or message someone privately. Top picks come first.'],
  ['Brew', 'ph-hammer', 'Build something together. Post what you need and it goes to the people who fit, or apply to a Brew without showing your titles.'],
  ['Mystery Cup', 'ph-sparkle', 'A surprise match once a week: a different field and background, with one thing in common. You cannot pick who you get.'],
  ['First Sip', 'ph-chat-circle', 'Your first conversation with someone. Real names are still hidden.'],
  ['Pop the seal', 'ph-lock-simple-open', 'Show your real name, school, company and title. It only happens when both of you press it.'],
  ['Refill', 'ph-arrows-clockwise', 'At the end of a Mystery Cup, you both choose Refill to keep talking.'],
  ['Gone cold', 'ph-snowflake', 'A chat closes if nobody replies for 3 days.'],
  ['Toppings', 'ph-gift', 'Rewards for your cup. Each milestone earns a gift box: half sugar, a mutual refill, or a boba run where you both show up. Some toppings are secret.'],
  ['Boba run', 'ph-person-simple-walk', 'Meet in person, at a boba shop or a café.'],
];

export function viewAbout() {
  const next = S.me
    ? `<a class="btn btn--primary" href="#/explore">${L`Back to Explore`}</a>`
    : `<a class="btn btn--primary" href="#/">${L`Start sipping`}</a>`;
  return `
  <article class="about">
    ${S.me ? '' : `<div class="onboard__top"><p class="logo">${LOGO}</p></div>`}
    <header class="about__hero">
      <div>
        <h1 lang="en">${L`Boba chat, not coffee chat.`}</h1>
        <p class="lead">${L`Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.`}</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </header>

    <section class="about__block">
      <h2>${L`Why we built it`}</h2>
      <p>${L`Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.`}</p>
    </section>

    <section class="about__pair">
      <div class="about__card">
        <h2>${L`Why boba`}</h2>
        <p>${L`A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.`}</p>
      </div>
      <div class="about__card about__card--sugar">
        <h2>${L`Why half sugar`}</h2>
        <p>${L`Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.`}</p>
      </div>
    </section>

    <section class="about__block">
      <h2>${L`How it works`}</h2>
      <ol class="steps">
        <li><strong>${L`Set up Me.`}</strong> ${L`Pick your flavor and what you are curious about. Your name, titles and contact stay sealed.`}</li>
        <li><strong>${L`Take a first sip.`}</strong> ${L`Comment or message someone in Explore, apply to a Brew, or join the weekly Mystery Cup.`}</li>
        <li><strong>${L`Reach half sugar, then pop the seal.`}</strong> ${L`Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.`}</li>
        <li><strong>${L`Keep it warm.`}</strong> ${L`Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.`}</li>
      </ol>
    </section>

    <section class="about__cold">
      <i class="ph ph-snowflake" aria-hidden="true"></i>
      <div>
        <h2>${L`Why chats go cold`}</h2>
        <p>${L`If nobody replies for ${CLOSE_AFTER_DAYS} days, the chat closes. We do this on purpose.`}</p>
        <p>${L`On most networking apps, people match and then disappear, or agree to meet and never show up. Here, every chat is a small chance that will not wait forever. So reply while it is warm, and show up when you say you will.`}</p>
        <p class="about__hint">${L`Each chat shows how much time is left, so nothing closes by surprise.`}</p>
      </div>
    </section>

    <section class="about__block">
      <h2>${L`The menu`}</h2>
      <p class="about__hint">${L`What our boba words mean.`}</p>
      <dl class="glossary">
        ${GLOSSARY.map(([term, icon, text]) => `<div><dt><i class="ph ${icon}" aria-hidden="true"></i>${L(term)}</dt><dd>${L(text)}</dd></div>`).join('')}
      </dl>
      <h3 class="flavors__title">${L`Flavors`}</h3>
      <ul class="flavors">
        ${FIELDS.map((f) => `<li><span class="flavor" style="--flavor:${flavor(f)[1]}">${esc(flavorName(f))}</span>${esc(fieldName(f))}</li>`).join('')}
      </ul>
      <h3 class="flavors__title">${L`Toppings`}</h3>
      ${['small'].map((tier) => `
      <div class="about-tops">
        <p class="collection__how"><span class="tier-tag tier-tag--${tier}">${L(TIER_NAME[tier])}</span>${L(TIER_HOW[tier])}</p>
        <div class="pf__toppings">${TOPPINGS.filter((x) => x.tier === tier).map((x) => toppingChip(x.id)).join('')}</div>
      </div>`).join('')}
      <p class="about-tops collection__how"><span class="tier-tag tier-tag--secret">${L`Secret toppings`}</span>${L`A few rare ones hide in gift boxes. Keep sipping to find them.`}</p>
    </section>

    <section class="about__belief">
      <p lang="en">${L`Conversation before credentials.`}</p>
      <p lang="en">${L`Meet the person before the résumé.`}</p>
      <p class="accent" lang="en">Meet. Think. Build.</p>
      <div class="btnrow btnrow--center">${next}</div>
    </section>
  </article>`;
}
