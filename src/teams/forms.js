/* What happens when a form is sent. */
import { authMessage, currentUser, logIn, saveProfile, signUp } from '../shared/account.js?v=20261030g';
import { logError } from '../shared/log.js?v=20261030g';

import { $, later, pick, uid } from '../shared/core.js?v=20261030g';
import { isCold } from '../shared/sugar.js?v=20261030g';
import { S, U, save, saveMe } from './state.js?v=20261030g';
import { toast } from './ui.js?v=20261030g';
import { MAX_ROLES } from './options.js?v=20261030g';
import { COMP } from './competitions.js?v=20261030g';
import { go } from './router.js?v=20261030g';
import { DEFAULT_MAX, isFull } from './rules.js?v=20261030g';
import { chatById, push, reply, startChat } from './chats.js?v=20261030g';
import { render } from './render.js?v=20261030g';

// The profile as the form gives it
const meFrom = (d) => ({
  ...(S.me || {}), alias: d.alias, field: d.field, city: d.city, meet: d.meet, fun: d.fun,
  name: d.name, title: d.title, school: d.school, company: d.company, contactType: d.contactType, contact: d.contact,
  curious: String(d.curious || '').split(/[,，、]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
});

// The signed-in user, in the small shape the app keeps
export async function whoAmI() {
  const u = await currentUser();
  return u ? { id: u.id, email: u.email } : null;
}

export const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

export const forms = {
  async me(form, d) {
    if (!d.alias) { $('#me-error', form).hidden = false; return; }
    const first = !S.me;
    const me = meFrom(d);
    saveMe(me);
    if (U.user) {
      try { await saveProfile(me); } catch (err) { logError('profile', err); toast('Saved here, but not to your account. Try again later.'); }
    }
    U.needProfile = false;
    if (first) go('comps');
    else toast('Saved');
    render({ fresh: true });
  },
  async signup(form, d) {
    const local = form.dataset.local === '1';
    const me = local ? S.me : meFrom(d);
    const stop = (text) => { U.busy = false; U.authMsg = { text }; render(); };
    if (!me || !me.alias) return stop('Please add a nickname.');
    if (!/^\S+@\S+\.\S+$/.test(d.email || '')) return stop('That email does not look right.');
    if ((d.password || '').length < 8) return stop('Use a password with at least 8 characters.');
    U.busy = true; U.authMsg = null; render();
    try {
      const result = await signUp(d.email, d.password, me);
      U.busy = false;
      if (result.confirm) {
        U.auth = 'login';
        U.authMsg = { ok: true, text: 'Almost there: we sent you an email. Confirm it, then log in here.' };
        render({ fresh: true });
        return;
      }
      saveMe(me);
      U.user = await whoAmI();
      toast('Account created');
      go('comps');
      render({ fresh: true });
    } catch (err) {
      logError('signup', err);
      stop(authMessage(err));
    }
  },
  async login(form, d) {
    const stop = (text) => { U.busy = false; U.authMsg = { text }; render(); };
    if (!d.email || !d.password) return stop('Please enter your email and password.');
    U.busy = true; U.authMsg = null; render();
    try {
      const me = await logIn(d.email, d.password);
      U.busy = false;
      U.user = await whoAmI();
      if (me) {
        saveMe(me);
        go('comps');
      } else {
        U.needProfile = true;  // signed in, but no profile yet
        S.me = null;
      }
      render({ fresh: true });
    } catch (err) {
      logError('login', err);
      stop(authMessage(err));
    }
  },
  card(form, d) {
    const fd = new FormData(form);
    const cid = form.dataset.comp;
    const canDo = fd.getAll('canDo');
    if (!canDo.length || canDo.length > MAX_ROLES || (form.dataset.team && !d.team)) { $('#card-error', form).hidden = false; return; }
    S.cards[cid] = { canDo, topics: fd.getAll('topics'), goal: d.goal, hours: Number(d.hours) };
    if (COMP[cid]) S.compCache[cid] = COMP[cid];
    if (form.dataset.team) {
      S.teams.push({ id: uid(), comp: cid, name: d.team, pitch: d.pitch || '', members: ['me'], needs: fd.getAll('needs'), max: Number(d.max) || DEFAULT_MAX, code: uid(), msgs: [{ from: 'sys', text: 'Team created. Invite friends with the link, or find the rest in the competition.', at: Date.now() }] });
    }
    U.form = null;
    save();
    render({ fresh: true });
  },
  hi(form, d) {
    if (!d.hi) { $('#c-hi', form).focus(); return; }
    U.hi = null;
    startChat(form.dataset.comp, form.dataset.kind, form.dataset.ref, d.hi);
  },
  msg(form, d) {
    const c = chatById(form.dataset.id);
    if (!c || !d.msg || isCold(c)) return;
    push(c, 'me', d.msg);
    render({ fresh: true, focus: 'c-msg' });
    reply(c, 1300 + Math.random() * 1200);
  },
  teamedit(form, d) {
    const t = S.teams.find((x) => x.id === form.dataset.id);
    if (!t) return;
    t.pitch = d.pitch;
    t.max = Math.max(Number(d.max) || DEFAULT_MAX, t.members.length);
    if (!isFull(t)) t.needs = new FormData(form).getAll('needs');
    save();
    toast('Saved');
    render({ fresh: true });
  },
  teammsg(form, d) {
    const t = S.teams.find((x) => x.id === form.dataset.id);
    if (!t || !d.msg) return;
    t.msgs.push({ from: 'me', text: d.msg, at: Date.now() });
    save();
    render({ fresh: true, focus: 'c-msg' });
    const others = t.members.filter((m) => m !== 'me');
    if (!others.length) return;
    U.typing[t.id] = true;
    render();
    later(1500 + Math.random() * 1200, () => {
      U.typing[t.id] = false;
      t.msgs.push({ from: 'them', who: pick(others), text: pick(['On it. I will share a draft tonight.', 'Sounds good to me.', 'Can we do a quick call this week?', 'I added notes to our doc.']), at: Date.now() });
      save();
      render();
    });
  },
};
