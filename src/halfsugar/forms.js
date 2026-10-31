/* ---------- Forms ---------- */

import { authMessage, currentUser, logIn, saveProfile, signUp } from '../shared/account.js?v=20261031a';
import { logError } from '../shared/log.js?v=20261031a';
import { $, later, uid } from '../shared/core.js?v=20261031a';
import { L } from '../shared/i18n.js?v=20261031a';
import { isCold, sugarOf } from '../shared/sugar.js?v=20261031a';
import { P, SEED_POSTS, hasEvent } from './people.js?v=20261031a';
import { brewMatches } from './matching.js?v=20261031a';
import { D, S, U, save } from './state.js?v=20261031a';
import { go } from './router.js?v=20261031a';
import { toast } from './ui.js?v=20261031a';
import { createThread, pushMsg, scheduleAccept, sugarNotes, themReply, thread } from './conversations.js?v=20261031a';
import { scheduleIncoming } from './simulate.js?v=20261031a';
import { renderModal } from './modal.js?v=20261031a';
import { postById } from './screens/explore.js?v=20261031a';
import { syncRoleDescs } from './screens/brew.js?v=20261031a';
import { dropReply } from './screens/mystery.js?v=20261031a';
import { render } from './shell.js?v=20261031a';


// The signed-in user, in the small shape the app keeps
export async function signedIn() {
  const u = await currentUser();
  return u ? { id: u.id, email: u.email } : null;
}

export const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

