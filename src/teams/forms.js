/* What happens when a form is sent. */

import { $, later, pick, uid } from '../shared/core.js?v=20261030d';
import { isCold } from '../shared/sugar.js?v=20261030d';
import { S, U, save, saveMe } from './state.js?v=20261030d';
import { toast } from './ui.js?v=20261030d';
import { MAX_ROLES } from './options.js?v=20261030d';
import { COMP } from './competitions.js?v=20261030d';
import { go } from './router.js?v=20261030d';
import { DEFAULT_MAX, isFull } from './rules.js?v=20261030d';
import { chatById, push, reply, startChat } from './chats.js?v=20261030d';
import { render } from './render.js?v=20261030d';

export const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

export const forms = {
  me(form, d) {
    if (!d.alias) { $('#me-error', form).hidden = false; return; }
    const first = !S.me;
    const curious = d.curious.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).slice(0, 8);
    saveMe({ ...(S.me || {}), ...d, curious });
    if (first) go('comps');
    else toast('Saved');
    render({ fresh: true });
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
