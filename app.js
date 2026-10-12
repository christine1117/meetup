/* =========================================================
   Half Sugar app
   Demo mode: there is no backend. Data lives in this browser's
   localStorage, the other people (PEOPLE) are simulated, and
   their replies are pre-written lines.
   To make this a real multi-user product, replace load / save
   and themReply with calls to a backend.

   Interface text goes through L`...` (see i18n.js), so it can be
   shown in English or Traditional Chinese. What people write
   (posts, messages, profiles) stays in the language it was written in.
   ========================================================= */

const KEY = 'meetup.v1';
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 9);
const later = (ms, fn) => setTimeout(fn, ms);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FIELDS = ['Design', 'Engineering', 'Founder', 'Research', 'Content', 'Business', 'Other'];
const ORIGIN = { explore: 'Explore', build: 'Brew', drop: 'Mystery Cup' };
const fieldName = (f) => L(f);
const originName = (o) => L(ORIGIN[o]);

// Logo: a half-full boba cup. Simple geometric mark.
const LOGO = `<svg class="logo__mark" viewBox="0 0 24 28" aria-hidden="true"><path d="M14.5 1.5 12.8 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M4 9h16l-2 16.3A2 2 0 0 1 16 27H8a2 2 0 0 1-2-1.7Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M5.3 15h13.4" stroke="currentColor" stroke-width="2"/><circle cx="9.6" cy="22.4" r="1.7" fill="var(--orange)"/><circle cx="14.4" cy="22.4" r="1.7" fill="var(--orange)"/><circle cx="12" cy="19" r="1.7" fill="var(--orange)"/></svg><span>Half Sugar</span>`;

// Each field is a boba flavor. The colour fills that person's cup.
const FLAVORS = {
  Design: ['Taro', '#c9b3dd'],
  Engineering: ['Matcha', '#b9cf98'],
  Founder: ['Brown sugar', '#c98f5c'],
  Research: ['Oolong', '#dcc282'],
  Content: ['Strawberry', '#eeb0ad'],
  Business: ['Mango', '#f2c36f'],
  Other: ['Classic milk tea', '#dcc3a1'],
};
const flavor = (f) => FLAVORS[f] || FLAVORS.Other;
const flavorName = (f) => L(flavor(f)[0]);
const drinkName = (f) => { const n = flavor(f)[0]; return /milk tea/.test(n) ? L(n) : L`${L(n)} milk tea`; };

// Sugar = how long two people have talked. Every minute adds 5%, so 10 minutes is half sugar.
// A long pause only counts as 3 minutes, so a chat left open in silence does not keep filling.
// At 50% (half sugar) you can pop the seal. At 100% (full sugar) we suggest a boba run.
const SUGAR_PER_MIN = 5;
const PAUSE_CAP_MIN = 3;
const REVEAL_AT = 50;
function talkMinutes(t) {
  const real = t.msgs.filter((m) => m.from !== 'sys' && m.at);
  let ms = 0;
  if (real.some((m) => m.from === 'me') && real.some((m) => m.from === 'them')) {
    for (let i = 1; i < real.length; i += 1) ms += Math.min(real[i].at - real[i - 1].at, PAUSE_CAP_MIN * 60000);
  }
  return ms / 60000 + (t.devMin || 0);
}
const sugarOf = (t) => Math.min(100, Math.floor(talkMinutes(t) * SUGAR_PER_MIN));
const sugarMeter = (v) => `<span class="sugar" title="${esc(L('Sugar goes up the longer you talk. Every minute adds 5%.'))}">${cup('var(--milk)', { level: v / 100, cls: 'cup--chip' })}${L`${v}% sugar`}</span>`;

// A chat closes ("goes cold") when nobody has replied for this many days
const CLOSE_AFTER_DAYS = 3;
const lastActive = (t) => { const real = t.msgs.filter((m) => m.from !== 'sys'); return (real[real.length - 1] || {}).at || t.at; };
const closesIn = (t) => CLOSE_AFTER_DAYS * 86400000 - (Date.now() - lastActive(t));
const isCold = (t) => t.status === 'open' && closesIn(t) <= 0;
const closesText = (t) => {
  const ms = closesIn(t);
  return ms > 86400000
    ? L`Closes in ${Math.ceil(ms / 86400000)}d without a reply`
    : L`Closes in ${Math.max(1, Math.ceil(ms / 3600000))}h without a reply`;
};

// Add a note in the chat when it reaches half sugar or full sugar.
// System notes are saved as English keys and translated when shown.
function sugarNotes(t, before) {
  const after = sugarOf(t);
  if (before < REVEAL_AT && after >= REVEAL_AT && !t.reveal.them) {
    t.msgs.push({ from: 'sys', text: 'Half sugar! You can pop the seal now.', at: Date.now() });
  }
  if (before < 100 && after >= 100) {
    t.msgs.push({ from: 'sys', text: 'Full sugar. Maybe it is time for a boba run?', at: Date.now() });
  }
}

