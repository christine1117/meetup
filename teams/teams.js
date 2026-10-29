/* =========================================================
   Half Sugar Teams
   Find teammates for competitions and hackathons by what people can
   do, not where they studied.

   1. Pick a competition and fill in a competition card
   2. See recommended people and teams (complementary roles first), say hi
   3. Chat to half sugar, then the Team up button unlocks
   4. Both tap it: names are revealed and you become a team with a group chat
   Friends join a team through an invite link, no chat needed.

   Demo mode: no backend. Data stays in this browser and the other
   people are simulated. Shared drawing code lives in kit.js.
   ========================================================= */

const KEY = 'halfsugar.teams.v1';
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROLES = ['Frontend', 'Backend', 'Design', 'Product', 'Data', 'Research', 'Marketing', 'Pitch', 'Hardware', 'Writing'];
const GOALS = [['win', 'Aiming to win'], ['learn', 'Here to learn'], ['fun', 'Just for fun']];
const goalName = (g) => (GOALS.find(([v]) => v === g) || GOALS[1])[1];
const HOURS = [['3', 'About 3 h a week'], ['6', 'About 6 h a week'], ['10', '10+ h a week']];
const hoursName = (h) => (HOURS.find(([v]) => v === String(h)) || HOURS[1])[1];
const DAY = 86400000;

/* ---------- Competitions ----------
   Three ways a competition gets here: an organizer sets it up (a partner),
   a public listing we link to, or someone in the community adds it. */
