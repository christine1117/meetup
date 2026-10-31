/* =========================================================
   Interface language: English or Traditional Chinese.
   Write interface text in English as L`...` (or L('...')).
   Values inside ${...} become {0}, {1}... in the key, and the
   Chinese line below can place them anywhere.
   A key with no Chinese line stays in English. Slogans and product
   terms are left out on purpose so they always show in English.
   Chinese voice: short and tidy brand copy with a light, playful
   touch. Not chatty, not a manual.
   ========================================================= */

import ZH from './locales/zh.js?v=20261031v';

const LANG_KEY = 'halfsugar.lang';

// Both languages are on. People pick with the EN / 中文 switch; the first visit follows the browser.
const ZH_ENABLED = true;

export let LANG = (() => {
  if (!ZH_ENABLED) return 'en';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* Storage is unavailable. Use the browser language. */
  }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();

export function setLang(lang) {
  LANG = lang === 'zh' ? 'zh' : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = LANG === 'zh' ? 'zh-Hant' : 'en';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* The choice just will not be remembered next visit. */
  }
}

export function tr(key, vals = []) {
  const tpl = (LANG === 'zh' && ZH[key]) || key;
  return String(tpl).replace(/\{(\d+)\}/g, (_, i) => vals[i] ?? '');
}

export function L(strings, ...vals) {
  if (typeof strings === 'string') return tr(strings);
  const key = strings.reduce((out, s, i) => out + (i ? `{${i - 1}}` : '') + s, '');
  return tr(key, vals);
}

// The EN / 中文 switch. Buttons carry data-act="lang"; each app sets the language and redraws.
export const langSwitch = () => `<div class="lang-switch" role="group" aria-label="Language">${[['en', 'EN'], ['zh', '中文']].map(([v, l]) => `<button class="lang-switch__btn ${LANG === v ? 'is-on' : ''}" data-act="lang" data-value="${v}" type="button" aria-pressed="${LANG === v}" lang="${v === 'zh' ? 'zh-Hant' : 'en'}">${l}</button>`).join('')}</div>`;

// Slogans that stay in English (no Chinese line on purpose):
// Boba chat, not coffee chat. / Meet the person before the résumé. /
// Conversation before credentials. / I want to meet someone. /
// I need someone for something. / You can’t pick the flavor.
// Product terms also stay in English: Explore, Brew, Mystery Cup, Me,
// First Sip, Pop the seal, Refill, Boba run, Gone cold.

// Chinese lines live in ./locales/zh.js
