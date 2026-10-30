/* ---------- Shell ---------- */

import { $, esc } from '../shared/core.js?v=20261030e';
import { logError } from '../shared/log.js?v=20261030e';
import { L, LANG } from '../shared/i18n.js?v=20261030e';
import { LOGO } from '../shared/flavors.js?v=20261030e';
import { D, S, U } from './state.js?v=20261030e';
import { parseRoute } from './router.js?v=20261030e';
import { app } from './ui.js?v=20261030e';
import { thread } from './conversations.js?v=20261030e';
import { viewOnboard } from './screens/onboarding.js?v=20261030e';
import { viewExplore, viewPost } from './screens/explore.js?v=20261030e';
import { viewBuild } from './screens/brew.js?v=20261030e';
import { viewDrop } from './screens/mystery.js?v=20261030e';
import { viewChats, viewThread } from './screens/chats.js?v=20261030e';
import { viewAbout } from './screens/about.js?v=20261030e';
import { viewMe } from './screens/me.js?v=20261030e';


export const NAV = [
  ['explore', 'Explore', 'ph-compass', 'Topics and posts'],
  ['build', 'Brew', 'ph-hammer', 'Build together'],
  ['drop', 'Mystery Cup', 'ph-sparkle', 'Weekly surprise match'],
  ['chats', 'Chats', 'ph-chat-circle', 'Your conversations'],
  ['me', 'Me', 'ph-user', 'Your profile'],
];

export function shell(route, body) {
  const unread = S.threads.reduce((n, t) => n + t.unread, 0);
  const isChat = (route.name === 'chats' && thread(route.id)) || (route.name === 'drop' && D.phase === 'live');
  return `
  <div class="app">
    <aside class="side">
      <a class="logo" href="#/explore" aria-label="${esc(L`Half Sugar home`)}">${LOGO}</a>
      <nav class="nav" aria-label="${esc(L`Main`)}">
        ${NAV.map(([name, label, icon, desc]) => `
        <a href="#/${name}" ${route.name === name || (name === 'explore' && route.name === 'post') ? 'aria-current="page"' : ''}>
          <i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span ${name === 'chats' ? '' : 'lang="en"'}>${L(label)}</span></span>
          ${name === 'chats' && unread ? `<span class="badge" aria-label="${esc(L`${unread} unread`)}">${unread}</span>` : ''}
          ${name === 'me' && (S.boxes || []).length ? `<span class="badge" aria-label="${esc(L`${S.boxes.length} gift boxes`)}">${S.boxes.length}</span>` : ''}
        </a>`).join('')}
      </nav>
      <div class="side__foot">
        <a class="side__about" href="#/about" ${route.name === 'about' ? 'aria-current="page"' : ''}><i class="ph ph-info" aria-hidden="true"></i>${L`What is Half Sugar?`}</a>
      </div>
    </aside>
    <main class="main ${isChat ? 'main--chat' : ''}" id="main">${body}</main>
  </div>`;
}

// Draw the page. If something breaks (often old saved data), show a way out instead of a blank screen.
export function render(opt = {}) {
  try {
    // Keep the topping row where it was scrolled to when the page is redrawn
    const strip = $('.pick-strip', app);
    const stripX = strip ? strip.scrollLeft : 0;
    draw(opt);
    const after = $('.pick-strip', app);
    if (after && stripX) after.scrollLeft = stripX;
  } catch (err) {
    logError('render', err);
    app.innerHTML = `
    <main class="onboard">
      <p class="logo">${LOGO}</p>
      <h1>${L`Something went wrong.`}</h1>
      <p class="lead">${L`Your saved data may come from an older version. Clearing it usually fixes this.`}</p>
      <p class="hint">${esc(err && err.message)}</p>
      <button class="btn btn--primary" data-act="reset-yes" type="button">${L`Clear data and restart`}</button>
    </main>`;
  }
}

export function draw(opt = {}) {
  const route = parseRoute();
  const path = location.hash;
  const same = path === U.lastPath && !opt.fresh;
  const activeId = document.activeElement && document.activeElement.id;
  const keep = {};
  if (same) app.querySelectorAll('[id^="f-"], [id^="c-"]').forEach((el) => { keep[el.id] = el.value; });
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hant' : 'en';

  if (!S.me) {
    app.innerHTML = route.name === 'about' ? `<main class="about-page">${viewAbout()}</main>` : viewOnboard();
  } else {
    let body;
    if (route.name === 'chats' && route.id) {
      const t = thread(route.id);
      if (t) { t.unread = 0; body = viewThread(t); } else { body = viewChats(); }
    } else if (route.name === 'chats') body = viewChats();
    else if (route.name === 'build') body = viewBuild();
    else if (route.name === 'drop') body = viewDrop();
    else if (route.name === 'me') body = viewMe();
    else if (route.name === 'about') body = viewAbout();
    else if (route.name === 'post') body = viewPost(route.id);
    else body = viewExplore();
    app.innerHTML = shell(route, body);
    // Content rises in when you arrive on a page, not on every update
    if (path !== U.lastPath) $('.main', app).classList.add('enter');
  }

  Object.entries(keep).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
  const focusId = opt.focus || (path === U.lastPath ? activeId : null);
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
  if (path !== U.lastPath) window.scrollTo(0, 0);
  U.lastPath = path;
}