const SOURCES = { organizer: 'Partner organizer', public: 'Public listing', community: 'Added by the community' };
const COMPS = [
  { id: 'c1', name: 'Taipei Climate Hackathon', kind: 'Hackathon', source: 'organizer', days: 12, size: [3, 5], who: 'Open to everyone', where: 'Taipei, in person' },
  { id: 'c2', name: 'Campus Startup Cup', kind: 'Startup competition', source: 'organizer', days: 25, size: [2, 4], who: 'Students only', where: 'Online' },
  { id: 'c3', name: 'Open Data Challenge', kind: 'Hackathon', source: 'public', days: 18, size: [2, 5], who: 'Open to everyone', where: 'Online' },
  { id: 'c4', name: 'Social Impact Design Jam', kind: 'Design competition', source: 'community', days: 8, size: [2, 4], who: 'Open to everyone', where: 'Taichung, in person' },
  { id: 'c5', name: 'AI for Good Sprint', kind: 'Hackathon', source: 'public', days: 30, size: [3, 5], who: 'Open to everyone', where: 'Online' },
];
const COMP = Object.fromEntries(COMPS.map((c) => [c.id, c]));
const LOADED_AT = Date.now();
const deadlineOf = (c) => LOADED_AT + c.days * DAY;
const dateText = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/* ---------- Simulated people ---------- */
const PEOPLE = [
  { id: 'p1', alias: 'Mochi', field: 'Design', city: 'Taipei', comps: ['c1', 'c4'], canDo: ['Design', 'Research'], lookingFor: ['Frontend', 'Data'], goal: 'win', hours: 10, work: 'Redesigned a bus app used by 2,000 riders', reply: 0.9, real: { name: 'Yen Shu-Wei', school: 'NCKU, Industrial Design', contact: 'shuwei@example.com' } },
  { id: 'p2', alias: 'Kite', field: 'Engineering', city: 'Taipei', comps: ['c1', 'c3', 'c5'], canDo: ['Backend', 'Data'], lookingFor: ['Design', 'Pitch'], goal: 'win', hours: 10, work: 'Built an open bike-lane map from GPS data', reply: 0.75, real: { name: 'Lin Kai-Wen', school: 'NTU, Computer Science', contact: 'kaiwen@example.com' } },
  { id: 'p3', alias: 'Sol', field: 'Founder', city: 'Taipei', comps: ['c2', 'c5'], canDo: ['Pitch', 'Product', 'Marketing'], lookingFor: ['Frontend', 'Backend'], goal: 'win', hours: 6, work: 'Ran a savings app with 1,300 weekly users', reply: 0.85, real: { name: 'Chen Yu-Ting', school: 'NCCU, Business', contact: 'yuting@example.com' } },
  { id: 'p4', alias: 'Nori', field: 'Content', city: 'Taichung', comps: ['c4', 'c2'], canDo: ['Writing', 'Marketing'], lookingFor: ['Design', 'Product'], goal: 'learn', hours: 6, work: 'Writes a newsletter with 4,200 readers', reply: 0.6, real: { name: 'Huang Pei-Shan', school: 'Tunghai, Sociology', contact: 'peishan@example.com' } },
  { id: 'p5', alias: 'Pim', field: 'Research', city: 'Hsinchu', comps: ['c3', 'c1', 'c5'], canDo: ['Data', 'Research'], lookingFor: ['Frontend', 'Design'], goal: 'learn', hours: 6, work: 'Measured indoor air in 23 homes, data on GitHub', reply: 0.8, real: { name: 'Tsou Ting-An', school: 'NTHU, Environmental Engineering', contact: 'tingan@example.com' } },
  { id: 'p6', alias: 'Rue', field: 'Design', city: 'Taipei', comps: ['c2', 'c4'], canDo: ['Design', 'Frontend'], lookingFor: ['Backend', 'Pitch'], goal: 'win', hours: 10, work: 'Booking app for tattoo artists, 35 on the waitlist', reply: 0.8, real: { name: 'Wu Ruo-Xi', school: 'Shih Chien, Communication Design', contact: 'ruoxi@example.com' } },
  { id: 'p7', alias: 'Tavi', field: 'Engineering', city: 'Taipei', comps: ['c5', 'c1'], canDo: ['Backend', 'Data', 'Hardware'], lookingFor: ['Product', 'Design'], goal: 'fun', hours: 3, work: 'Speech-to-notes tool piloted in 3 clinics', reply: 0.95, real: { name: 'Hsu Chih-Hao', school: 'NYCU, Electrical Engineering', contact: 'chihhao@example.com' } },
  { id: 'p8', alias: 'Ode', field: 'Business', city: 'Taichung', comps: ['c2', 'c3'], canDo: ['Marketing', 'Pitch'], lookingFor: ['Frontend', 'Data'], goal: 'learn', hours: 6, work: 'Supplies 9 restaurants with farm produce', reply: 0.65, real: { name: 'Lai Po-Jui', school: 'Tunghai, International Business', contact: 'pojui@example.com' } },
  { id: 'p9', alias: 'Juno', field: 'Engineering', city: 'Tainan', comps: ['c3', 'c4', 'c5'], canDo: ['Frontend'], lookingFor: ['Data', 'Research'], goal: 'learn', hours: 10, work: 'Shipped three small web apps for local shops', reply: 0.9, real: { name: 'Kuo Yi-Jun', school: 'NCKU, Computer Science', contact: 'yijun@example.com' } },
  { id: 'p10', alias: 'Bao', field: 'Founder', city: 'Taipei', comps: ['c1', 'c2'], canDo: ['Product', 'Pitch'], lookingFor: ['Design', 'Backend'], goal: 'win', hours: 6, work: 'Took a campus food app to 800 users', reply: 0.7, real: { name: 'Tsai Wei-Lun', school: 'NTU, Economics', contact: 'weilun@example.com' } },
];
// Friends that join through an invite link in the demo
const FRIENDS = [
  { id: 'f1', alias: 'Pebble', field: 'Engineering', city: 'Taipei', canDo: ['Backend'], lookingFor: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Lee Hsin-Yi', school: 'NTU, Information Management', contact: 'hsinyi@example.com' } },
  { id: 'f2', alias: 'Fig', field: 'Design', city: 'Taipei', canDo: ['Design'], lookingFor: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Chang Ya-Ting', school: 'NTUST, Design', contact: 'yating@example.com' } },
  { id: 'f3', alias: 'Moss', field: 'Business', city: 'Taipei', canDo: ['Marketing'], lookingFor: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Liu Chia-Hui', school: 'NCCU, Marketing', contact: 'chiahui@example.com' } },
];
const ALL_PEOPLE = [...PEOPLE, ...FRIENDS];
const P = Object.fromEntries(ALL_PEOPLE.map((p) => [p.id, p]));
// What your own teammates say to someone you are all talking to
const MATE_LINES = [
  'Welcome! Which part would you want to own?',
  'We meet online twice a week. Would that work for you?',
  'Could you share something you built? Even a small thing is fine.',
];
const LINES = [
  'Nice to meet you. What made you sign up for this one?',
  'I usually handle that part. How much time can you put in each week?',
  'Do you have something you built before? I like seeing real work.',
  'I think our skills fit. Want to try teaming up?',
  'Let us split the first week: you take the idea, I take the build.',
];

// Teams other people already started (they are still recruiting)
const SEED_TEAMS = [
  { id: 'st1', comp: 'c1', name: 'Clear Air', members: ['p1', 'p2'], roles: [{ name: 'Design', by: 'p1' }, { name: 'Data', by: 'p2' }, { name: 'Frontend', by: null }, { name: 'Pitch', by: null }] },
  { id: 'st2', comp: 'c2', name: 'Night Market Labs', members: ['p3', 'p6'], roles: [{ name: 'Pitch', by: 'p3' }, { name: 'Design', by: 'p6' }, { name: 'Backend', by: null }] },
  { id: 'st3', comp: 'c5', name: 'Kind Robots', members: ['p7'], roles: [{ name: 'Backend', by: 'p7' }, { name: 'Product', by: null }, { name: 'Design', by: null }] },
];

/* ---------- State ---------- */
const blank = () => ({ me: null, cards: {}, chats: [], teams: [] });
function load() {
  try {
    const s = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    ['chats', 'teams'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    s.chats.forEach((c) => { c.votes = c.votes || {}; });
    return s;
  } catch {
    return blank();
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage is off; the page still works */ }
}
let S = load();
const U = { form: null, hi: null, typing: {}, confirmReset: false };
let lastPath = null;

/* ---------- Helpers ---------- */
const go = (path) => { location.hash = '#/' + path; };
function route() {
  const [name = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'comps', id };
}
const overlap = (a = [], b = []) => a.filter((x) => b.includes(x));
const personOf = (id) => (id === 'me' ? { ...S.me, alias: 'You', id: 'me' } : P[id]);
const toast = (msg) => {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { toastEl.hidden = true; }, 3000);
};
const roleChips = (list, match = []) => list.map((r) => `<span class="${match.includes(r) ? 'is-match' : ''}">${esc(r)}</span>`).join('');

// Every team in a competition: other people's, plus the ones you are in
const teamsIn = (cid) => [...SEED_TEAMS.filter((t) => t.comp === cid && !S.teams.some((x) => x.id === t.id)), ...S.teams.filter((t) => t.comp === cid)];
const myTeam = (cid) => S.teams.find((t) => t.comp === cid && t.members.includes('me'));
const members = (t) => `${t.members.length} ${t.members.length === 1 ? 'member' : 'members'}`;
const openRoles = (t) => t.roles.filter((r) => !r.by).map((r) => r.name);
const inATeam = (pid, cid) => teamsIn(cid).some((t) => t.members.includes(pid));
const chatWith = (cid, kind, ref) => S.chats.find((c) => c.comp === cid && c.kind === kind && c.ref === ref);
const passed = (cid, kind, ref) => { const c = chatWith(cid, kind, ref); return c && c.status === 'closed'; };

/* Who is in a chat, and who has to say yes.
   A chat with a team (or from your team) is a group chat: the whole team is in it.
   Everyone has to say yes to team up. Anyone can end it politely. */
const sideTeam = (c) => (c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref) : myTeam(c.comp));
function voters(c) {
  const t = sideTeam(c);
  const list = c.kind === 'team' ? ['me', ...t.members] : [...(t ? t.members : ['me']), c.ref];
  return [...new Set(list)];
}
const isGroup = (c) => voters(c).length > 2;
const nick = (id, c) => (id === 'me' ? 'You' : c && c.revealed ? P[id].real.name : P[id].alias);
const PASS_TEXT = 'Thanks for chatting! I don’t think it’s the right fit this time. Good luck with the competition.';

/* ---------- Matching ----------
   Complementary roles count most; the same goal and similar hours help;
   people who reply often come first. */
function personScore(p, card, team) {
  const wanted = team ? openRoles(team) : card.lookingFor;
  return overlap(p.canDo, wanted).length * 3
    + (team ? 0 : overlap(p.lookingFor, card.canDo).length * 2)
    + (p.goal === card.goal ? 2 : 0)
    + (Math.abs(p.hours - Number(card.hours)) <= 3 ? 1 : 0)
    + p.reply;
}
function teamScore(t, card) {
  const lead = P[t.members[0]];
  return overlap(card.canDo, openRoles(t)).length * 4 + (lead.goal === card.goal ? 2 : 0) + lead.reply;
}
function recommendations(cid) {
  const card = S.cards[cid];
  const mine = myTeam(cid);
  // Anyone you (or they) passed on is not shown again in this competition
  const people = PEOPLE.filter((p) => p.comps.includes(cid) && !inATeam(p.id, cid) && !passed(cid, 'person', p.id))
    .map((p) => ({ kind: 'person', ref: p.id, score: personScore(p, card, mine) }));
  const teams = mine ? [] : teamsIn(cid).filter((t) => !t.members.includes('me') && openRoles(t).length && !passed(cid, 'team', t.id))
    .map((t) => ({ kind: 'team', ref: t.id, score: teamScore(t, card) }));
  return [...people, ...teams].sort((a, b) => b.score - a.score);
}

/* ---------- Chats and half sugar ---------- */
const chatById = (id) => S.chats.find((c) => c.id === id);
const chatName = (c) => (c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref).name : (c.revealed ? P[c.ref].real.name : P[c.ref].alias));

function push(c, from, text, who) {
  const before = sugarOf(c);
  c.msgs.push({ from, text, who, at: Date.now() });
  c.at = Date.now();
  if (before < REVEAL_AT && sugarOf(c) >= REVEAL_AT && !c.teamed) {
    c.msgs.push({ from: 'sys', text: 'Half sugar! You can team up now.', at: Date.now() });
  }
  save();
}

function reply(c, delay = 1500) {
  U.typing[c.id] = true;
  render();
  later(delay, () => {
    U.typing[c.id] = false;
    if (!chatById(c.id)) return;
    if (c.status !== 'open') return;
    // In a group chat a different person may answer; your own teammates ask the newcomer questions
    const others = voters(c).filter((v) => v !== 'me');
    const who = c.kind === 'team' ? pick(others) : c.li % 3 === 2 && others.length > 1 ? pick(others.filter((v) => v !== c.ref)) : c.ref;
    const mate = c.kind === 'person' && who !== c.ref;
    push(c, 'them', mate ? pick(MATE_LINES) : LINES[c.li % LINES.length], who);
    c.li += 1;
    save();
    render();
  });
}

function startChat(cid, kind, ref, text) {
  const c = { id: uid(), comp: cid, kind, ref, msgs: [], li: 0, at: Date.now(), status: 'open', votes: {}, teamed: false, revealed: false };
  if (kind === 'person' && myTeam(cid) && myTeam(cid).members.length > 1) {
    c.msgs.push({ from: 'sys', text: 'Your whole team is in this chat. Everyone uses nicknames until you team up.', at: Date.now() });
  } else if (kind === 'team') {
    c.msgs.push({ from: 'sys', text: 'Everyone on the team is in this chat. Everyone uses nicknames until you team up.', at: Date.now() });
  }
  S.chats.push(c);
  push(c, 'me', text);
  go('chat/' + c.id);
  reply(c, 1800);
}

// Both tapped Team up: reveal names and make (or grow) a team
function formTeam(c) {
  const cid = c.comp;
  const card = S.cards[cid];
  let team;
  let fresh = false;
  if (c.kind === 'team') {
    team = S.teams.find((t) => t.id === c.ref) || JSON.parse(JSON.stringify(SEED_TEAMS.find((t) => t.id === c.ref)));
    if (!S.teams.includes(team)) S.teams.push(team);
    team.members.push('me');
    const slot = team.roles.find((r) => !r.by && card.canDo.includes(r.name));
    if (slot) slot.by = 'me';
  } else {
    team = myTeam(cid);
    const p = P[c.ref];
    if (team) {
      team.members.push(p.id);
      const slot = team.roles.find((r) => !r.by && p.canDo.includes(r.name));
      if (slot) slot.by = p.id;
    } else {
      const needed = [...new Set([...card.canDo, ...p.canDo, ...card.lookingFor, ...p.lookingFor])];
      const roles = needed.map((name) => ({ name, by: card.canDo.includes(name) ? 'me' : p.canDo.includes(name) ? p.id : null }));
      team = { id: uid(), comp: cid, name: `${S.me.alias} & ${p.alias}`, members: ['me', p.id], roles, msgs: [], code: uid() };
      fresh = true;
      S.teams.push(team);
    }
  }
  team.msgs = team.msgs || [];
  team.code = team.code || uid();
  const newcomer = c.kind === 'team' ? `${S.me.name || S.me.alias} (you)` : P[c.ref].real.name;
  const note = fresh ? 'Team formed. Names are now visible to everyone in the team.' : `${newcomer} joined the team after chatting to half sugar.`;
  team.msgs.push({ from: 'sys', text: note, at: Date.now() });
  c.teamed = true;
  c.revealed = true;
  c.team = team.id;
  c.msgs.push({ from: 'sys', text: 'You teamed up! Names are unlocked.', at: Date.now() });
  save();
  toast('You teamed up!');
  go('team/' + team.id);
}

/* ---------- Pieces of the page ---------- */
const avatar = (p) => `<span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>`;

function personCard(p, cid) {
  const card = S.cards[cid];
  const mine = myTeam(cid);
  const wanted = mine ? openRoles(mine) : card.lookingFor;
  const existing = chatWith(cid, 'person', p.id);
  return `
    <article class="card tcard">
      <div class="tcard__top">
        ${avatar(p)}
        <div><strong>${esc(p.alias)}</strong> ${flavorChip(p)}<p class="meta">${esc(p.city)} · ${esc(goalName(p.goal))} · ${esc(hoursName(p.hours))}</p></div>
      </div>
      <dl class="brief">
        <div><dt>Can do</dt><dd class="chips">${roleChips(p.canDo, wanted)}</dd></div>
        <div><dt>Looking for</dt><dd class="chips">${roleChips(p.lookingFor, card.canDo)}</dd></div>
        <div><dt>Built</dt><dd>${esc(p.work)}</dd></div>
      </dl>
      ${hiBox(cid, 'person', p.id, existing, mine ? `Invite ${p.alias}` : 'Say hi')}
    </article>`;
}

function teamCard(t, cid) {
  const card = S.cards[cid];
  const existing = chatWith(cid, 'team', t.id);
  const skills = [...new Set(t.members.flatMap((m) => P[m].canDo))];
  return `
    <article class="card tcard tcard--team">
      <div class="tcard__top">
        <span class="team-cups" aria-hidden="true">${t.members.map((m) => cupFor(P[m])).join('')}</span>
        <div><strong>${esc(t.name)}</strong> <span class="tag">Team of ${t.members.length}</span><p class="meta">${esc(goalName(P[t.members[0]].goal))}</p></div>
      </div>
      <dl class="brief">
        <div><dt>Needs</dt><dd class="chips">${roleChips(openRoles(t), card.canDo)}</dd></div>
        <div><dt>Team can do</dt><dd class="chips">${roleChips(skills)}</dd></div>
      </dl>
      ${hiBox(cid, 'team', t.id, existing, 'Say hi to the team')}
    </article>`;
}

function hiBox(cid, kind, ref, existing, label) {
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chat/${existing.id}">Open chat</a>`;
  const key = `${kind}:${ref}`;
  const team = myTeam(cid);
  const note = kind === 'team' ? 'Everyone on the team will see this. Names stay hidden until you team up.'
    : team && team.members.length > 1 ? 'Your whole team will be in this chat. Names stay hidden until you team up.'
      : 'Say what you can bring. Names stay hidden until you team up.';
  if (U.hi === key) {
    return `
      <form class="stack reply" data-form="hi" data-kind="${kind}" data-ref="${ref}" data-comp="${cid}" novalidate>
        <label class="sr" for="c-hi">Your message</label>
        <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(note)}"></textarea>
        <div class="btnrow">
          <button class="btn btn--dark btn--sm" type="submit">Send</button>
          <button class="btn btn--ghost btn--sm" data-act="hi" data-key="" type="button">Cancel</button>
        </div>
      </form>`;
  }
  return `<button class="btn btn--dark btn--sm" data-act="hi" data-key="${key}" type="button">${esc(label)}</button>`;
}

const roleChecks = (name, picked) => `<div class="checks">${ROLES.map((r) => `<label class="check"><input type="checkbox" name="${name}" value="${r}" ${picked.includes(r) ? 'checked' : ''}><span>${r}</span></label>`).join('')}</div>`;

/* ---------- Screens ---------- */
function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}<span class="logo__sub">Teams</span></p>
      <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button">Dev: skip</button>
    </div>
    <h1 class="t-hero">Find teammates by what they can do.</h1>
    <p class="lead">For competitions and hackathons. Schools and companies stay hidden until you team up.</p>
    <form class="panel stack" data-form="me" novalidate>
      ${field('alias', 'Nickname', '', { req: true, hint: 'Not your real name.' })}
      <div class="row2">
        ${select('field', 'Your field (your flavor)', FIELDS.map((f) => [f, `${fieldName(f)}, ${flavorName(f)}`]), 'Design')}
        ${field('city', 'City', '', { ph: 'e.g. Taipei' })}
      </div>
      ${field('work', 'Something you built', '', { ph: 'e.g. A booking app used by 40 shops' })}
      <p class="field__label">Revealed when you team up</p>
      <div class="row2">
        ${field('name', 'Real name', '')}
        ${field('school', 'School or company', '')}
      </div>
      <p class="error" id="me-error" hidden>Please add a nickname.</p>
      <button class="btn btn--primary" type="submit">Start</button>
    </form>
  </main>`;
}

function viewComps() {
  return `
  <header class="head"><div><h1>Competitions</h1><p class="sub">Pick one to find a team.</p></div></header>
  <ul class="comp-list">${COMPS.map((c) => {
    const joined = S.cards[c.id];
    const team = myTeam(c.id);
    const solo = PEOPLE.filter((p) => p.comps.includes(c.id) && !inATeam(p.id, c.id)).length;
    const recruiting = teamsIn(c.id).filter((t) => openRoles(t).length).length;
    return `
    <li>
      <a class="card comp" href="#/comp/${c.id}">
        <div class="comp__top">
          <span class="kind-chip">${esc(c.kind)}</span>
          <span class="src src--${c.source}">${esc(SOURCES[c.source])}</span>
          ${team ? '<span class="tag">In a team</span>' : joined ? '<span class="tag">Joined</span>' : ''}
        </div>
        <h2>${esc(c.name)}</h2>
        <p class="meta">Sign up by ${dateText(deadlineOf(c))} · Teams of ${c.size[0]}–${c.size[1]} · ${esc(c.who)} · ${esc(c.where)}</p>
        <p class="comp__counts"><span><b>${solo}</b> looking for a team</span><span><b>${recruiting}</b> teams recruiting</span></p>
      </a>
    </li>`;
  }).join('')}</ul>`;
}

function cardForm(cid, withTeam) {
  const prev = S.cards[cid] || Object.values(S.cards)[0] || { canDo: [], lookingFor: [], goal: 'win', hours: 6 };
  return `
  <form class="panel stack" data-form="card" data-comp="${cid}" data-team="${withTeam ? 1 : ''}" novalidate>
    <h2>${withTeam ? 'Start a team' : 'Your competition card'}</h2>
    ${withTeam ? field('team', 'Team name', '', { req: true, ph: 'e.g. Clear Air' }) : ''}
    <div class="field"><p class="field__label">What you can do</p>${roleChecks('canDo', prev.canDo)}</div>
    <div class="field"><p class="field__label">${withTeam ? 'Roles your team still needs' : 'Roles you are looking for'}</p>${roleChecks('lookingFor', prev.lookingFor)}</div>
    <div class="row2">
      ${select('goal', 'Your goal', GOALS, prev.goal)}
      ${select('hours', 'Time each week', HOURS, String(prev.hours))}
    </div>
    <p class="error" id="card-error" hidden>Pick at least one thing you can do and one role you are looking for.</p>
    <div class="btnrow">
      <button class="btn btn--primary" type="submit">${withTeam ? 'Create team' : 'Join'}</button>
      <button class="btn btn--ghost" data-act="form" data-what="" type="button">Cancel</button>
    </div>
  </form>`;
}

function viewComp(cid) {
  const c = COMP[cid];
  if (!c) return viewComps();
  const card = S.cards[cid];
  const team = myTeam(cid);
  const recs = card ? recommendations(cid) : [];
  return `
  <a class="back-link" href="#/comps"><i class="ph ph-arrow-left" aria-hidden="true"></i>All competitions</a>
  <section class="card comp comp--head">
    <div class="comp__top"><span class="kind-chip">${esc(c.kind)}</span><span class="src src--${c.source}">${esc(SOURCES[c.source])}</span></div>
    <h1>${esc(c.name)}</h1>
    <p class="meta">Sign up by ${dateText(deadlineOf(c))} · Teams of ${c.size[0]}–${c.size[1]} · ${esc(c.who)} · ${esc(c.where)}</p>
  </section>

  ${!card ? (U.form ? cardForm(cid, U.form === 'team') : `
  <section class="panel join">
    <h2>Join this competition</h2>
    <div class="join__choices">
      <button class="choice" data-act="form" data-what="solo" type="button"><i class="ph ph-user-plus" aria-hidden="true"></i><b>I need a team</b><span>Fill in a card and meet people</span></button>
      <button class="choice" data-act="form" data-what="team" type="button"><i class="ph ph-users-three" aria-hidden="true"></i><b>I have a team, we need more people</b><span>Invite friends, find the rest here</span></button>
    </div>
  </section>`) : `
  ${team ? `
  <a class="card my-team" href="#/team/${team.id}">
    <span class="team-cups" aria-hidden="true">${team.members.map((m) => cupFor(personOf(m))).join('')}</span>
    <div><strong>${esc(team.name)}</strong><p class="meta">${members(team)} · ${openRoles(team).length ? `Still need: ${esc(openRoles(team).join(', '))}` : 'Team complete'}</p></div>
    <i class="ph ph-caret-right" aria-hidden="true"></i>
  </a>` : `
  <section class="mycard">
    <p class="meta">Your card · Can do <b>${esc(card.canDo.join(', '))}</b> · Looking for <b>${esc(card.lookingFor.join(', '))}</b> · ${esc(goalName(card.goal))}</p>
  </section>`}
  ${team && !openRoles(team).length ? '<p class="empty">Your team is complete. Good luck!</p>' : `
  <h2 class="sec-title">${team ? 'People who fit your open roles' : 'Recommended for you'}</h2>
  ${recs.length ? recs.map((r) => (r.kind === 'person' ? personCard(P[r.ref], cid) : teamCard(teamsIn(cid).find((t) => t.id === r.ref), cid))).join('') : '<p class="empty">No one else is looking right now.</p>'}`}`}`;
}

function viewChats() {
  const done = (c) => isCold(c) || c.status === 'closed';
  const chats = [...S.chats].sort((a, b) => done(a) - done(b) || b.at - a.at);
  return `
  <header class="head"><div><h1>Teams &amp; chats</h1><p class="sub">Chat to half sugar, then team up.</p></div></header>
  ${S.teams.length ? `
  <h2 class="sec-title">Your teams</h2>
  ${S.teams.map((t) => `
  <a class="card my-team" href="#/team/${t.id}">
    <span class="team-cups" aria-hidden="true">${t.members.map((m) => cupFor(personOf(m))).join('')}</span>
    <div><strong>${esc(t.name)}</strong><p class="meta">${esc(COMP[t.comp].name)} · ${openRoles(t).length ? `Still need: ${esc(openRoles(t).join(', '))}` : 'Team complete'}</p></div>
    <i class="ph ph-caret-right" aria-hidden="true"></i>
  </a>`).join('')}` : ''}
  <h2 class="sec-title">Chats</h2>
  ${chats.length ? `<ul class="threads">${chats.map((c) => {
    const last = c.msgs[c.msgs.length - 1];
    return `<li class="${done(c) ? 'is-cold' : ''}"><a href="#/chat/${c.id}">
      <span class="avatar avatar--cup" aria-hidden="true">${c.kind === 'team' ? cupFor(P[teamsIn(c.comp).find((t) => t.id === c.ref).members[0]]) : cupFor(P[c.ref])}</span>
      <span class="threads__body"><strong>${esc(chatName(c))}</strong><small>${esc(COMP[c.comp].name)} · ${c.teamed ? 'Teamed up' : c.status === 'closed' ? 'Ended' : isCold(c) ? 'Gone cold' : `${sugarOf(c)}% sugar`}</small><span class="threads__last">${esc(last ? last.text : '')}</span></span>
    </a></li>`;
  }).join('')}</ul>` : '<p class="empty">No chats yet. Pick a competition and say hi to someone.</p>'}`;
}

// names: a function that turns a sender id into the name shown above their message (group chats only)
function bubbles(msgs, typing, names) {
  return msgs.map((m) => {
    if (m.from === 'sys') return `<li class="msg msg--sys">${esc(m.text)}</li>`;
    const name = names && m.from !== 'me' && m.who ? `<small class="msg__who">${esc(names(m.who))}</small>` : '';
    return `<li class="msg msg--${m.from}">${name}${esc(m.text)}</li>`;
  }).join('') + (typing ? '<li class="msg msg--them msg--typing" aria-label="Typing"><span></span><span></span><span></span></li>' : '');
}

function viewChat(c) {
  const open = c.status === 'open' && !c.teamed;
  const cold = isCold(c);
  const live = open && !cold;
  const sugar = sugarOf(c);
  const team = c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref) : null;
  const p = c.kind === 'person' ? P[c.ref] : null;
  const group = isGroup(c);
  const info = p
    ? `Can do ${p.canDo.join(', ')} · Looking for ${p.lookingFor.join(', ')}`
    : `Needs ${openRoles(team).join(', ') || 'no one'} · ${members(team)}`;
  // In a group chat, say who wrote each message (nicknames until you team up)
  const names = group ? (id) => (c.kind === 'person' && id !== c.ref ? `${nick(id, c)} · your team` : nick(id, c)) : null;
  let action = '';
  if (c.teamed) action = `<a class="btn btn--primary btn--sm" href="#/team/${c.team}">Open team</a>`;
  else if (live && c.votes.me) action = '<button class="btn btn--sm" type="button" disabled>You said yes</button>';
  else if (live && sugar >= REVEAL_AT) action = `<button class="btn btn--primary btn--sm" data-act="teamup" data-id="${c.id}" type="button"><i class="ph ph-handshake" aria-hidden="true"></i>Team up</button>`;
  else if (live) action = `<button class="btn btn--sm" type="button" disabled>Team up at ${REVEAL_AT}%</button>`;
  const showVotes = live && (sugar >= REVEAL_AT || Object.keys(c.votes).length);
  let bottom;
  if (c.status === 'closed') bottom = '<p class="cold"><i class="ph ph-door-open" aria-hidden="true"></i>This chat ended. No hard feelings: names were never shown.</p>';
  else if (cold) bottom = '<p class="cold"><i class="ph ph-snowflake" aria-hidden="true"></i>This chat went cold: no reply for 3 days.</p>';
  else if (U.leave === c.id) bottom = `
    <div class="panel leave">
      <p class="field__label">End this chat?</p>
      <p class="meta">We send this for you. No reason needed.</p>
      <blockquote class="leave__quote">${esc(PASS_TEXT)}</blockquote>
      <p class="meta">Names stay hidden, and you won’t be shown to each other again in this competition.</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="leave-send" data-id="${c.id}" type="button">Send and end chat</button>
        <button class="btn btn--ghost btn--sm" data-act="leave" data-id="" type="button">Keep chatting</button>
      </div>
    </div>`;
  else bottom = `
    <div class="devrow"><button class="btn btn--ghost btn--sm" data-act="dev-time" data-id="${c.id}" type="button">Dev: +5 min</button><button class="btn btn--ghost btn--sm" data-act="dev-days" data-id="${c.id}" type="button">Dev: +3 days</button><button class="btn btn--ghost btn--sm" data-act="dev-pass" data-id="${c.id}" type="button">Dev: they pass</button></div>
    <form class="composer" data-form="msg" data-id="${c.id}">
      <label class="sr" for="c-msg">Message</label>
      <input id="c-msg" name="msg" autocomplete="off" placeholder="${group ? 'Message everyone' : 'Say something'}">
      <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
    </form>`;
  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="Back"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1>${esc(chatName(c))}</h1>
        <p class="sub">${esc(COMP[c.comp].name)}${group && p ? ' · with your team' : ''}</p>
        <div class="meta-row">${sugarMeter(sugar)}${live ? `<span class="expiry">${closesText(c)}</span>` : ''}</div>
      </div>
      <div class="chat__tools">
        ${live ? `<button class="btn btn--ghost btn--sm" data-act="call" data-id="${c.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>Video</button>` : ''}
        ${action}
        ${live && U.leave !== c.id ? `<button class="btn btn--ghost btn--sm" data-act="leave" data-id="${c.id}" type="button">Not a fit</button>` : ''}
      </div>
    </header>
    <p class="chat__info">${esc(info)}</p>
    ${showVotes ? `
    <div class="votes" aria-label="Who said yes">
      <span class="votes__label">Everyone says yes to team up</span>
      <ul>${voters(c).map((v) => `<li class="${c.votes[v] ? 'is-yes' : ''}"><i class="ph ${c.votes[v] ? 'ph-check-circle' : 'ph-circle-dashed'}" aria-hidden="true"></i>${esc(nick(v, c))}<span class="sr">${c.votes[v] ? ': yes' : ': waiting'}</span></li>`).join('')}</ul>
    </div>` : ''}
    <ul class="log" id="log">${bubbles(c.msgs, U.typing[c.id], names)}</ul>
    ${bottom}
  </section>`;
}

function viewTeam(t) {
  const link = `${location.origin}${location.pathname}#/join/${t.code}`;
  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="Back"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div><h1>${esc(t.name)}</h1><p class="sub">${esc(COMP[t.comp].name)}</p></div>
      <div class="chat__tools"><button class="btn btn--ghost btn--sm" data-act="call" data-id="${t.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>Team call</button></div>
    </header>
    <details class="panel team-info" ${U.teamOpen === t.id ? 'open' : ''} data-team="${t.id}">
      <summary><span>${members(t)} · ${openRoles(t).length ? `still need ${esc(openRoles(t).join(', '))}` : 'team complete'}</span><span class="sec__edit">Details</span></summary>
      <ul class="mates">${t.members.map((m) => {
        const p = personOf(m);
        return `<li>${avatar(p)}<div><strong>${esc(m === 'me' ? `You (${S.me.name || S.me.alias})` : p.real.name)}</strong><p class="meta">${esc(m === 'me' ? S.me.school || '' : p.real.school)}${m === 'me' ? '' : ` · ${esc(p.real.contact)}`}</p></div></li>`;
      }).join('')}</ul>
      <ul class="roles">${t.roles.map((r) => `<li class="role ${r.by ? 'is-filled' : ''}"><i class="ph ${r.by ? 'ph-check-circle' : 'ph-circle'}" aria-hidden="true"></i><span class="role__name">${esc(r.name)}</span><span class="role__tag">${r.by ? esc(r.by === 'me' ? 'You' : P[r.by].real.name) : 'Open'}</span></li>`).join('')}</ul>
      <div class="invite">
        <p class="field__label">Invite friends</p>
        <p class="meta">Friends join straight away with this link. No chat needed.</p>
        <div class="invite__row"><input readonly value="${esc(link)}" aria-label="Invite link"><button class="btn btn--ghost btn--sm" data-act="copy" data-link="${esc(link)}" type="button">Copy</button></div>
        <button class="btn btn--ghost btn--sm" data-act="dev-friend" data-id="${t.id}" type="button">Dev: a friend joins by link</button>
      </div>
    </details>
    <ul class="log" id="log">${bubbles(t.msgs, U.typing[t.id], (id) => P[id].real.name)}</ul>
    <form class="composer" data-form="teammsg" data-id="${t.id}">
      <label class="sr" for="c-msg">Message</label>
      <input id="c-msg" name="msg" autocomplete="off" placeholder="Message the team">
      <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
    </form>
  </section>`;
}

function viewMe() {
  const me = S.me;
  return `
  <header class="head"><div><h1>Me</h1><p class="sub">Others see the top half. The rest unlocks when you team up.</p></div></header>
  <form class="panel stack" data-form="me" novalidate>
    ${field('alias', 'Nickname', me.alias, { req: true })}
    <div class="row2">
      ${select('field', 'Your field (your flavor)', FIELDS.map((f) => [f, `${fieldName(f)}, ${flavorName(f)}`]), me.field)}
      ${field('city', 'City', me.city)}
    </div>
    ${field('work', 'Something you built', me.work)}
    <p class="field__label">Revealed when you team up</p>
    <div class="row2">${field('name', 'Real name', me.name)}${field('school', 'School or company', me.school)}</div>
    <p class="error" id="me-error" hidden>Please add a nickname.</p>
    <button class="btn btn--primary" type="submit">Save</button>
  </form>
  <section class="panel note">
    <h2>Demo mode</h2>
    <p>Not connected to a server. Data stays in this browser and the other people are simulated.</p>
    <p><a class="inline-link" href="../">Back to the Half Sugar app</a></p>
    ${U.confirmReset
      ? '<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">Yes, clear it</button><button class="btn btn--ghost" data-act="reset-no" type="button">Cancel</button></div>'
      : '<button class="btn btn--ghost" data-act="reset" type="button">Clear all data</button>'}
  </section>`;
}

/* ---------- Shell and drawing ---------- */
const NAV = [['comps', 'Competitions', 'ph-trophy'], ['chats', 'Teams & chats', 'ph-chats-circle'], ['me', 'Me', 'ph-user']];

function shell(r, body) {
  const here = { comp: 'comps', chat: 'chats', team: 'chats' }[r.name] || r.name;
  const full = r.name === 'chat' || r.name === 'team';
  return `
  <div class="app">
    <aside class="side">
      <a class="logo" href="#/comps">${LOGO}<span class="logo__sub">Teams</span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([n, label, icon]) => `<a href="#/${n}" ${here === n ? 'aria-current="page"' : ''}><i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span>${label}</span></span></a>`).join('')}</nav>
    </aside>
    <main class="main ${full ? 'main--chat' : ''} ${location.hash !== lastPath ? 'enter' : ''}" id="main">${body}</main>
  </div>`;
}

function render(opt = {}) {
  try {
    const r = route();
    const path = location.hash;
    const keep = {};
    if (path === lastPath && !opt.fresh) app.querySelectorAll('[id^="c-"], [id^="f-"]').forEach((el) => { keep[el.id] = el.value; });
    const focusId = opt.focus || (path === lastPath && document.activeElement ? document.activeElement.id : null);
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
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
  } catch (err) {
    console.error(err);
    app.innerHTML = `<main class="onboard"><h1>Something went wrong.</h1><p class="hint">${esc(err.message)}</p><button class="btn btn--primary" data-act="reset-yes" type="button">Clear data and restart</button></main>`;
  }
}

/* ---------- Forms ---------- */
const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

const forms = {
  me(form, d) {
    if (!d.alias) { $('#me-error', form).hidden = false; return; }
    const first = !S.me;
    S.me = { ...S.me, ...d };
    save();
    if (first) go('comps');
    else toast('Saved');
    render({ fresh: true });
  },
  card(form, d) {
    const fd = new FormData(form);
    const cid = form.dataset.comp;
    const canDo = fd.getAll('canDo');
    const lookingFor = fd.getAll('lookingFor');
    if (!canDo.length || !lookingFor.length || (form.dataset.team && !d.team)) { $('#card-error', form).hidden = false; return; }
    S.cards[cid] = { canDo, lookingFor, goal: d.goal, hours: Number(d.hours) };
    if (form.dataset.team) {
      const roles = [...canDo.map((name) => ({ name, by: 'me' })), ...lookingFor.filter((r) => !canDo.includes(r)).map((name) => ({ name, by: null }))];
      S.teams.push({ id: uid(), comp: cid, name: d.team, members: ['me'], roles, code: uid(), msgs: [{ from: 'sys', text: 'Team created. Invite friends with the link, or find the rest in the competition.', at: Date.now() }] });
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

/* ---------- Buttons ---------- */
const acts = {
  form(el) { U.form = el.dataset.what || null; render({ fresh: true }); },
  hi(el) { U.hi = el.dataset.key || null; render({ fresh: true, focus: U.hi ? 'c-hi' : null }); },
  teamup(el) {
    const c = chatById(el.dataset.id);
    if (!c || c.votes.me || c.status !== 'open' || sugarOf(c) < REVEAL_AT) return;
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
      if (c.status !== 'open' || c.teamed) return;
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
    c.msgs.push({ from: 'me', text: PASS_TEXT, at: Date.now() });
    c.msgs.push({ from: 'sys', text: 'Chat ended.', at: Date.now() });
    c.status = 'closed';
    save();
    render({ fresh: true });
  },
  // Demo: see what it looks like when the other side passes
  'dev-pass'(el) {
    const c = chatById(el.dataset.id);
    if (!c || c.status !== 'open') return;
    const who = c.kind === 'team' ? pick(voters(c).filter((v) => v !== 'me')) : c.ref;
    c.msgs.push({ from: 'them', who, text: PASS_TEXT, at: Date.now() });
    c.msgs.push({ from: 'sys', text: 'Chat ended.', at: Date.now() });
    c.status = 'closed';
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
    const f = FRIENDS.find((x) => !t.members.includes(x.id) && !S.teams.some((y) => y.comp === t.comp && y.members.includes(x.id)));
    if (!f) { toast('No more demo friends'); return; }
    t.members.push(f.id);
    const slot = t.roles.find((r) => !r.by && f.canDo.includes(r.name));
    if (slot) slot.by = f.id;
    else t.roles.push({ name: f.canDo[0], by: f.id });
    t.msgs.push({ from: 'sys', text: `${f.real.name} joined with your invite link.`, at: Date.now() });
    save();
    render();
  },
  'dev-time'(el) { const c = chatById(el.dataset.id); const before = sugarOf(c); c.devMin = (c.devMin || 0) + 5; if (before < REVEAL_AT && sugarOf(c) >= REVEAL_AT) c.msgs.push({ from: 'sys', text: 'Half sugar! You can team up now.', at: Date.now() }); save(); render(); },
  'dev-days'(el) { const c = chatById(el.dataset.id); c.msgs.forEach((m) => { m.at -= 3 * DAY + 60000; }); c.at -= 3 * DAY + 60000; save(); render(); },
  'dev-skip'() {
    S.me = { alias: 'Dev', field: 'Engineering', city: 'Taipei', work: 'Built a team-up app', name: 'Dev User', school: 'Half Sugar U' };
    save();
    go('comps');
    render({ fresh: true });
  },
  reset() { U.confirmReset = true; render(); },
  'reset-no'() { U.confirmReset = false; render(); },
  'reset-yes'() { try { localStorage.removeItem(KEY); } catch { /* nothing */ } location.hash = ''; location.reload(); },
};

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form](form, formData(form));
});
document.addEventListener('toggle', (e) => {
  if (e.target.matches && e.target.matches('details[data-team]')) U.teamOpen = e.target.open ? e.target.dataset.team : null;
}, true);
window.addEventListener('hashchange', () => {
  // A friend's invite link: join that team straight away (demo: only your own teams exist here)
  const r = route();
  if (r.name === 'join') {
    const t = S.teams.find((x) => x.code === r.id);
    go(t ? 'team/' + t.id : 'comps');
    return;
  }
  U.form = null;
  U.hi = null;
  U.leave = null;
  U.confirmReset = false;
  render();
});
setInterval(() => {
  const r = route();
  if (r.name === 'chat') {
    const c = chatById(r.id);
    const el = $('.expiry');
    if (c && el) el.textContent = closesText(c);
  }
}, 30000);

render();
