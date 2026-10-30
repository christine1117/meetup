/* ---------- Screen: Drop ----------
   The schedule is a placeholder: every Friday 13:00 UTC, open for 10 minutes.
   Each chat also lasts 10 minutes, which is exactly half sugar (5% a minute). */

import { esc, later, uid } from '../../shared/core.js?v=20261030g';
import { L, LANG, tr } from '../../shared/i18n.js?v=20261030g';
import { fieldsLabel, fieldsOf } from '../../shared/flavors.js?v=20261030g';
import { cup } from '../../shared/cup.js?v=20261030g';
import { P, PEOPLE } from '../people.js?v=20261030g';
import { ANCHOR_OPENERS, anchorLabel, anchorOf, sameCity } from '../matching.js?v=20261030g';
import { D, S, save } from '../state.js?v=20261030g';
import { createThread } from '../conversations.js?v=20261030g';
import { earnBox } from '../toppings.js?v=20261030g';
import { render } from '../shell.js?v=20261030g';


export const DROP_WEEKDAY_UTC = 5;
export const DROP_HOUR_UTC = 13;
export const DROP_WINDOW_MS = 10 * 60 * 1000;
export const DROP_MINUTES = 10;
export const DROP_LENGTH_MS = DROP_MINUTES * 60 * 1000;

export function nextDrop(now) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DROP_HOUR_UTC));
  next.setUTCDate(next.getUTCDate() + ((DROP_WEEKDAY_UTC - next.getUTCDay() + 7) % 7));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}
export const dropIsOpen = (now) => now - (nextDrop(now) - 7 * 86400000) < DROP_WINDOW_MS;
export const pad = (n) => String(n).padStart(2, '0');
export const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