// A boba cup built from simple shapes. level goes from 0 (empty) to 1 (full).
const CUP_PATH = 'M4 9h16l-2 16.3A2 2 0 0 1 16 27H8a2 2 0 0 1-2-1.7Z';
function cup(color, o = {}) {
  const id = 'cup' + uid();
  const level = o.level ?? 0.62;
  const y = (9 + (1 - level) * 18).toFixed(1);
  return `<svg class="cup ${o.cls || ''}" viewBox="0 0 24 28" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="${CUP_PATH}"/></clipPath></defs>
    <rect x="0" y="${y}" width="24" height="28" fill="${color}" clip-path="url(#${id})"/>
    ${level > 0 ? `<g fill="var(--pearl)" clip-path="url(#${id})"><circle cx="8.7" cy="24.4" r="1.6"/><circle cx="12" cy="25" r="1.6"/><circle cx="15.3" cy="24.4" r="1.6"/><circle cx="10.4" cy="21.6" r="1.6"/><circle cx="13.6" cy="21.6" r="1.6"/></g>` : ''}
    <path d="M14.6 1.4 11.8 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="${CUP_PATH}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    ${o.mark ? `<text x="8.6" y="18.4" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor">${o.mark}</text>` : ''}
  </svg>`;
}
const cupFor = (p, cls = '') => cup(flavor(p.field)[1], { cls });

/* ---------- Simulated people ---------- */

const PEOPLE = [
  {
    id: 'p1', alias: 'Mochi', city: 'Taipei', country: 'Taiwan', field: 'Design',
    doing: 'An inventory tool for independent bookstores',
    topics: ['Bookstores', 'Pricing', 'Interviews'],
    proof: 'Live for three months, used by 6 bookstores',
    real: { name: 'Yen Shu-Wei', school: 'National Cheng Kung University, Industrial Design', company: 'Logistics startup, 12 people', title: 'Product designer', linkedin: 'linkedin.com/in/shuwei-yen' },
    lines: ['Interesting. How did you get started on it?', 'I interviewed a dozen bookstore owners. What they dread most is stock counting.', 'Which part are you most stuck on right now?', 'If you like, I can send you my interview guide.'],
    take: 'In my experience, talking to three people face to face beats a hundred survey replies.',
    pitch: 'I have run user interviews from scratch twice. I can help you ask the right questions.',
  },
  {
    id: 'p2', alias: 'Kite', city: 'Berlin', country: 'Germany', field: 'Engineering',
    doing: 'An open-source tool that maps bike-lane gaps from GPS traces',
    topics: ['Open data', 'Cities', 'Rust'],
    proof: 'Used by two cycling groups in Berlin',
    real: { name: 'Jonas Albrecht', school: 'TU Berlin, Computer Science', company: 'Mobility startup, 40 people', title: 'Backend engineer', linkedin: 'linkedin.com/in/jonas-albrecht' },
    lines: ['Interesting. What made you start on that?', "Here it's the opposite: the city has the data but nobody is allowed to use it.", 'How are you testing whether people actually want it?', "I'd love to see what you have so far, even if it's rough."],
    take: 'I would flip the question: who loses something if this works? Talk to them first.',
    pitch: 'I can build the data side in a weekend. I mostly want to learn how you find users.',
  },
  {
    id: 'p3', alias: 'Sol', city: 'Lagos', country: 'Nigeria', field: 'Founder',
    doing: 'A savings app for market traders who get paid daily',
    topics: ['Fintech', 'Informal markets', 'Distribution'],
    proof: '1,300 traders saving every week',
    real: { name: 'Adaeze Okonkwo', school: 'University of Lagos, Economics', company: 'Her own startup', title: 'Co-founder', linkedin: 'linkedin.com/in/adaeze-okonkwo' },
    lines: ["That sounds familiar. Our traders don't trust anything that asks for a password.", "What's the hardest part for you right now?", 'We got our first 50 users by standing in the market for a week. Nothing clever.', 'If you want, I can share how we run agent onboarding.'],
    take: 'In my market this fails for one reason: trust. Who vouches for you on day one?',
    pitch: 'I know distribution in places where ads do not work. Happy to trade notes.',
  },
  {
    id: 'p4', alias: 'Nori', city: 'Seoul', country: 'South Korea', field: 'Content',
    doing: 'A newsletter about small factories in Asia',
    topics: ['Manufacturing', 'Writing', 'Community'],
    proof: '4,200 subscribers, written every week for a year',
    real: { name: 'Han Seo-yeon', school: 'Yonsei University, Sociology', company: 'Freelance', title: 'Writer', linkedin: 'linkedin.com/in/seoyeon-han' },
    lines: ['Oh nice. Who is this for, exactly?', "I've interviewed about thirty factory owners. Most said nobody had ever asked.", 'What would make you pay for something like this yourself?', 'Happy to read a draft if you have one.'],
    take: 'Write down the story of one real person who has this problem. It clears things up fast.',
    pitch: 'I can write the story of the project so strangers get it in ten seconds.',
  },
  {
    id: 'p5', alias: 'Pim', city: 'Taipei', country: 'Taiwan', field: 'Research',
    doing: 'Measuring indoor air in old apartments with cheap sensors',
    topics: ['Air quality', 'Sensors', 'Housing'],
    proof: '23 homes measured, data is public on GitHub',
    real: { name: 'Tsou Ting-An', school: 'National Tsing Hua University, MSc Environmental Engineering', company: 'University lab', title: 'Research assistant', linkedin: 'linkedin.com/in/tingan-tsou' },
    lines: ['I see. Whose problem are you trying to solve?', 'I measured twenty-some old apartments. The kitchen numbers were worse than I expected.', 'Have you tried showing it to users directly?', 'I can share the data. I just really cannot build interfaces.'],
    take: 'I would check for existing data first. Many questions were already measured, just never organized.',
    pitch: 'I can help with data and experiment design. I want to learn how research becomes a product.',
  },
  {
    id: 'p6', alias: 'Rue', city: 'São Paulo', country: 'Brazil', field: 'Design',
    doing: 'A booking tool for independent tattoo artists',
    topics: ['Branding', 'Creators', 'Mobile'],
    proof: '35 artists on the waitlist',
    real: { name: 'Beatriz Nogueira', school: 'Universidade de São Paulo, Design', company: 'Design studio, 8 people', title: 'Brand designer', linkedin: 'linkedin.com/in/beatriz-nogueira' },
    lines: ['Love that. How did you find your first users?', "Tattoo artists here take bookings over Instagram DMs. It's chaos.", 'What does it look like today? A sketch is fine.', 'Payments are the part that scares me. Have you dealt with that?'],
    take: 'Show it to people before it looks good. Ugly prototypes get more honest answers.',
    pitch: 'I can make it look and feel right. I need someone to argue with about scope.',
  },
  {
    id: 'p7', alias: 'Tavi', city: 'Bangalore', country: 'India', field: 'Engineering',
    doing: 'Turning voice notes into structured records for small clinics',
    topics: ['Health', 'Speech', 'ML'],
    proof: 'Pilot running in 3 clinics',
    real: { name: 'Karthik Venkataraman', school: 'IISc Bangalore, MTech', company: 'Health-tech company', title: 'ML engineer', linkedin: 'linkedin.com/in/karthik-venkataraman' },
    lines: ['Got it. What does a normal day of using it look like?', 'Small clinics here write everything by hand, then type it again at night.', "What have you tried that didn't work?", 'I can share the on-device setup if that is useful.'],
    take: 'Measure the boring thing first: how many minutes does this save one person per day?',
    pitch: 'I can handle the ML part. I am looking for people who question my assumptions.',
  },
  {
    id: 'p8', alias: 'Ode', city: 'Taichung', country: 'Taiwan', field: 'Business',
    doing: "Selling small farms' surplus produce to restaurants",
    topics: ['Farming', 'Sales channels', 'Logistics'],
    proof: 'Supplying 9 restaurants every week',
    real: { name: 'Lai Po-Jui', school: 'Tunghai University, International Business', company: 'Family produce wholesaler', title: 'Second-generation successor', linkedin: 'linkedin.com/in/pojui-lai' },
    lines: ['Sounds good. How far along are you?', 'Restaurants are happy to buy. Nobody helps them put a full order together.', 'Is the hard part the tech, or finding people willing to try it?', 'I can take you to the market once. It makes more sense when you see it.'],
    take: 'Ask whether anyone would pay. One person paying three dollars matters more than a hundred saying it is great.',
    pitch: 'I know sales channels and price negotiation. I need someone who can turn the process into a system.',
  },
];
const P = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

const SEED_THOUGHTS = [
  { id: 't1', by: 'p2', mode: 'online', size: '1on1', text: 'If a city gives away its data for free, who should be responsible when someone builds something harmful with it?' },
  { id: 't2', by: 'p5', mode: 'offline', size: '1on1', text: 'Everyone says "build what users want". But as a researcher, how do I even know who my user is?' },
  { id: 't3', by: 'p4', mode: 'online', size: 'group', text: 'Is a newsletter a product or a habit? I cannot tell which one I am building.' },
  { id: 't4', by: 'p8', mode: 'offline', size: 'group', text: 'If you took over a family business, how did you convince your parents to let you try something new?' },
  { id: 't5', by: 'p3', mode: 'online', size: '1on1', text: 'What is one thing that works in your city that would never work in mine? I am collecting examples.' },
  { id: 't6', by: 'p6', mode: 'online', size: '1on1', text: 'Designers: when did you last change your mind because an engineer was right?' },
];

const SEED_POSTS = [
  { id: 'b1', by: 'p1', title: 'Building a checker for second-hand cameras. Looking for someone who knows hardware supply chains.', need: 'Experience with parts sourcing and inspection', offer: 'Front-end development and a list of 40 sellers', duration: 'Six-week project' },
  { id: 'b2', by: 'p7', title: 'Looking for a designer to make clinic software that nurses do not hate.', need: 'Interface design for people in a hurry', offer: 'A working speech model and three clinics to test in', duration: 'Two-week sprint' },
  { id: 'b3', by: 'p3', title: 'Need someone to challenge my pricing before I launch in a second city.', need: 'Pricing experience, any industry', offer: 'Real numbers from 1,300 users', duration: 'One or two calls' },
  { id: 'b4', by: 'p8', title: 'Looking for an engineer to build a produce ordering system for restaurants.', need: 'Someone who can build a simple back office and chat integration', offer: '9 restaurant customers and real daily orders', duration: 'Two months, revenue share is possible' },
];

/* ---------- Matching ----------
   Matching starts from what kind of connection someone is looking for.
   Explore gives each person a few cards a day; a new Brew is sent to
   the people who fit it best. */

const INTENTS = [
  ['cofounder', 'A co-founder'],
  ['team', 'Teammates for a project'],
  ['ideas', 'Someone to swap ideas with'],
  ['feedback', 'Honest feedback'],
];
const intentName = (k) => L((INTENTS.find(([v]) => v === k) || INTENTS[2])[1]);
// Lower-case first letter so it reads well inside an English sentence
const intentInline = (k) => { const n = intentName(k); return LANG === 'zh' ? n : n.charAt(0).toLowerCase() + n.slice(1); };

const PICKS_PER_DAY = 3;
const BREW_SEND_TO = 4;

const PEOPLE_LOOKING = {
  p1: ['team', 'feedback'], p2: ['ideas', 'team'], p3: ['cofounder', 'feedback'], p4: ['ideas', 'feedback'],
  p5: ['team', 'ideas'], p6: ['cofounder', 'team'], p7: ['feedback', 'team'], p8: ['cofounder', 'team'],
};
PEOPLE.forEach((p) => {
  p.looking = PEOPLE_LOOKING[p.id];
  p.thought = (SEED_THOUGHTS.find((t) => t.by === p.id) || {}).text;
});
const POST_LOOKING = { b1: 'team', b2: 'team', b3: 'feedback', b4: 'cofounder' };
SEED_POSTS.forEach((b) => { b.looking = POST_LOOKING[b.id]; });

const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hashNum = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const myLooking = () => (S.me && Array.isArray(S.me.looking) ? S.me.looking : []);

// Why the two of you were matched, in a few short lines
function whyYou(p) {
  const out = p.looking.filter((k) => myLooking().includes(k)).map((k) => L`Both looking for: ${intentInline(k)}`);
  if (p.field !== S.me.field) out.push(L`Different field: ${fieldName(p.field)}`);
  if (S.me.city && p.city === S.me.city) out.push(L`Also in ${p.city}`);
  return out;
}

function pickScore(p, seed) {
  const shared = p.looking.filter((k) => myLooking().includes(k)).length;
  return shared * 3 + (p.field !== S.me.field ? 1 : 0) + (S.me.city && p.city === S.me.city ? 1 : 0) + (hashNum(seed + p.id) % 100) / 100;
}

// Today's cards are chosen once and kept, so they do not shuffle while you look
function todaysPicks() {
  const d = dayKey();
  S.picks = S.picks || {};
  if (!S.picks[d]) {
    const met = new Set(S.threads.map((t) => t.pid));
    S.picks[d] = PEOPLE.filter((p) => !met.has(p.id))
      .sort((a, b) => pickScore(b, d) - pickScore(a, d))
      .slice(0, PICKS_PER_DAY)
      .map((p) => p.id);
    save();
  }
  const passed = (S.passed && S.passed[d]) || [];
  return S.picks[d].filter((pid) => !passed.includes(pid)).map((pid) => P[pid]);
}

// Who a new Brew is sent to: the same kind of connection first, then matching words
function brewMatches(item) {
  const words = `${item.title} ${item.need}`.toLowerCase();
  const score = (p) => (p.looking.includes(item.looking) ? 3 : 0)
    + [p.field, ...p.topics].filter((w) => words.includes(w.toLowerCase())).length
    + (hashNum(item.id + p.id) % 100) / 100;
  return [...PEOPLE].sort((a, b) => score(b) - score(a)).slice(0, BREW_SEND_TO).map((p) => p.id);
}

// How well someone else's Brew fits you
const brewFit = (b) => (myLooking().includes(b.looking) ? 3 : 0) + (P[b.by].field !== S.me.field ? 1 : 0);

/* ---------- State ---------- */

const blank = () => ({ me: null, myThoughts: [], myPosts: [], threads: [], drops: 0 });

function load() {
  try {
    return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* Storage is unavailable. The page still works for this visit. */
  }
}

let S = load();

// Screen state that does not need to be saved
const U = { compose: null, target: null, booking: null, typing: {}, confirmReset: false };
const D = { phase: 'idle', pid: null, msgs: [], ends: 0, li: 0, typing: false, result: null };
let lastPath = null;

/* ---------- Routing ---------- */

function parseRoute() {
  const [name = 'explore', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'explore', id };
}
const go = (path) => { location.hash = '#/' + path; };
const viewing = (tid) => { const r = parseRoute(); return r.name === 'chats' && r.id === tid; };

/* ---------- Small pieces ---------- */

const field = (name, label, val = '', o = {}) => `
  <div class="field">
    <label for="f-${name}">${label}</label>
    ${o.area
      ? `<textarea id="f-${name}" name="${name}" rows="${o.rows || 2}" ${o.req ? 'required' : ''} placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
      : `<input id="f-${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val)}" ${o.req ? 'required' : ''} ${o.min ? `min="${o.min}"` : ''} placeholder="${esc(o.ph || '')}">`}
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;

const select = (name, label, opts, val, hint = '') => `
  <div class="field">
    <label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">
      ${opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}
    </select>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;

const modeLabel = (t) => L`${t.mode === 'offline' ? L('In person') : L('Online')}, ${t.size === 'group' ? L('small group') : L('1-on-1')}`;

const brief = (p) => `
  <dl class="brief">
    <div><dt>${L`Flavor`}</dt><dd>${esc(drinkName(p.field))} (${esc(fieldName(p.field))})</dd></div>
    <div><dt>${L`Working on`}</dt><dd>${esc(p.doing)}</dd></div>
    ${p.proof ? `<div><dt>${L`Proof of work`}</dt><dd>${esc(p.proof)}</dd></div>` : ''}
  </dl>`;

const byline = (p) => `
  <p class="byline">
    <span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>
    <span><strong>${esc(p.alias)}</strong> <span class="flavor" style="--flavor:${flavor(p.field)[1]}" title="${esc(L`Flavor = field. ${flavorName(p.field)} means ${fieldName(p.field)}.`)}">${esc(flavorName(p.field))}</span><br><small>${L`${esc(fieldName(p.field))}. ${esc(p.doing)}`}</small></span>
  </p>`;

const langButton = () => `<button class="btn btn--ghost btn--sm lang" data-act="lang" type="button" aria-label="${esc(L('Switch language'))}"><i class="ph ph-translate" aria-hidden="true"></i>${LANG === 'zh' ? 'English' : '中文'}</button>`;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

/* ---------- Conversations ---------- */

const thread = (tid) => S.threads.find((t) => t.id === tid);
const threadFor = (origin, ref) => S.threads.find((t) => t.origin === origin && t.ref === ref);

function createThread(pid, origin, ref, status, intro, vars) {
  const t = { id: uid(), pid, origin, ref, status, msgs: [], li: 0, reveal: { me: false, them: false }, booking: null, unread: 0, at: Date.now() };
  if (intro) t.msgs.push({ from: 'sys', text: intro, vars, at: Date.now() });
  S.threads.push(t);
  return t;
}

// System notes pass an English key (and vars) so they can be shown in either language
function pushMsg(t, from, text, vars) {
  const before = sugarOf(t);
  t.msgs.push({ from, text, vars, at: Date.now() });
  sugarNotes(t, before);
  t.at = Date.now();
  if (from !== 'me' && !viewing(t.id)) t.unread += 1;
  save();
  render();
}

function themReply(t, delay = 1700) {
  U.typing[t.id] = true;
  render();
  later(delay, () => {
    U.typing[t.id] = false;
    if (!thread(t.id)) return;
    const p = P[t.pid];
    const line = p.lines[t.li % p.lines.length];
    t.li += 1;
    pushMsg(t, 'them', line);
  });
}

function scheduleAccept(t) {
  later(3200, () => {
    if (!thread(t.id) || t.status !== 'pending') return;
    t.status = 'open';
    pushMsg(t, 'sys', 'They accepted. Take your first sip.');
    toast(L`${P[t.pid].alias} accepted your response`);
    themReply(t, 1500);
  });
}

function resolveReveal(t) {
  if (!thread(t.id) || !t.reveal.me || t.reveal.them) return;
  const mine = t.msgs.filter((m) => m.from === 'me').length;
  if (mine >= 2) {
    t.reveal.them = true;
    pushMsg(t, 'sys', 'You both popped the seal. Identities are unlocked.');
    toast(L`Seal popped`);
  } else {
    t.reveal.me = false;
    pushMsg(t, 'them', "Let's sip a bit longer before we pop the seal.");
  }
}

/* ---------- Simulated people responding to what you post ---------- */

function scheduleIncoming(item, key) {
  item.seen = item.seen || item.responses.map((r) => r.pid);
  if (item.seen.length >= 2) return;
  later(4000 + Math.random() * 3000, () => {
    const list = key === 'thought' ? S.myThoughts : S.myPosts;
    if (!list.includes(item) || item.seen.length >= 2) return;
    const pool = key === 'post' && item.sentTo ? PEOPLE.filter((x) => item.sentTo.includes(x.id)) : PEOPLE;
    const left = pool.filter((x) => !item.seen.includes(x.id));
    if (!left.length) return;
    const p = pick(left);
    item.seen.push(p.id);
    item.responses.push({ pid: p.id, text: key === 'thought' ? p.take : p.pitch });
    save();
    toast(key === 'thought' ? L`Someone responded to your thought` : L`Someone applied to your post`);
    render();
    scheduleIncoming(item, key);
  });
}

/* ---------- Screen: profile ---------- */

function profileForm(me, first) {
  me = me || {};
  return `
  <form data-form="profile" class="stack" novalidate>
    <fieldset class="panel">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>${L`Visible from the start`}</legend>
      ${field('alias', L`Nickname`, me.alias, { req: true, hint: L`Not your real name.` })}
      <div class="row2">
        ${field('city', L`City`, me.city, { ph: L`e.g. Taipei` })}
        ${select('field', L`Field (your flavor)`, FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`]), me.field || FIELDS[0], L`Your flavor is your field. It sets the colour of your cup.`)}
      </div>
      ${field('doing', L`What I'm working on`, me.doing, { area: true, req: true, ph: L`e.g. A sign-up system for a community college` })}
      <div class="field" role="group" aria-labelledby="looking-label">
        <p class="field__label" id="looking-label">${L`Looking for`}</p>
        <div class="checks">${INTENTS.map(([v, l]) => `<label class="check"><input type="checkbox" name="looking" value="${v}" ${(me.looking || []).includes(v) ? 'checked' : ''}><span>${L(l)}</span></label>`).join('')}</div>
        <p class="hint">${L`Pick any. This is what we match on.`}</p>
      </div>
      ${field('topics', L`Topics I can talk deeply about`, me.topics, { hint: L`Separate with commas.` })}
      ${field('proof', L`Proof of work`, me.proof, { ph: L`Something you built or achieved` })}
    </fieldset>
    <fieldset class="panel panel--locked">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed until you both pop the seal`}</legend>
      ${explain(L`“Pop the seal” means showing your real profile. It only happens when both people agree.`)}
      <div class="row2">
        ${field('name', L`Real name`, me.name)}
        ${field('title', L`Job title`, me.title)}
      </div>
      <div class="row2">
        ${field('school', L`School`, me.school)}
        ${field('company', L`Company`, me.company)}
      </div>
      ${field('linkedin', 'LinkedIn', me.linkedin)}
    </fieldset>
    <p class="error" id="profile-error" hidden>${L`Please add a nickname and what you're working on.`}</p>
    <button class="btn btn--primary" type="submit">${first ? L`Start sipping` : L`Save my order`}</button>
  </form>`;
}

function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}</p>
      <div class="btnrow">
        ${langButton()}
        <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button"><i class="ph ph-fast-forward" aria-hidden="true"></i>Dev: skip</button>
      </div>
    </div>
    <div class="onboard__hero">
      <div>
        <h1 lang="en">${L`Boba chat, not coffee chat.`}</h1>
        <p class="lead">${L`Meet the person before the résumé. Fill in your order to start. People see the top half. The bottom half stays sealed until you both pop the seal.`}</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </div>
    <p class="onboard__about"><a href="#/about">${L`New here? Read what Half Sugar is and what the boba words mean.`}</a></p>
    ${profileForm(null, true)}
  </main>`;
}

