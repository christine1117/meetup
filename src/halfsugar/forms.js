/* ---------- Forms ---------- */

import { $, later, uid } from '../shared/core.js?v=20261030d';
import { L } from '../shared/i18n.js?v=20261030d';
import { isCold, sugarOf } from '../shared/sugar.js?v=20261030d';
import { P, SEED_POSTS, hasEvent } from './people.js?v=20261030d';
import { brewMatches } from './matching.js?v=20261030d';
import { D, S, U, save } from './state.js?v=20261030d';
import { go } from './router.js?v=20261030d';
import { toast } from './ui.js?v=20261030d';
import { createThread, pushMsg, scheduleAccept, sugarNotes, themReply, thread } from './conversations.js?v=20261030d';
import { scheduleIncoming } from './simulate.js?v=20261030d';
import { renderModal } from './modal.js?v=20261030d';
import { postById } from './screens/explore.js?v=20261030d';
import { syncRoleDescs } from './screens/brew.js?v=20261030d';
import { dropReply } from './screens/mystery.js?v=20261030d';
import { render } from './shell.js?v=20261030d';


export const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

export const forms = {
  profile(form, data) {
    if (!data.alias) { $('#profile-error', form).hidden = false; return; }
    const first = !S.me;
    if (first) {
      const q = U.quiz;
      Object.assign(data, { field: q.field, field2: q.field2, curious: q.curious, meet: q.meet, city: q.city });
    } else if (data.field2 === data.field) {
      data.field2 = '';
    }
    // Keep what the form does not hold, like your tags
    S.me = first ? data : { ...S.me, ...data };
    save();
    if (first) { U.lastPath = null; go('explore'); render({ fresh: true }); } else { U.openSec = {}; toast(L`Saved`); render({ fresh: true }); }
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