export function countdownText(now) {
  const s = Math.floor((nextDrop(now) - now) / 1000);
  return L`${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function bubbles(msgs, typing) {
  return msgs.map((m) => `<li class="msg msg--${m.from}">${esc(m.from === 'sys' ? tr(m.text, m.vars) : m.text)}</li>`).join('')
    + (typing ? `<li class="msg msg--them msg--typing" aria-label="${esc(L`They are typing`)}"><span></span><span></span><span></span></li>` : '');
}

export function viewDrop() {
  const now = new Date();
  const p = D.pid && P[D.pid];

  if (D.phase === 'matching') {
    return `
    <section class="drop-stage">
      <div class="swirl">${cup('var(--orange)', { level: 0.82, mark: '?', cls: 'cup--lg' })}</div>
      <div class="pearls" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>${L`Shaking your mystery cup`}</h1>
      <p class="sub">${L`Different field, different city, one thing in common.`}</p>
    </section>`;
  }

  if (D.phase === 'live') {
    // The chat flips open right after a match (the first redraws happen within this window)
    const flip = Date.now() < D.flipUntil;
    return `
    <section class="chat">
      <header class="chat__head ${flip ? 'flip-in' : ''}">
        <div>
          <h1>${L`Someone in ${esc(p.country)}`}</h1>
          <p class="sub">${L`Field: ${esc(fieldsLabel(p))}. That is all you know.`}</p>
          ${D.anchor ? `<p class="anchor"><i class="ph ph-anchor-simple" aria-hidden="true"></i>${esc(anchorLabel(D.anchor))}</p>` : ''}
        </div>
        <div class="chat__tools">
          <span class="timer" id="drop-timer" role="timer">${clock(D.ends - Date.now())}</span>
          <button class="btn btn--ghost btn--sm" data-act="drop-end" type="button">${L`End chat`}</button>
        </div>
      </header>
      <ul class="log" id="log">${bubbles(D.msgs, D.typing)}</ul>
      <form class="composer" data-form="drop-msg">
        <label class="sr" for="c-msg">${L`Message`}</label>
        <input id="c-msg" name="msg" autocomplete="off" placeholder="${esc(L`Say something`)}">
        <button class="btn btn--dark" type="submit" aria-label="${esc(L`Send`)}"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
      </form>
    </section>`;
  }

  if (D.phase === 'decide' || D.phase === 'waiting') {
    return `
    <section class="drop-stage">
      <h1>${L`Cup's empty. Want a refill?`}</h1>
      <p class="sub">${L`Both choose Refill to keep talking and see who you met. Otherwise, this cup disappears.`}</p>
      ${D.phase === 'waiting'
        ? `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`Waiting for them to decide`}</p>`
        : `<div class="btnrow btnrow--center">
            <button class="btn btn--primary" data-act="drop-yes" type="button">${L`Refill`}</button>
            <button class="btn btn--ghost" data-act="drop-no" type="button">${L`I'm good`}</button>
          </div>`}
    </section>`;
  }

  if (D.phase === 'result') {
    const t = D.result === 'match' && S.threads.find((x) => x.origin === 'drop' && x.pid === D.pid);
    return `
    <section class="drop-stage">
      ${t ? `
        <h1>${L`You both want a refill.`}</h1>
        <p class="sub">${L`You were talking to ${esc(p.real.name)}, ${esc(p.real.title)}.`}</p>
        <div class="btnrow btnrow--center">
          <a class="btn btn--primary" href="#/chats/${t.id}">${L`Refill`}</a>
          <button class="btn btn--ghost" data-act="drop-reset" type="button">${L`Back to Mystery Cup`}</button>
        </div>` : `
        <h1>${L`This cup is gone.`}</h1>
        <p class="sub">${D.result === 'passed' ? L`You chose not to refill.` : L`They passed on a refill this time. Say a bit more next time and your odds go up.`}</p>
        <div class="btnrow btnrow--center">
          <button class="btn btn--primary" data-act="drop-reset" type="button">${L`Back to Mystery Cup`}</button>
        </div>`}
    </section>`;
  }

  const open = dropIsOpen(now);
  const localTime = nextDrop(now).toLocaleString(LANG === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return `
  <header class="head">
    <div><h1 lang="en">${L`Mystery Cup`}</h1><p class="sub" lang="en">${L`You can’t pick the flavor.`}</p></div>
  </header>
  <section class="drop-card">
    ${cup('var(--milk)', { level: 0.82, mark: '?', cls: 'cup--mystery' })}
    <div>
      ${open
        ? `<p class="drop-card__label">${L`Mystery Cup is open`}</p><p class="drop-card__time">${L`Join now`}</p>`
        : `<p class="drop-card__label">${L`Next Mystery Cup in`}</p><p class="drop-card__time" id="drop-count" role="timer">${countdownText(now)}</p>`}
      <p class="drop-card__when">${L`${esc(localTime)}, open ${DROP_MINUTES} minutes`}</p>
      <button class="btn btn--dark" data-act="drop-join" type="button">${open ? L`Pour me one` : L`Try a practice cup`}</button>
    </div>
  </section>
  <ul class="rule-pills">
    <li><i class="ph ph-shuffle" aria-hidden="true"></i>${L`One thing in common`}</li>
    <li><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`${DROP_MINUTES} minutes`}</li>
    <li><i class="ph ph-handshake" aria-hidden="true"></i>${L`Both refill to reveal`}</li>
  </ul>
  ${S.drops ? `<p class="meta">${S.drops === 1 ? L`You have had 1 mystery cup.` : L`You have had ${S.drops} mystery cups.`}</p>` : ''}`;
}

export function dropStart() {
  const me = S.me;
  const met = new Set(S.threads.map((t) => t.pid));
  // One thing in common (the anchor), everything else as different as possible.
  // The anchor outweighs the rest; a little luck keeps it a surprise.
  const score = (x) => ((anchorOf(x) || {}).weight || 0)
    + (fieldsOf(x).some((f) => fieldsOf(me).includes(f)) ? 0 : 3)
    + (sameCity(x.city, me.city) ? 0 : 2)
    + (x.stage !== me.stage ? 1 : 0)
    + Math.random();
  const pool = PEOPLE.filter((x) => !met.has(x.id));
  const p = [...(pool.length ? pool : PEOPLE)].sort((a, b) => score(b) - score(a))[0];
  const anchor = anchorOf(p);
  Object.assign(D, { phase: 'live', flipUntil: Date.now() + 700, pid: p.id, anchor, li: 0, typing: false, result: null, ends: Date.now() + DROP_LENGTH_MS });
  D.msgs = [anchor
    ? { from: 'sys', text: ANCHOR_OPENERS[anchor.kind], vars: [anchor.a, anchor.b] }
    : { from: 'sys', text: 'Your first sip lasts 10 minutes. Start by asking what they are busy with.' }];
  render({ fresh: true, focus: 'c-msg' });
  dropReply(1600);
}

export function dropReply(delay) {
  const pid = D.pid;
  D.typing = true;
  render();
  later(delay, () => {
    if (D.phase !== 'live' || D.pid !== pid) return;
    const p = P[pid];
    const opener = `Hi. Here is what I'm working on: ${p.doing.charAt(0).toLowerCase()}${p.doing.slice(1)}. What about you?`;
    D.msgs.push({ from: 'them', at: Date.now(), text: D.li === 0 ? opener : p.lines[(D.li - 1) % p.lines.length] });
    D.li += 1;
    D.typing = false;
    render();
  });
}

export function dropEnd() {
  if (D.phase !== 'live') return;
  D.phase = 'decide';
  D.typing = false;
  S.drops += 1;
  save();
  render({ fresh: true });
}

export function dropDecide() {
  D.phase = 'waiting';
  render();
  later(2200, () => {
    if (D.phase !== 'waiting') return;
    const mine = D.msgs.filter((m) => m.from === 'me').length;
    if (mine >= 2) {
      const t = createThread(D.pid, 'drop', uid(), 'open', 'You met over a Mystery Cup and both chose a refill. The seal is popped.');
      t.msgs.push(...D.msgs.filter((m) => m.from !== 'sys').map((m) => ({ ...m, at: m.at || Date.now() })));
      t.li = Math.max(0, D.li - 1);
      t.reveal = { me: true, them: true };
      t.rewards = { half: true };
      save();
      D.result = 'match';
      earnBox('small', 'For a mutual refill with {0}.', [P[t.pid].alias]);
    } else {
      D.result = 'declined';
    }
    D.phase = 'result';
    render();
  });
}