function viewMe() {
  return `
  <header class="head">
    <div><h1 lang="en">${L`My order`}</h1><p class="sub">${L`Your usual. Change it any time.`}</p>${explain(L`Your order is your profile. It shows what you are working on, never your titles.` + ` <a href="#/about">${L`What is Half Sugar?`}</a>`)}</div>
    ${langButton()}
  </header>
  <section class="receipt">
    ${cupFor(S.me, 'cup--lg')}
    <div>
      <p class="receipt__label">${L`Your usual`}</p>
      <p class="receipt__item">1 × ${esc(drinkName(S.me.field))}</p>
      <p class="receipt__meta">${L`For ${esc(S.me.alias)}. Sugar goes up in each chat the longer you talk.`}</p>
    </div>
  </section>
  ${profileForm(S.me, false)}
  <section class="panel note">
    <h2>${L`Demo mode`}</h2>
    <p>${L`This is not connected to a server yet. Your data stays in this browser, the other people are simulated, and their replies are pre-written. Bookings and notifications are not really sent.`}</p>
    ${U.confirmReset
      ? `<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">${L`Yes, clear it`}</button><button class="btn btn--ghost" data-act="reset-no" type="button">${L`Cancel`}</button></div>`
      : `<button class="btn btn--ghost" data-act="reset" type="button">${L`Clear all data`}</button>`}
  </section>`;
}

/* ---------- Screen: Explore ---------- */

function responsesBlock(item, key) {
  if (!item.responses.length) {
    return (item.seen || []).length >= 2
      ? `<p class="waiting">${L`No more responses for now.`}</p>`
      : `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`Waiting for responses`}</p>`;
  }
  return `<ul class="responses">${item.responses.map((r) => `
    <li>
      ${byline(P[r.pid])}
      <p class="quote">${esc(r.text)}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="accept" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Accept, first sip`}</button>
        <button class="btn btn--ghost btn--sm" data-act="decline" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Skip`}</button>
      </div>
    </li>`).join('')}</ul>`;
}

// Shown until someone says what kind of connection they are looking for
const lookingNudge = () => (myLooking().length ? '' : `<p class="nudge"><i class="ph ph-compass" aria-hidden="true"></i><span>${L`Tell us what kind of connection you are looking for, and your picks will get better.`} <a href="#/me">${L`Set it in My order`}</a></span></p>`);

// One anonymous value card in today's picks
function valueCard(p) {
  const existing = threadFor('explore', `pick-${dayKey()}-${p.id}`);
  const why = whyYou(p);
  return `
    <article class="card pick">
      ${byline(p)}
      <dl class="brief">
        <div><dt>${L`Looking for`}</dt><dd>${esc(p.looking.map(intentName).join(L`, `))}</dd></div>
        ${p.proof ? `<div><dt>${L`Proof of work`}</dt><dd>${esc(p.proof)}</dd></div>` : ''}
      </dl>
      ${p.thought ? `<blockquote class="pick__thought"><span>${L`On their mind`}</span>${esc(p.thought)}</blockquote>` : ''}
      <p class="chips">${p.topics.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      ${why.length ? `
      <div class="why">
        <p class="why__label"><i class="ph ph-sparkle" aria-hidden="true"></i>${L`Why you two`}</p>
        <ul>${why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>` : ''}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Said hi. Open chat`}</a>`
        : U.target === p.id
          ? `<form class="stack reply" data-form="hi" data-id="${p.id}" novalidate>
              ${field('reply', L`Say hi`, '', { area: true, rows: 3, req: true, ph: L`Start with what caught your eye. They see your card, not your titles.` })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">${L`Cancel`}</button>
              </div>
            </form>`
          : `<div class="btnrow">
              <button class="btn btn--dark btn--sm" data-act="target" data-id="${p.id}" type="button">${L`Say hi`}</button>
              <button class="btn btn--ghost btn--sm" data-act="pass" data-id="${p.id}" type="button">${L`Pass`}</button>
            </div>`}
    </article>`;
}

function viewExplore() {
  const picks = todaysPicks();
  const hoursLeft = Math.max(1, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3600000));

  return `
  <header class="head">
    <div><h1 lang="en">${L`Explore`}</h1><p class="sub" lang="en">${L`I want to meet someone.`}</p>${explain(L`Three anonymous cards a day, picked for what you are looking for. Say hi, or pass.`)}</div>
    <button class="btn btn--primary" data-act="compose" data-what="thought" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`Share a thought`}</button>
  </header>

  ${U.compose === 'thought' ? `
  <form class="panel stack" data-form="thought" novalidate>
    ${field('text', L`Your thought or question`, '', { area: true, rows: 3, req: true, ph: L`Something you have been turning over lately` })}
    <div class="row2">
      ${select('mode', L`How to meet`, [['online', L`Online`], ['offline', L`In person`]], 'online')}
      ${select('size', L`How many people`, [['1on1', L`1-on-1`], ['group', L`Small group`]], '1on1')}
    </div>
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  ${lookingNudge()}

  <div class="picks__head">
    <h2>${L`Today's picks`}</h2>
    <p class="meta">${L`New cards in ${hoursLeft}h`}</p>
  </div>

  ${picks.length ? picks.map(valueCard).join('') : `
  <div class="empty">
    ${cup('var(--milk)', { level: 0, cls: 'cup--lg' })}
    <p>${L`That's today's menu. New cards tomorrow.`}</p>
  </div>`}

  ${S.myThoughts.length ? `
  <section class="mine">
    <h2>${L`Your thoughts`}</h2>
    ${S.myThoughts.map((t) => `
    <article class="card card--mine">
      <p class="thought">${esc(t.text)}</p>
      <div class="meta-row"><p class="meta">${modeLabel(t)}</p></div>
      ${responsesBlock(t, 'thought')}
    </article>`).join('')}
  </section>` : ''}`;
}

/* ---------- Screen: Build ---------- */

function brewCard(b, forYou) {
  const p = P[b.by];
  const existing = threadFor('build', b.id);
  return `
    <article class="card">
      <h3 class="post-title">${esc(b.title)}</h3>
      ${forYou ? `<p class="why why--inline"><i class="ph ph-sparkle" aria-hidden="true"></i>${esc(L`They want ${intentInline(b.looking)}, and so do you.`)}</p>` : ''}
      <dl class="brief">
        <div><dt>${L`Needs`}</dt><dd>${esc(b.need)}</dd></div>
        <div><dt>${L`Offers`}</dt><dd>${esc(b.offer)}</dd></div>
        <div><dt>${L`Time`}</dt><dd>${esc(b.duration)}</dd></div>
      </dl>
      ${byline(p)}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Applied. Open chat`}</a>`
        : U.target === b.id
          ? `<form class="stack reply" data-form="apply" data-id="${b.id}" novalidate>
              ${field('reply', L`Why you are a fit`, '', { area: true, rows: 3, req: true, ph: L`Say what you would bring. They cannot see your titles` })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">${L`Send anonymously`}</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">${L`Cancel`}</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${b.id}" type="button">${L`Apply anonymously`}</button>`}
    </article>`;
}

function viewBuild() {
  const ranked = [...SEED_POSTS].sort((a, b) => brewFit(b) - brewFit(a));
  const forYou = myLooking().length ? ranked.filter((b) => brewFit(b) >= 3).slice(0, 2) : [];
  const rest = ranked.filter((b) => !forYou.includes(b));

  return `
  <header class="head">
    <div><h1 lang="en">${L`Brew`}</h1><p class="sub" lang="en">${L`I need someone for something.`}</p>${explain(L`Brew means building something together. Post what you need and we send it to the people who fit. Or apply to a Brew without showing your titles.`)}</div>
    <button class="btn btn--primary" data-act="compose" data-what="post" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`Start a brew`}</button>
  </header>

  ${U.compose === 'post' ? `
  <form class="panel stack" data-form="post" novalidate>
    ${field('title', L`What you are building and who you are looking for`, '', { area: true, req: true, ph: L`e.g. Building a shared-kitchen platform, looking for someone who knows food regulation` })}
    ${select('looking', L`Looking for`, INTENTS.filter(([v]) => v !== 'ideas').map(([v, l]) => [v, L(l)]), 'team')}
    ${field('need', L`I need`, '', { req: true })}
    ${field('offer', L`I can offer`, '')}
    ${field('duration', L`Time`, '', { ph: L`e.g. One call, a four-week project` })}
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  ${S.myPosts.length ? `
  <section class="mine">
    <h2>${L`Your brews`}</h2>
    ${S.myPosts.map((b) => `
    <article class="card card--mine">
      <h3 class="post-title">${esc(b.title)}</h3>
      <dl class="brief">
        ${b.looking ? `<div><dt>${L`Looking for`}</dt><dd>${esc(intentName(b.looking))}</dd></div>` : ''}
        <div><dt>${L`I need`}</dt><dd>${esc(b.need)}</dd></div>
        ${b.offer ? `<div><dt>${L`I can offer`}</dt><dd>${esc(b.offer)}</dd></div>` : ''}
        ${b.duration ? `<div><dt>${L`Time`}</dt><dd>${esc(b.duration)}</dd></div>` : ''}
      </dl>
      ${b.sentTo ? `
      <div class="sent">
        <p class="meta"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>${L`Sent to ${b.sentTo.length} people who fit`}</p>
        <ul class="sent__list">${b.sentTo.map((pid) => `<li><span class="avatar avatar--cup" aria-hidden="true">${cupFor(P[pid])}</span>${esc(P[pid].alias)}</li>`).join('')}</ul>
      </div>` : ''}
      ${responsesBlock(b, 'post')}
    </article>`).join('')}
  </section>` : ''}

  ${forYou.length ? `
  <section class="mine">
    <h2>${L`Sent to you`}</h2>
    ${forYou.map((b) => brewCard(b, true)).join('')}
  </section>` : ''}

  <section class="mine">
    <h2>${forYou.length ? L`More brews` : L`All brews`}</h2>
    ${rest.map((b) => brewCard(b, false)).join('')}
  </section>`;
}

