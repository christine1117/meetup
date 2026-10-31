/* What happens when a form is sent. */
import { currentUser, saveProfile } from '../shared/account.js?v=20261031u';
import { logError } from '../shared/log.js?v=20261031u';
import { L } from '../shared/i18n.js?v=20261031u';
import { MAX_CURIOUS, markUnsynced } from '../shared/profile.js?v=20261031u';

import { $, later, pick, uid } from '../shared/core.js?v=20261031u';
import { isCold } from '../shared/sugar.js?v=20261031u';
import { S, U, save, saveMe } from './state.js?v=20261031u';
import { toast } from './ui.js?v=20261031u';
import { MAX_ROLES, WHEN } from './options.js?v=20261031u';
import { saveCard } from './server.js?v=20261031u';
import { COMP } from './competitions.js?v=20261031u';
import { go } from './router.js?v=20261031u';
import { isFull, withinRules } from './rules.js?v=20261031u';
import { chatById, push, reply, startChat } from './chats.js?v=20261031u';
import { render } from './render.js?v=20261031u';
import { savedNote } from './views/profile.js?v=20261031u';

// The profile as the form gives it ("curious" is several ticked boxes)
const meFrom = (d, form) => ({
  ...(S.me || {}), alias: d.alias, field: d.field, city: d.city, meet: d.meet, fun: d.fun,
  name: d.name, title: d.title, school: d.school, company: d.company, contactType: d.contactType, contact: d.contact,
  curious: new FormData(form).getAll('curious').slice(0, MAX_CURIOUS),
});

// The signed-in user, in the small shape the app keeps
export async function whoAmI() {
  const u = await currentUser();
  // Google and LinkedIn give the real name, which goes in the sealed part
  const meta = (u && u.user_metadata) || {};
  return u ? { id: u.id, email: u.email, name: meta.full_name || meta.name || '' } : null;
}

// Ticked roles; "Other" is replaced by what was written next to it
export function pickRoles(fd, name) {
  const own = String(fd.get(`${name}Other`) || '').split(/[,，、]/).map((x) => x.trim().slice(0, 40)).filter(Boolean);
  return [...new Set(fd.getAll(name).flatMap((r) => (r === '__other' ? own : [r])))];
}

// The card as the form gives it; what the form does not ask (the roles you want, on the team form) stays as it was
export function cardFrom(fd, d, before = {}) {
  return {
    canDo: pickRoles(fd, 'canDo'),
    wants: fd.has('wantsOther') || fd.getAll('wants').length ? pickRoles(fd, 'wants').slice(0, 3) : before.wants || [],
    lookingFor: d.lookingFor || before.lookingFor || 'either',
    goal: d.goal, hours: Number(d.hours),
    idea: (d.idea || '').slice(0, 300),
    built: (d.built || '').slice(0, 200),
    availability: fd.getAll('when').filter((w) => WHEN.some(([v]) => v === w)),
  };
}
// What is missing from a card, as messages (empty when it can be saved)
export function cardProblems(card, withTeam, teamName) {
  const out = [];
  if (!card.canDo.length || card.canDo.length > MAX_ROLES) out.push(L`Pick 1 or 2 roles.`);
  if (withTeam && !teamName) out.push(L`Add a team name.`);
  return out;
}

export const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

// Save the profile here, and to the account when signed in
async function keep(me) {
  saveMe(me);
  if (!U.user) return;
  try {
    await saveProfile(me);
    markUnsynced(false);
  } catch (err) {
    logError('profile', err);
    markUnsynced(true);
    toast(L`Saved here, but not to your account. Try again later.`);
  }
}

// The Me page saves as you go (a ticked topic, a field you leave), so leaving the page loses nothing
export async function autosave(form) {
  const d = formData(form);
  const error = $('#me-error', form);
  if (error) error.hidden = !!d.alias;
  if (!d.alias) return;
  await keep(meFrom(d, form));
  U.saved = true;
  const state = $('#save-state');
  if (state) state.innerHTML = savedNote();
}

export const forms = {
  async me(form, d) {
    if (!d.alias) { $('#me-error', form).hidden = false; return; }
    const first = !S.me;
    await keep(meFrom(d, form));
    U.needProfile = false;
    if (first) go('comps');
    else toast(L`Saved`);
    render({ fresh: true });
  },
  // The participation card (spec §4), saved to your account
  async card(form, d) {
    const fd = new FormData(form);
    const cid = form.dataset.comp;
    const card = cardFrom(fd, d, S.cards[cid]);
    const missing = cardProblems(card, !!form.dataset.team, d.team);
    const error = $('#card-error', form);
    if (missing.length) { error.textContent = missing.join(' '); error.hidden = false; return; }
    if (!U.user) { go('account'); return; }
    U.busy = true;
    render();
    try {
      await saveCard(cid, card);
    } catch (err) {
      logError('cards', err);
      U.busy = false;
      toast(L`Could not save your card. Please try again.`);
      render();
      return;
    }
    U.busy = false;
    if (COMP[cid]) S.compCache[cid] = COMP[cid];
    // Teams are still kept in this browser (they move to the server in a later step)
    if (form.dataset.team) {
      S.teams.push({ id: uid(), comp: cid, name: d.team, pitch: '', members: ['me'], needs: pickRoles(fd, 'needs'), max: withinRules(cid, Number(d.max)), code: uid(), msgs: [{ from: 'sys', text: 'Team created. Invite friends with the link, or find the rest in the competition.', at: Date.now() }] });
      save();
    }
    U.form = null;
    toast(L`Card saved`);
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
    t.max = Math.max(withinRules(t.comp, Number(d.max)), t.members.length);
    if (!isFull(t)) t.needs = pickRoles(new FormData(form), 'needs');
    save();
    toast(L`Saved`);
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
