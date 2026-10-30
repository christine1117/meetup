/* What each button does (buttons carry data-act="name"). */
import { logOut } from '../shared/account.js?v=20261030g';
import { clearProfile } from '../shared/profile.js?v=20261030g';

import { later, pick } from '../shared/core.js?v=20261030g';
import { REVEAL_AT, sugarOf } from '../shared/sugar.js?v=20261030g';
import { KEY, S, U, save, saveMe } from './state.js?v=20261030g';
import { toast } from './ui.js?v=20261030g';
import { DAY } from './competitions.js?v=20261030g';
import { FRIENDS } from './sample-people.js?v=20261030g';
import { go } from './router.js?v=20261030g';
import { PASS_TEXT, isFull, needsOf, voters } from './rules.js?v=20261030g';
import { chatById, endChat, formTeam, push, tooBig } from './chats.js?v=20261030g';
import { closeModal, renderModal } from './views/modal.js?v=20261030g';
import { PAGE } from './views/competitions.js?v=20261030g';
import { render } from './render.js?v=20261030g';

export const acts = {
  form(el) { U.form = el.dataset.what || null; render({ fresh: true }); },
  region(el) { U.region = el.dataset.value; U.shown = PAGE; render(); },
  more() { U.shown = (U.shown || PAGE) + PAGE; render(); },
  open(el) {
    U.hi = null;
    U.modal = { kind: el.dataset.kind, ref: el.dataset.ref, comp: el.dataset.comp };
    renderModal();
  },
  'modal-close'() { closeModal(); },
  hi(el) { U.hi = el.dataset.key || null; render({ fresh: true, focus: U.hi ? 'c-hi' : null }); },
  teamup(el) {
    const c = chatById(el.dataset.id);
    if (!c || c.votes.me || c.status !== 'open' || sugarOf(c) < REVEAL_AT) return;
    if (tooBig(c)) { toast('This team is full'); return; }
    c.votes.me = true;
    c.msgs.push({ from: 'sys', text: 'You said yes. Waiting for everyone else.', at: Date.now() });
    save();
    render();
    // Demo: the others say yes one by one, as long as you have really talked
    const others = voters(c).filter((v) => v !== 'me' && !c.votes[v]);
    const talked = c.msgs.filter((m) => m.from === 'me').length >= 2;
    if (!talked) {
      later(1800, () => {
        if (c.status !== 'open' || c.teamed) return;
        c.votes = {};
        push(c, 'them', 'Let us talk a little more first.', others[0]);
        render();
      });
      return;
    }
    others.forEach((v, i) => later(1400 * (i + 1), () => {
      if (c.status !== 'open' || c.teamed || tooBig(c)) return;
      c.votes[v] = true;
      save();
      if (voters(c).every((x) => c.votes[x])) formTeam(c);
      else render();
    }));
  },
  leave(el) { U.leave = el.dataset.id || null; render(); },
  'leave-send'(el) {
    const c = chatById(el.dataset.id);
    if (!c || c.status !== 'open') return;
    U.leave = null;
    endChat(c, PASS_TEXT);
    save();
    render({ fresh: true });
  },
  // Demo: see what it looks like when the other side passes
  'dev-pass'(el) {
    const c = chatById(el.dataset.id);
    if (!c || c.status !== 'open') return;
    const who = c.kind === 'team' ? pick(voters(c).filter((v) => v !== 'me')) : c.ref;
    c.msgs.push({ from: 'them', who, text: PASS_TEXT, at: Date.now() });
    endChat(c);
    save();
    render({ fresh: true });
  },
  call(el) {
    window.open(`https://meet.jit.si/HalfSugarTeams-${el.dataset.id}`, '_blank', 'noopener');
    toast('Video room opened in a new tab');
  },
  copy(el) {
    const done = () => toast('Invite link copied');
    try { navigator.clipboard.writeText(el.dataset.link).then(done, done); } catch { done(); }
  },
  'dev-friend'(el) {
    const t = S.teams.find((x) => x.id === el.dataset.id);
    if (isFull(t)) { toast('The team is full'); return; }
    const f = FRIENDS.find((x) => !t.members.includes(x.id) && !S.teams.some((y) => y.comp === t.comp && y.members.includes(x.id)));
    if (!f) { toast('No more demo friends'); return; }
    t.members.push(f.id);
    t.needs = needsOf(t).filter((r) => !f.canDo.includes(r));
    t.msgs.push({ from: 'sys', text: `${f.real.name} joined with your invite link.`, at: Date.now() });
    // A full team stops talking to newcomers
    if (isFull(t)) S.chats.filter((x) => x.comp === t.comp && x.kind === 'person' && x.status === 'open' && !x.teamed).forEach((x) => endChat(x, 'The team is full now, so this chat ended.', false));
    save();
    render();
  },
  'dev-time'(el) { const c = chatById(el.dataset.id); const before = sugarOf(c); c.devMin = (c.devMin || 0) + 5; if (before < REVEAL_AT && sugarOf(c) >= REVEAL_AT) c.msgs.push({ from: 'sys', text: 'Half sugar! You can team up now.', at: Date.now() }); save(); render(); },
  'dev-days'(el) { const c = chatById(el.dataset.id); c.msgs.forEach((m) => { m.at -= 3 * DAY + 60000; }); c.at -= 3 * DAY + 60000; save(); render(); },
  'auth-mode'(el) { U.auth = el.dataset.mode; U.authMsg = null; render({ fresh: true }); },
  async logout() {
    await logOut();
    clearProfile();
    U.user = null;
    S.me = null;
    save();
    U.auth = 'login';
    U.authMsg = { ok: true, text: 'You are logged out.' };
    go('comps');
    render({ fresh: true });
  },
  'dev-skip'() {
    saveMe({ alias: 'Dev', field: 'Engineering', city: 'Taipei', meet: 'both', curious: ['Climate tech'], fun: 'Has tried every boba shop on one street', name: 'Dev User', title: 'Builder', school: 'Half Sugar U', company: '', contactType: 'instagram', contact: '@devuser' });
    go('comps');
    render({ fresh: true });
  },
  reset() { U.confirmReset = true; render(); },
  'reset-no'() { U.confirmReset = false; render(); },
  // Clears teams, cards and chats. Your profile stays, since Half Sugar uses it too.
  'reset-yes'() { try { localStorage.removeItem(KEY); } catch { /* nothing */ } location.hash = ''; location.reload(); },
};