/* ---------- Screen: Drop ----------
   The schedule is a placeholder: every Friday 13:00 UTC, open for 10 minutes. */

const DROP_WEEKDAY_UTC = 5;
const DROP_HOUR_UTC = 13;
const DROP_WINDOW_MS = 10 * 60 * 1000;
const DROP_LENGTH_MS = 8 * 60 * 1000;

function nextDrop(now) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DROP_HOUR_UTC));
  next.setUTCDate(next.getUTCDate() + ((DROP_WEEKDAY_UTC - next.getUTCDay() + 7) % 7));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  return next;
}
const dropIsOpen = (now) => now - (nextDrop(now) - 7 * 86400000) < DROP_WINDOW_MS;
const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

function countdownText(now) {
  const s = Math.floor((nextDrop(now) - now) / 1000);
  return L`${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function bubbles(msgs, typing) {
  return msgs.map((m) => `<li class="msg msg--${m.from}">${esc(m.from === 'sys' ? tr(m.text, m.vars) : m.text)}</li>`).join('')
    + (typing ? `<li class="msg msg--them msg--typing" aria-label="${esc(L`They are typing`)}"><span></span><span></span><span></span></li>` : '');
}

function viewDrop() {
  const now = new Date();
  const p = D.pid && P[D.pid];

  if (D.phase === 'matching') {
    return `
    <section class="drop-stage">
      <div class="shake">${cup('var(--orange)', { level: 0.82, mark: '?', cls: 'cup--lg' })}</div>
      <div class="pearls" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>${L`Shaking your mystery cup`}</h1>
      <p class="sub">${L`Someone looking for what you are looking for, from a different city and field.`}</p>
    </section>`;
  }

  if (D.phase === 'live') {
    const shared = p.looking.filter((k) => myLooking().includes(k));
    return `
    <section class="chat">
      <header class="chat__head">
        <div>
          <h1>${L`Someone in ${esc(p.country)}`}</h1>
          <p class="sub">${shared.length ? L`You are both looking for ${intentInline(shared[0])}.` + (LANG === 'zh' ? '' : ' ') : ''}${L`Field: ${esc(fieldName(p.field))}. That is all you know.`}</p>
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
      <p class="sub">${L`Refill means you keep talking and your real profiles are revealed. It only happens if you both choose it. If either of you says no, this cup disappears.`}</p>
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
    <div><h1 lang="en">${L`Mystery Cup`}</h1><p class="sub" lang="en">${L`You can’t pick the flavor.`}</p>${explain(L`A Mystery Cup is a surprise match. Once a week, everyone joins at the same time and gets paired with someone looking for the same kind of connection, from a different city and field.`)}</div>
  </header>
  ${lookingNudge()}
  <section class="drop-card">
    ${cup('var(--milk)', { level: 0.82, mark: '?', cls: 'cup--mystery' })}
    <div>
      ${open
        ? `<p class="drop-card__label">${L`Mystery Cup is open`}</p><p class="drop-card__time">${L`Join now`}</p>`
        : `<p class="drop-card__label">${L`Next Mystery Cup in`}</p><p class="drop-card__time" id="drop-count" role="timer">${countdownText(now)}</p>`}
      <p class="drop-card__when">${L`${esc(localTime)} your time. Open for 10 minutes.`}</p>
      <button class="btn btn--dark" data-act="drop-join" type="button">${open ? L`Pour me one` : L`Try a practice cup`}</button>
    </div>
  </section>
  <ul class="rules">
    <li><i class="ph ph-shuffle" aria-hidden="true"></i><div><strong>${L`No picking flavors`}</strong><p>${L`Same kind of connection, different city and field.`}</p></div></li>
    <li><i class="ph ph-hourglass-medium" aria-hidden="true"></i><div><strong>${L`8 minutes`}</strong><p>${L`Text only. When time is up, it ends.`}</p></div></li>
    <li><i class="ph ph-handshake" aria-hidden="true"></i><div><strong>${L`Refill only if you both want one`}</strong><p>${L`Otherwise the cup disappears.`}</p></div></li>
  </ul>
  ${S.drops ? `<p class="meta">${S.drops === 1 ? L`You have had 1 mystery cup.` : L`You have had ${S.drops} mystery cups.`}</p>` : ''}`;
}

function dropStart() {
  const me = S.me;
  const met = new Set(S.threads.map((t) => t.pid));
  // Same kind of connection first, then a different field and city. A little luck keeps it a surprise.
  const score = (x) => x.looking.filter((k) => myLooking().includes(k)).length * 3
    + (x.field !== me.field ? 2 : 0) + (x.city !== me.city ? 1 : 0) + Math.random();
  const pool = PEOPLE.filter((x) => !met.has(x.id));
  const p = [...(pool.length ? pool : PEOPLE)].sort((a, b) => score(b) - score(a))[0];
  Object.assign(D, { phase: 'live', pid: p.id, li: 0, typing: false, result: null, ends: Date.now() + DROP_LENGTH_MS });
  D.msgs = [{ from: 'sys', text: 'Your first sip lasts 8 minutes. Start by asking what they are busy with.' }];
  render({ fresh: true, focus: 'c-msg' });
  dropReply(1600);
}

function dropReply(delay) {
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

function dropEnd() {
  if (D.phase !== 'live') return;
  D.phase = 'decide';
  D.typing = false;
  S.drops += 1;
  save();
  render({ fresh: true });
}

function dropDecide() {
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
      save();
      D.result = 'match';
    } else {
      D.result = 'declined';
    }
    D.phase = 'result';
    render();
  });
}

/* ---------- Screen: chats ---------- */

const shownName = (t) => (t.reveal.them ? P[t.pid].real.name : P[t.pid].alias);

function viewChats() {
  const list = [...S.threads].sort((a, b) => isCold(a) - isCold(b) || b.at - a.at);
  return `
  <header class="head">
    <div><h1>${L`Chats`}</h1><p class="sub">${L`Every chat starts with a first sip.`}</p>${explain(L`Sugar goes up the longer you talk. At half sugar (50%) you can pop the seal. A chat goes cold and closes if nobody replies for 3 days.`)}</div>
  </header>
  ${list.length ? `<ul class="threads">${list.map((t) => {
    const last = t.msgs[t.msgs.length - 1];
    const status = isCold(t) ? L`went cold` : L`${sugarOf(t)}% sugar`;
    return `
    <li class="${isCold(t) ? 'is-cold' : ''}">
      <a href="#/chats/${t.id}">
        <span class="avatar ${t.reveal.them ? 'avatar--on' : 'avatar--cup'}" aria-hidden="true">${t.reveal.them ? esc(P[t.pid].real.name.charAt(0)) : cupFor(P[t.pid])}</span>
        <span class="threads__body">
          <strong>${esc(shownName(t))}</strong>
          <small>${L`${originName(t.origin)}, ${status}`}${t.status === 'pending' ? L`, waiting for them to accept` : ''}</small>
          <span class="threads__last">${last ? esc(last.from === 'sys' ? tr(last.text, last.vars) : last.text) : ''}</span>
        </span>
        ${t.unread ? `<span class="badge" aria-label="${esc(L`${t.unread} unread`)}">${t.unread}</span>` : ''}
      </a>
    </li>`;
  }).join('')}</ul>` : `
  <div class="empty">
    ${cup('var(--milk)', { level: 0, cls: 'cup--lg' })}
    <p>${L`No cups yet.`}</p>
    <div class="btnrow btnrow--center">
      <a class="btn btn--dark btn--sm" href="#/explore">${L`Respond to a thought`}</a>
      <a class="btn btn--ghost btn--sm" href="#/drop">${L`Try a Mystery Cup`}</a>
    </div>
  </div>`}`;
}

function viewThread(t) {
  const p = P[t.pid];
  const both = t.reveal.me && t.reveal.them;
  const sugar = sugarOf(t);
  const cold = isCold(t);
  const today = new Date().toISOString().slice(0, 10);
  const locked = (label, value) => `<div><dt>${label}</dt><dd>${both ? esc(value) : `<span class="locked"><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed`}</span>`}</dd></div>`;

  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="${esc(L`Back to chats`)}"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1>${esc(shownName(t))}</h1>
        <p class="sub">${L`${originName(t.origin)}, ${esc(p.city)}`}</p>
        <div class="meta-row">${sugarMeter(sugar)}${t.status === 'open' && !cold ? `<span class="expiry">${closesText(t)}</span>` : ''}</div>
      </div>
      ${t.status === 'open' && !cold ? `
      <div class="chat__tools">
        <button class="btn btn--ghost btn--sm" data-act="call" data-id="${t.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>${L`Call`}</button>
        <button class="btn btn--ghost btn--sm" data-act="book-open" data-id="${t.id}" type="button"><i class="ph ph-person-simple-walk" aria-hidden="true"></i>${L`Boba run`}</button>
        ${both ? '' : t.reveal.me
          ? `<button class="btn btn--sm" type="button" disabled>${L`Waiting for them to pop`}</button>`
          : sugar >= REVEAL_AT
            ? `<button class="btn btn--primary btn--sm" data-act="reveal" data-id="${t.id}" type="button">${L`Pop the seal`}</button>`
            : `<button class="btn btn--sm" type="button" disabled>${L`Pop the seal at ${REVEAL_AT}%`}</button>`}
      </div>` : ''}
    </header>

    ${explain(both
      ? L`You both popped the seal, so real names and profiles are visible. The chat closes if nobody replies for ${CLOSE_AFTER_DAYS} days.`
      : L`Names are still hidden. Sugar goes up the longer you talk: 10 minutes of chatting is half sugar (50%), and then you can pop the seal if you both agree. The chat closes if nobody replies for ${CLOSE_AFTER_DAYS} days. “Boba run” means meeting in person.`)}

    <details class="who">
      <summary>${both ? L`Their full card` : L`Their card`}</summary>
      ${brief(p)}
      <p class="chips">${p.topics.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      <dl class="brief brief--locked ${both ? '' : 'is-sealed'}">
        ${locked(L`Name`, p.real.name)}
        ${locked(L`School`, p.real.school)}
        ${locked(L`Company`, p.real.company)}
        ${locked(L`Job title`, p.real.title)}
        ${locked('LinkedIn', p.real.linkedin)}
      </dl>
    </details>

    ${U.booking === t.id ? `
    <form class="panel stack" data-form="book" data-id="${t.id}" novalidate>
      <h2>${L`Go on a boba run`}</h2>
      ${explain(L`A boba run means meeting in person, at a boba shop or a café.`)}
      <div class="row2">
        ${select('kind', L`Type`, [['Boba shop, 1-on-1', L`Boba shop, 1-on-1`], ['Café', L`Café`], ['Small dinner table', L`Small dinner table`]], 'Boba shop, 1-on-1')}
        ${field('area', L`Area`, S.me.city || '', { req: true, ph: L`e.g. Taipei, Da'an` })}
      </div>
      <div class="row2">
        ${field('date', L`Date`, '', { type: 'date', req: true, min: today })}
        ${select('time', L`Time`, ['12:00', '15:00', '19:00'], '15:00')}
      </div>
      <p class="hint">${L`Demo mode: this is saved in the chat, but no table is really booked.`}</p>
      <p class="error" id="book-error" hidden>${L`Please add an area and a date.`}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" type="submit">${L`Send invite`}</button>
        <button class="btn btn--ghost btn--sm" data-act="book-close" type="button">${L`Cancel`}</button>
      </div>
    </form>` : ''}

    ${t.booking ? `<p class="booking"><i class="ph ph-calendar-check" aria-hidden="true"></i>${esc(bookingLabel(t.booking))}</p>` : ''}

    <ul class="log" id="log">${bubbles(t.msgs, U.typing[t.id])}</ul>

    ${cold
      ? `<p class="cold"><i class="ph ph-snowflake" aria-hidden="true"></i>${L`This cup went cold. Nobody replied for ${CLOSE_AFTER_DAYS} days, so the chat closed.`}</p>`
      : t.status === 'open'
        ? `<div class="devrow"><button class="btn btn--ghost btn--sm" data-act="dev-time" data-id="${t.id}" type="button">Dev: +5 min</button><button class="btn btn--ghost btn--sm" data-act="dev-days" data-id="${t.id}" type="button">Dev: +${CLOSE_AFTER_DAYS} days</button></div>`
        : ''}

    ${cold ? '' : t.status === 'pending'
      ? `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`Waiting for them to accept your response`}</p>`
      : `<form class="composer" data-form="msg" data-id="${t.id}">
          <label class="sr" for="c-msg">${L`Message`}</label>
          <input id="c-msg" name="msg" autocomplete="off" placeholder="${esc(L`Say something`)}">
          <button class="btn btn--dark" type="submit" aria-label="${esc(L`Send`)}"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
        </form>`}
  </section>`;
}

// The booking line is built when shown, so it follows the current language
function bookingLabel(b) {
  const day = new Date(`${b.date}T${b.time}`).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return L`${day}, ${b.time}. ${L(b.kind)}, ${b.area}`;
}

/* ---------- Screen: About ---------- */

// Small grey line that explains a boba word in plain language
const explain = (html) => `<p class="explain"><i class="ph ph-info" aria-hidden="true"></i><span>${html}</span></p>`;

const GLOSSARY = [
  ['My order', 'ph-receipt', 'Your profile. It shows what you are working on, never your titles.'],
  ['Flavor', 'ph-drop', 'Your field. Each field is a boba flavor and sets the colour of your cup.'],
  ['Sugar', 'ph-chart-line-up', 'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.'],
  ['Explore', 'ph-compass', 'Three anonymous cards a day, picked for the kind of connection you are looking for.'],
  ['Brew', 'ph-hammer', 'Build something together. Post what you need and it goes to the people who fit, or apply to a Brew without showing your titles.'],
  ['Mystery Cup', 'ph-sparkle', 'A surprise match once a week: the same kind of connection, from a different field. Everyone joins at the same time and you cannot pick who you get.'],
  ['First Sip', 'ph-chat-circle', 'Your first conversation with someone. Real names are still hidden.'],
  ['Pop the seal', 'ph-lock-simple-open', 'Show your real name, school, company and title. It only happens when both of you press it.'],
  ['Refill', 'ph-arrows-clockwise', 'At the end of a Mystery Cup, you both choose Refill to keep talking.'],
  ['Gone cold', 'ph-snowflake', 'A chat closes if nobody replies for 3 days.'],
  ['Boba run', 'ph-person-simple-walk', 'Meet in person, at a boba shop or a café.'],
];

function viewAbout() {
  const next = S.me
    ? `<a class="btn btn--primary" href="#/explore">${L`Back to Explore`}</a>`
    : `<a class="btn btn--primary" href="#/">${L`Start sipping`}</a>`;
  return `
  <article class="about">
    ${S.me ? '' : `<div class="onboard__top"><p class="logo">${LOGO}</p>${langButton()}</div>`}
    <header class="about__hero">
      <div>
        <h1 lang="en">${L`Boba chat, not coffee chat.`}</h1>
        <p class="lead">${L`Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.`}</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </header>

    <section class="about__block">
      <h2>${L`Why we built it`}</h2>
      <p>${L`Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.`}</p>
    </section>

    <section class="about__pair">
      <div class="about__card">
        <h2>${L`Why boba`}</h2>
        <p>${L`A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.`}</p>
      </div>
      <div class="about__card about__card--sugar">
        <h2>${L`Why half sugar`}</h2>
        <p>${L`Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.`}</p>
      </div>
    </section>

    <section class="about__block">
      <h2>${L`How it works`}</h2>
      <ol class="steps">
        <li><strong>${L`Fill in your order.`}</strong> ${L`Say what you are working on. Your titles stay sealed.`}</li>
        <li><strong>${L`Take a first sip.`}</strong> ${L`Say hi to a card in Explore, apply to a Brew, or join the weekly Mystery Cup.`}</li>
        <li><strong>${L`Reach half sugar, then pop the seal.`}</strong> ${L`Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.`}</li>
        <li><strong>${L`Keep it warm.`}</strong> ${L`Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.`}</li>
      </ol>
    </section>

    <section class="about__cold">
      <i class="ph ph-snowflake" aria-hidden="true"></i>
      <div>
        <h2>${L`Why chats go cold`}</h2>
        <p>${L`If nobody replies for ${CLOSE_AFTER_DAYS} days, the chat closes. We do this on purpose.`}</p>
        <p>${L`On most networking apps, people match and then disappear, or agree to meet and never show up. Here, every chat is a small chance that will not wait forever. So reply while it is warm, and show up when you say you will.`}</p>
        <p class="about__hint">${L`Each chat shows how much time is left, so nothing closes by surprise.`}</p>
      </div>
    </section>

    <section class="about__block">
      <h2>${L`The menu`}</h2>
      <p class="about__hint">${L`What our boba words mean.`}</p>
      <dl class="glossary">
        ${GLOSSARY.map(([term, icon, text]) => `<div><dt><i class="ph ${icon}" aria-hidden="true"></i>${L(term)}</dt><dd>${L(text)}</dd></div>`).join('')}
      </dl>
      <h3 class="flavors__title">${L`Flavors`}</h3>
      <ul class="flavors">
        ${FIELDS.map((f) => `<li><span class="flavor" style="--flavor:${flavor(f)[1]}">${esc(flavorName(f))}</span>${esc(fieldName(f))}</li>`).join('')}
      </ul>
    </section>

    <section class="about__belief">
      <p lang="en">${L`Conversation before credentials.`}</p>
      <p lang="en">${L`Meet the person before the résumé.`}</p>
      <p class="accent" lang="en">Meet. Think. Build.</p>
      <div class="btnrow btnrow--center">${next}</div>
    </section>
  </article>`;
}

/* ---------- Shell ---------- */

const NAV = [
  ['explore', 'Explore', 'ph-compass', 'Daily picks'],
  ['build', 'Brew', 'ph-hammer', 'Build together'],
  ['drop', 'Mystery Cup', 'ph-sparkle', 'Weekly surprise match'],
  ['chats', 'Chats', 'ph-chat-circle', 'Your conversations'],
  ['me', 'My order', 'ph-receipt', 'Your profile'],
];

function shell(route, body) {
  const unread = S.threads.reduce((n, t) => n + t.unread, 0);
  const isChat = (route.name === 'chats' && thread(route.id)) || (route.name === 'drop' && D.phase === 'live');
  return `
  <div class="app">
    <aside class="side">
      <a class="logo" href="#/explore" aria-label="${esc(L`Half Sugar home`)}">${LOGO}</a>
      <nav class="nav" aria-label="${esc(L`Main`)}">
        ${NAV.map(([name, label, icon, desc]) => `
        <a href="#/${name}" ${route.name === name ? 'aria-current="page"' : ''}>
          <i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span ${name === 'chats' ? '' : 'lang="en"'}>${L(label)}</span><small>${L(desc)}</small></span>
          ${name === 'chats' && unread ? `<span class="badge" aria-label="${esc(L`${unread} unread`)}">${unread}</span>` : ''}
        </a>`).join('')}
      </nav>
      <div class="side__foot">
        ${langButton()}
        <a class="side__about" href="#/about" ${route.name === 'about' ? 'aria-current="page"' : ''}><i class="ph ph-info" aria-hidden="true"></i>${L`What is Half Sugar?`}</a>
      </div>
    </aside>
    <main class="main ${isChat ? 'main--chat' : ''}" id="main">${body}</main>
  </div>`;
}

function render(opt = {}) {
  const route = parseRoute();
  const path = location.hash;
  const same = path === lastPath && !opt.fresh;
  const activeId = document.activeElement && document.activeElement.id;
  const keep = {};
  if (same) app.querySelectorAll('[id^="f-"], [id^="c-"]').forEach((el) => { keep[el.id] = el.value; });
  const whoOpen = path === lastPath && $('.who', app) && $('.who', app).open;
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
    else body = viewExplore();
    app.innerHTML = shell(route, body);
  }

  Object.entries(keep).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
  if (whoOpen && $('.who', app)) $('.who', app).open = true;
  const focusId = opt.focus || (path === lastPath ? activeId : null);
  if (focusId) { const el = document.getElementById(focusId); if (el) el.focus(); }
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
  if (path !== lastPath) window.scrollTo(0, 0);
  lastPath = path;
}