export const forms = {
  async profile(form, data) {
    if (!data.alias) { $('#profile-error', form).hidden = false; return; }
    const first = !S.me;
    const { email, password } = data;
    delete data.email;
    delete data.password;
    if (first) {
      const q = U.quiz;
      Object.assign(data, { field: q.field, field2: q.field2, curious: q.curious, meet: q.meet, city: q.city });
    } else if (data.field2 === data.field) {
      data.field2 = '';
    }
    // Keep what the form does not hold, like your tags
    const me = first ? data : { ...S.me, ...data };
    const stop = (text) => { U.busy = false; U.authMsg = { text }; render(); };

    if (first && !U.user) {
      // A new account, with this profile
      if (!/^\S+@\S+\.\S+$/.test(email || '')) return stop(L`That email does not look right.`);
      if ((password || '').length < 8) return stop(L`Use a password with at least 8 characters.`);
      U.busy = true; U.authMsg = null; render();
      try {
        const result = await signUp(email, password, me);
        U.busy = false;
        if (result.confirm) {
          U.authView = 'login';
          U.authMsg = { ok: true, text: L`Almost there: we sent you an email. Confirm it, then log in here.` };
          render({ fresh: true });
          return;
        }
        U.user = await signedIn();
      } catch (err) {
        logError('signup', err);
        return stop(L(authMessage(err)));
      }
    } else if (U.user) {
      try { await saveProfile(me); } catch (err) { logError('profile', err); toast(L`Saved here, but not to your account. Try again later.`); }
    }
    S.me = me;
    save();
    U.authMsg = null;
    if (first) { U.lastPath = null; go('explore'); render({ fresh: true }); } else { U.openSec = {}; toast(L`Saved`); render({ fresh: true }); }
  },

  // Log in (from the start screen or from Me)
  async login(form, data) {
    const stop = (text) => { U.busy = false; U.authMsg = { text }; render(); };
    if (!data.email || !data.password) return stop(L`Please enter your email and password.`);
    U.busy = true; U.authMsg = null; render();
    try {
      const me = await logIn(data.email, data.password);
      U.busy = false;
      U.user = await signedIn();
      U.authView = null;
      if (me) {
        S.me = { ...(S.me || {}), ...me };
        save();
        U.lastPath = null;
        go('explore');
      } else {
        U.authMsg = { ok: true, text: L`You are signed in. Answer a few questions to set up your profile.` };
      }
      render({ fresh: true });
    } catch (err) {
      logError('login', err);
      stop(L(authMessage(err)));
    }
  },

  // Make an account for the profile already in this browser (from Me)
  async signup(form, data) {
    const stop = (text) => { U.busy = false; U.authMsg = { text }; render(); };
    if (!/^\S+@\S+\.\S+$/.test(data.email || '')) return stop(L`That email does not look right.`);
    if ((data.password || '').length < 8) return stop(L`Use a password with at least 8 characters.`);
    U.busy = true; U.authMsg = null; render();
    try {
      const result = await signUp(data.email, data.password, S.me);
      U.busy = false;
      if (result.confirm) {
        U.authView = 'login';
        U.authMsg = { ok: true, text: L`Almost there: we sent you an email. Confirm it, then log in here.` };
      } else {
        U.user = await signedIn();
        toast(L`Account created`);
      }
      render({ fresh: true });
    } catch (err) {
      logError('signup', err);
      stop(L(authMessage(err)));
    }
  },

  thought(form, data) {
    if (!data.text) { $('#f-text', form).focus(); return; }
    const item = { id: uid(), text: data.text, cat: data.cat, at: Date.now(), comments: [], seen: [] };
    S.myThoughts.unshift(item);
    U.compose = null;
    save();
    go('post/' + item.id);
    scheduleIncoming(item, 'thought');
  },

  post(form, data) {
    if (!data.title) { $('#f-title', form).focus(); return; }
    syncRoleDescs();
    if (!U.draft.roles.length) { $('#post-error', form).hidden = false; $('#c-role', form).focus(); return; }
    const withEvent = hasEvent(data.kind);
    const item = {
      id: uid(), title: data.title, kind: data.kind,
      event: withEvent ? data.event : '', deadline: withEvent ? data.deadline : '',
      roles: U.draft.roles.map((r) => ({ name: r.name, desc: r.desc.trim(), filled: false })),
      offer: data.offer, duration: data.duration, responses: [], seen: [],
    };
    item.sentTo = brewMatches(item);
    S.myPosts.unshift(item);
    U.compose = null;
    save();
    render({ fresh: true });
    toast(L`Sent to ${item.sentTo.length} people who fit`);
    scheduleIncoming(item, 'post');
  },

  hi(form, data) {
    if (!data.hi) { $('#c-hi', form).focus(); return; }
    const pid = form.dataset.pid;
    const t = createThread(pid, 'explore', `profile-${pid}`, 'pending', 'You said hi from their profile.');
    t.msgs.push({ from: 'me', text: data.hi, at: Date.now() });
    U.modal = null;
    renderModal();
    save();
    go('chats/' + t.id);
    scheduleAccept(t);
  },

  comment(form, data) {
    if (!data.comment) return;
    const post = postById(form.dataset.id);
    if (!post) return;
    S.comments = S.comments || {};
    const list = (S.comments[post.id] = S.comments[post.id] || []);
    list.push({ by: 'me', text: data.comment, at: Date.now() });
    save();
    render({ fresh: true });
    if (post.by === 'me') return;
    // The author answers in public after a moment
    U.typingPost = post.id;
    render();
    later(2200 + Math.random() * 1800, () => {
      const p = P[post.by];
      const said = list.filter((c) => c.by === p.id).length;
      list.push({ by: p.id, text: p.lines[said % p.lines.length], at: Date.now() });
      U.typingPost = null;
      save();
      render();
    });
  },

  dm(form, data) {
    if (!data.dm) { $('#f-dm', form).focus(); return; }
    const pid = form.dataset.pid;
    const post = postById(form.dataset.post);
    const t = createThread(pid, 'explore', `dm-${post.id}-${pid}`, 'pending', 'You messaged them about: "{0}"', [post.text]);
    t.msgs.push({ from: 'me', text: data.dm, at: Date.now() });
    U.dm = null;
    save();
    go('chats/' + t.id);
    scheduleAccept(t);
  },

  apply(form, data) {
    if (!data.reply) { $('#f-reply', form).focus(); return; }
    const seed = SEED_POSTS.find((b) => b.id === form.dataset.id);
    const t = createThread(seed.by, 'build', seed.id, 'pending', 'You applied anonymously as {0}: "{1}"', [data.role, seed.title]);
    t.msgs.push({ from: 'me', text: data.reply, at: Date.now() });
    U.target = null;
    save();
    go('chats/' + t.id);
    scheduleAccept(t);
  },

  msg(form, data) {
    const t = thread(form.dataset.id);
    if (!t || !data.msg) return;
    if (isCold(t)) return;
    const before = sugarOf(t);
    t.msgs.push({ from: 'me', text: data.msg, at: Date.now() });
    sugarNotes(t, before);
    t.at = Date.now();
    save();
    render({ fresh: true, focus: 'c-msg' });
    themReply(t, 1400 + Math.random() * 1200);
  },

  'drop-msg'(form, data) {
    if (D.phase !== 'live' || !data.msg) return;
    D.msgs.push({ from: 'me', text: data.msg, at: Date.now() });
    render({ fresh: true, focus: 'c-msg' });
    dropReply(1400 + Math.random() * 1200);
  },

  book(form, data) {
    const t = thread(form.dataset.id);
    if (!t) return;
    if (!data.area || !data.date) { $('#book-error', form).hidden = false; return; }
    t.booking = { ...data };
    U.booking = null;
    pushMsg(t, 'sys', 'You suggested a boba run.');
    later(2400, () => {
      if (!thread(t.id)) return;
      pushMsg(t, 'them', 'That works for me. See you there.');
    });
  },
};
