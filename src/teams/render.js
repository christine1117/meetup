/* Layout and drawing: the side nav, and render(), which draws the
   current route and shows a way out if something breaks. */

import { esc } from '../shared/core.js?v=20261030e';
import { LOGO } from '../shared/flavors.js?v=20261030e';
import { logError } from '../shared/log.js?v=20261030e';
import { S, U } from './state.js?v=20261030e';
import { app } from './ui.js?v=20261030e';
import { route } from './router.js?v=20261030e';
import { chatById } from './chats.js?v=20261030e';
import { viewMe, viewOnboard } from './views/profile.js?v=20261030e';
import { viewComp, viewComps } from './views/competitions.js?v=20261030e';
import { viewChat, viewChats } from './views/chats.js?v=20261030e';
import { viewTeam } from './views/team.js?v=20261030e';

export const NAV = [['comps', 'Competitions', 'ph-trophy'], ['chats', 'Teams & chats', 'ph-chats-circle'], ['me', 'Me', 'ph-user']];

export function shell(r, body) {
  const here = { comp: 'comps', chat: 'chats', team: 'chats' }[r.name] || r.name;
  const full = r.name === 'chat' || r.name === 'team';
  return `
  <div class="app">
    <aside class="side">
      <a class="logo" href="#/comps">${LOGO}<span class="logo__sub">Teams</span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([n, label, icon]) => `<a href="#/${n}" ${here === n ? 'aria-current="page"' : ''}><i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span>${label}</span></span></a>`).join('')}</nav>
    </aside>
    <main class="main ${full ? 'main--chat' : ''} ${location.hash !== U.lastPath ? 'enter' : ''}" id="main">${body}</main>
  </div>`;
}

export function render(opt = {}) {
  try {
    const r = route();
    const path = location.hash;
    const keep = {};
    if (path === U.lastPath && !opt.fresh) app.querySelectorAll('[id^="c-"], [id^="f-"]').forEach((el) => { keep[el.id] = el.value; });
    const focusId = opt.focus || (path === U.lastPath && document.activeElement ? document.activeElement.id : null);
    if (!S.me) {
      app.innerHTML = viewOnboard();
    } else {
      let body;
      if (r.name === 'comp') body = viewComp(r.id);
      else if (r.name === 'chats') body = viewChats();
      else if (r.name === 'chat') body = chatById(r.id) ? viewChat(chatById(r.id)) : viewChats();
      else if (r.name === 'team') { const t = S.teams.find((x) => x.id === r.id); body = t ? viewTeam(t) : viewChats(); }
      else if (r.name === 'me') body = viewMe();
      else body = viewComps();
      app.innerHTML = shell(r, body);
    }
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; });
    if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
    const log = document.getElementById('log');
    if (log) log.scrollTop = log.scrollHeight;
    if (path !== U.lastPath) window.scrollTo(0, 0);
    U.lastPath = path;
  } catch (err) {
    logError('render', err);
    app.innerHTML = `<main class="onboard"><h1>Something went wrong.</h1><p class="hint">${esc(err.message)}</p><button class="btn btn--primary" data-act="reset-yes" type="button">Clear data and restart</button></main>`;
  }
}