/* ---------- Forms ---------- */

const formData = (form) => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));

const forms = {
  profile(form, data) {
    if (!data.alias || !data.doing) { $('#profile-error', form).hidden = false; return; }
    const first = !S.me;
    data.looking = new FormData(form).getAll('looking');
    const changed = !S.me || String(S.me.looking) !== String(data.looking);
    S.me = data;
    if (changed && S.picks) {
      // New answers mean new picks, unless you already acted on today's cards
      const d = dayKey();
      const acted = S.threads.some((t) => String(t.ref).startsWith(`pick-${d}`)) || ((S.passed || {})[d] || []).length;
      if (!acted) delete S.picks[d];
    }
    save();
    if (first) { lastPath = null; go('explore'); render({ fresh: true }); } else { toast(L`Saved`); render(); }
  },

  thought(form, data) {
    if (!data.text) { $('#f-text', form).focus(); return; }
    const item = { id: uid(), text: data.text, mode: data.mode, size: data.size, responses: [], seen: [] };
    S.myThoughts.unshift(item);
    U.compose = null;
    save();
    render({ fresh: true });
    scheduleIncoming(item, 'thought');
  },

  post(form, data) {
    if (!data.title || !data.need) { $(data.title ? '#f-need' : '#f-title', form).focus(); return; }
    const item = { id: uid(), ...data, responses: [], seen: [] };
    item.sentTo = brewMatches(item);
    S.myPosts.unshift(item);
    U.compose = null;
    save();
    render({ fresh: true });
    toast(L`Sent to ${item.sentTo.length} people who fit`);
    scheduleIncoming(item, 'post');
  },

  hi(form, data) {
    if (!data.reply) { $('#f-reply', form).focus(); return; }
    const pid = form.dataset.id;
    const t = createThread(pid, 'explore', `pick-${dayKey()}-${pid}`, 'pending', "You said hi from Today's picks.");
    t.msgs.push({ from: 'me', text: data.reply, at: Date.now() });
    U.target = null;
    save();
    go('chats/' + t.id);
    scheduleAccept(t);
  },

  apply(form, data) {
    if (!data.reply) { $('#f-reply', form).focus(); return; }
    const seed = SEED_POSTS.find((b) => b.id === form.dataset.id);
    const t = createThread(seed.by, 'build', seed.id, 'pending', 'You applied anonymously to this post: "{0}"', [seed.title]);
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

/* ---------- Buttons ---------- */

function takeResponse(el) {
  const list = el.dataset.key === 'thought' ? S.myThoughts : S.myPosts;
  const item = list.find((x) => x.id === el.dataset.id);
  if (!item) return {};
  const i = item.responses.findIndex((r) => r.pid === el.dataset.pid);
  const [resp] = i >= 0 ? item.responses.splice(i, 1) : [];
  return { item, resp };
}

const acts = {
  compose(el) { U.compose = el.dataset.what || null; render({ fresh: true, focus: U.compose === 'thought' ? 'f-text' : U.compose === 'post' ? 'f-title' : null }); },
  target(el) { U.target = el.dataset.id || null; render({ fresh: true, focus: U.target ? 'f-reply' : null }); },

  accept(el) {
    const key = el.dataset.key;
    const { item, resp } = takeResponse(el);
    if (!resp) return;
    const t = key === 'thought'
      ? createThread(resp.pid, 'explore', item.id + resp.pid, 'open', 'They responded to your thought: "{0}"', [item.text])
      : createThread(resp.pid, 'build', item.id + resp.pid, 'open', 'They applied anonymously to your post: "{0}"', [item.title]);
    t.msgs.push({ from: 'them', text: resp.text, at: Date.now() });
    save();
    go('chats/' + t.id);
  },

  decline(el) { takeResponse(el); save(); render(); },

  pass(el) {
    const d = dayKey();
    S.passed = S.passed || {};
    S.passed[d] = [...(S.passed[d] || []), el.dataset.id];
    save();
    render();
  },

  reveal(el) {
    const t = thread(el.dataset.id);
    if (!t || t.reveal.me || isCold(t) || sugarOf(t) < REVEAL_AT) return;
    t.reveal.me = true;
    pushMsg(t, 'sys', 'You popped your seal. Waiting for them.');
    later(2600, () => resolveReveal(t));
  },

  call(el) {
    // External video: opens a Jitsi room. The simulated person will not actually join.
    window.open(`https://meet.jit.si/HalfSugar-${el.dataset.id}`, '_blank', 'noopener');
    toast(L`Call room opened in a new tab`);
  },

  'book-open'(el) { U.booking = el.dataset.id; render({ fresh: true, focus: 'f-area' }); },
  'book-close'() { U.booking = null; render({ fresh: true }); },

  'drop-join'() {
    D.phase = 'matching';
    render();
    later(2200, () => { if (D.phase === 'matching') dropStart(); });
  },
  'drop-end'() { dropEnd(); },
  'drop-yes'() { dropDecide(); },
  'drop-no'() { D.phase = 'result'; D.result = 'passed'; render(); },
  'drop-reset'() { D.phase = 'idle'; D.pid = null; D.msgs = []; render(); },

  lang() {
    setLang(LANG === 'zh' ? 'en' : 'zh');
    render();
  },

  // Development shortcuts for chats. Remove before launch.
  'dev-time'(el) {
    const t = thread(el.dataset.id);
    if (!t) return;
    const before = sugarOf(t);
    t.devMin = (t.devMin || 0) + 5;
    sugarNotes(t, before);
    save();
    render();
  },
  'dev-days'(el) {
    const t = thread(el.dataset.id);
    if (!t) return;
    const shift = CLOSE_AFTER_DAYS * 86400000 + 60000;
    t.msgs.forEach((m) => { if (m.at) m.at -= shift; });
    t.at -= shift;
    save();
    render();
  },

  // Development shortcut: skip onboarding with a sample card. Remove before launch.
  'dev-skip'() {
    S.me = { alias: 'Dev', city: 'Taipei', field: 'Design', looking: ['team', 'ideas'], doing: 'Testing Half Sugar', topics: 'Networking, Product', proof: '', name: 'Dev User', title: 'Builder', school: '', company: '', linkedin: '' };
    save();
    lastPath = null;
    go('explore');
    render({ fresh: true });
  },

  reset() { U.confirmReset = true; render(); },
  'reset-no'() { U.confirmReset = false; render(); },
  'reset-yes'() {
    try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
    location.hash = '';
    location.reload();
  },
};

/* ---------- Events ---------- */

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  forms[form.dataset.form](form, formData(form));
});

window.addEventListener('hashchange', () => {
  U.target = null;
  U.compose = null;
  U.booking = null;
  U.confirmReset = false;
  render();
});

// Tick once a second. Only the numbers change, the page is not redrawn.
setInterval(() => {
  if (D.phase === 'live') {
    const left = D.ends - Date.now();
    const el = document.getElementById('drop-timer');
    if (el) el.textContent = clock(left);
    if (left <= 0) dropEnd();
  }
  const count = document.getElementById('drop-count');
  if (count) count.textContent = countdownText(new Date());
}, 1000);

/* ---------- Start ---------- */

// After a reload, pick the unfinished simulations back up
S.threads.forEach((t) => {
  if (t.status === 'pending') scheduleAccept(t);
  if (t.reveal.me && !t.reveal.them) later(2600, () => resolveReveal(t));
});
S.myThoughts.forEach((item) => scheduleIncoming(item, 'thought'));
S.myPosts.forEach((item) => scheduleIncoming(item, 'post'));

render();
