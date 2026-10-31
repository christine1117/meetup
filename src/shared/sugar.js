/* Sugar and cold chats: the rules every chat follows, in both apps.
   Pure functions of a chat's messages, so they are easy to test. */

import { esc } from './core.js?v=20261031m';
import { L } from './i18n.js?v=20261031m';
import { cup } from './cup.js?v=20261031m';

// Sugar = how long two people have talked. Every minute adds 5%, so 10 minutes is half sugar.
// A long pause only counts as 3 minutes, so a chat left open in silence does not keep filling.
// At 50% (half sugar) you can pop the seal. At 100% (full sugar) we suggest a boba run.
export const SUGAR_PER_MIN = 5;
export const PAUSE_CAP_MIN = 3;
export const REVEAL_AT = 50;
export function talkMinutes(t) {
  const real = t.msgs.filter((m) => m.from !== 'sys' && m.at);
  let ms = 0;
  if (real.some((m) => m.from === 'me') && real.some((m) => m.from === 'them')) {
    for (let i = 1; i < real.length; i += 1) ms += Math.min(real[i].at - real[i - 1].at, PAUSE_CAP_MIN * 60000);
  }
  return ms / 60000 + (t.devMin || 0);
}
export const sugarOf = (t) => Math.min(100, Math.floor(talkMinutes(t) * SUGAR_PER_MIN));
export const sugarMeter = (v) => `<span class="sugar" title="${esc(L('Sugar goes up the longer you talk. Every minute adds 5%.'))}">${cup('var(--milk)', { level: v / 100, cls: 'cup--chip' })}${L`${v}% sugar`}</span>`;

// A chat closes ("goes cold") when nobody has replied for this many days
export const CLOSE_AFTER_DAYS = 3;
export const lastActive = (t) => { const real = t.msgs.filter((m) => m.from !== 'sys'); return (real[real.length - 1] || {}).at || t.at; };
export const closesIn = (t) => CLOSE_AFTER_DAYS * 86400000 - (Date.now() - lastActive(t));
export const isCold = (t) => t.status === 'open' && closesIn(t) <= 0;
export const closesText = (t) => {
  const ms = closesIn(t);
  return ms > 86400000
    ? L`Closes in ${Math.ceil(ms / 86400000)}d without a reply`
    : L`Closes in ${Math.max(1, Math.ceil(ms / 3600000))}h without a reply`;
};
