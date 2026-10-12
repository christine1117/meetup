/* =========================================================
   Half Sugar app
   Demo mode: there is no backend. Data lives in this browser's
   localStorage, the other people (PEOPLE) are simulated, and
   their replies are pre-written lines.
   To make this a real multi-user product, replace load / save
   and themReply with calls to a backend.
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
const drinkName = (f) => { const n = flavor(f)[0]; return /milk tea/.test(n) ? n : `${n} milk tea`; };

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
const sugarMeter = (v) => `<span class="sugar" title="Sugar goes up the longer you talk. Every minute adds 5%.">${cup('var(--milk)', { level: v / 100, cls: 'cup--chip' })}${v}% sugar</span>`;

// A chat closes ("goes cold") when nobody has replied for this many days
const CLOSE_AFTER_DAYS = 3;
const lastActive = (t) => { const real = t.msgs.filter((m) => m.from !== 'sys'); return (real[real.length - 1] || {}).at || t.at; };
const closesIn = (t) => CLOSE_AFTER_DAYS * 86400000 - (Date.now() - lastActive(t));
const isCold = (t) => t.status === 'open' && closesIn(t) <= 0;
const closesText = (t) => { const ms = closesIn(t); return ms > 86400000 ? `Closes in ${Math.ceil(ms / 86400000)}d without a reply` : `Closes in ${Math.max(1, Math.ceil(ms / 3600000))}h without a reply`; };

// Add a note in the chat when it reaches half sugar or full sugar
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
const U = { compose: null, target: null, booking: null, typing: {}, confirmReset: false, f: { mode: '', size: '', city: '', field: '' } };
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

const modeLabel = (t) => `${t.mode === 'offline' ? 'In person' : 'Online'}, ${t.size === 'group' ? 'small group' : '1-on-1'}`;

const brief = (p) => `
  <dl class="brief">
    <div><dt>Flavor</dt><dd>${esc(drinkName(p.field))} (${esc(p.field)})</dd></div>
    <div><dt>Working on</dt><dd>${esc(p.doing)}</dd></div>
    ${p.proof ? `<div><dt>Proof of work</dt><dd>${esc(p.proof)}</dd></div>` : ''}
  </dl>`;

const byline = (p) => `
  <p class="byline">
    <span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>
    <span><strong>${esc(p.alias)}</strong> <span class="flavor" style="--flavor:${flavor(p.field)[1]}" title="Flavor = field. ${esc(flavor(p.field)[0])} means ${esc(p.field)}.">${esc(flavor(p.field)[0])}</span><br><small>${esc(p.field)}. ${esc(p.doing)}</small></span>
  </p>`;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

/* ---------- Conversations ---------- */

const thread = (tid) => S.threads.find((t) => t.id === tid);
const threadFor = (origin, ref) => S.threads.find((t) => t.origin === origin && t.ref === ref);

function createThread(pid, origin, ref, status, intro) {
  const t = { id: uid(), pid, origin, ref, status, msgs: [], li: 0, reveal: { me: false, them: false }, booking: null, unread: 0, at: Date.now() };
  if (intro) t.msgs.push({ from: 'sys', text: intro, at: Date.now() });
  S.threads.push(t);
  return t;
}

function pushMsg(t, from, text) {
  const before = sugarOf(t);
  t.msgs.push({ from, text, at: Date.now() });
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
    toast(`${P[t.pid].alias} accepted your response`);
    themReply(t, 1500);
  });
}

function resolveReveal(t) {
  if (!thread(t.id) || !t.reveal.me || t.reveal.them) return;
  const mine = t.msgs.filter((m) => m.from === 'me').length;
  if (mine >= 2) {
    t.reveal.them = true;
    pushMsg(t, 'sys', 'You both popped the seal. Identities are unlocked.');
    toast('Seal popped');
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
    const p = pick(PEOPLE.filter((x) => !item.seen.includes(x.id)));
    item.seen.push(p.id);
    item.responses.push({ pid: p.id, text: key === 'thought' ? p.take : p.pitch });
    save();
    toast(key === 'thought' ? 'Someone responded to your thought' : 'Someone applied to your post');
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
      <legend><i class="ph ph-eye" aria-hidden="true"></i>Visible from the start</legend>
      ${field('alias', 'Nickname', me.alias, { req: true, hint: 'Not your real name.' })}
      <div class="row2">
        ${field('city', 'City', me.city, { ph: 'e.g. Taipei' })}
        ${select('field', 'Field (your flavor)', FIELDS.map((f) => [f, `${f}, ${flavor(f)[0]}`]), me.field || FIELDS[0], 'Your flavor is your field. It sets the colour of your cup.')}
      </div>
      ${field('doing', "What I'm working on", me.doing, { area: true, req: true, ph: 'e.g. A sign-up system for a community college' })}
      ${field('topics', 'Topics I can talk deeply about', me.topics, { hint: 'Separate with commas.' })}
      ${field('proof', 'Proof of work', me.proof, { ph: 'Something you built or achieved' })}
    </fieldset>
    <fieldset class="panel panel--locked">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>Sealed until you both pop the seal</legend>
      ${explain('“Pop the seal” means showing your real profile. It only happens when both people agree.')}
      <div class="row2">
        ${field('name', 'Real name', me.name)}
        ${field('title', 'Job title', me.title)}
      </div>
      <div class="row2">
        ${field('school', 'School', me.school)}
        ${field('company', 'Company', me.company)}
      </div>
      ${field('linkedin', 'LinkedIn', me.linkedin)}
    </fieldset>
    <p class="error" id="profile-error" hidden>Please add a nickname and what you're working on.</p>
    <button class="btn btn--primary" type="submit">${first ? 'Start sipping' : 'Save my order'}</button>
  </form>`;
}

function viewOnboard() {
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}</p>
      <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button"><i class="ph ph-fast-forward" aria-hidden="true"></i>Dev: skip</button>
    </div>
    <div class="onboard__hero">
      <div>
        <h1>Boba chat, not coffee chat.</h1>
        <p class="lead">Meet the person before the résumé. Fill in your order to start. People see the top half. The bottom half stays sealed until you both pop the seal.</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </div>
    <p class="onboard__about"><a href="#/about">New here? Read what Half Sugar is and what the boba words mean.</a></p>
    ${profileForm(null, true)}
  </main>`;
}

function viewMe() {
  return `
  <header class="head">
    <div><h1>My order</h1><p class="sub">Your usual. Change it any time.</p>${explain('Your order is your profile. It shows what you are working on, never your titles. <a href="#/about">What is Half Sugar?</a>')}</div>
  </header>
  <section class="receipt">
    ${cupFor(S.me, 'cup--lg')}
    <div>
      <p class="receipt__label">Your usual</p>
      <p class="receipt__item">1 × ${esc(drinkName(S.me.field))}</p>
      <p class="receipt__meta">For ${esc(S.me.alias)}. Sugar goes up in each chat the longer you talk.</p>
    </div>
  </section>
  ${profileForm(S.me, false)}
  <section class="panel note">
    <h2>Demo mode</h2>
    <p>This is not connected to a server yet. Your data stays in this browser, the other people are simulated, and their replies are pre-written. Bookings and notifications are not really sent.</p>
    ${U.confirmReset
      ? `<div class="btnrow"><button class="btn btn--danger" data-act="reset-yes" type="button">Yes, clear it</button><button class="btn btn--ghost" data-act="reset-no" type="button">Cancel</button></div>`
      : `<button class="btn btn--ghost" data-act="reset" type="button">Clear all data</button>`}
  </section>`;
}

/* ---------- Screen: Explore ---------- */

function responsesBlock(item, key) {
  if (!item.responses.length) {
    return (item.seen || []).length >= 2
      ? `<p class="waiting">No more responses for now.</p>`
      : `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>Waiting for responses</p>`;
  }
  return `<ul class="responses">${item.responses.map((r) => `
    <li>
      ${byline(P[r.pid])}
      <p class="quote">${esc(r.text)}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="accept" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">Accept, first sip</button>
        <button class="btn btn--ghost btn--sm" data-act="decline" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">Skip</button>
      </div>
    </li>`).join('')}</ul>`;
}

function viewExplore() {
  const f = U.f;
  const cities = [...new Set(PEOPLE.map((p) => p.city))];
  const feed = SEED_THOUGHTS.filter((t) => {
    const p = P[t.by];
    return (!f.mode || t.mode === f.mode) && (!f.size || t.size === f.size) && (!f.city || p.city === f.city) && (!f.field || p.field === f.field);
  });
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;

  return `
  <header class="head">
    <div><h1>Explore</h1><p class="sub">I want to meet someone.</p>${explain('Browse what people are thinking about. Reply with your view to start a chat.')}</div>
    <button class="btn btn--primary" data-act="compose" data-what="thought" type="button"><i class="ph ph-plus" aria-hidden="true"></i>Share a thought</button>
  </header>

  ${U.compose === 'thought' ? `
  <form class="panel stack" data-form="thought" novalidate>
    ${field('text', 'Your thought or question', '', { area: true, rows: 3, req: true, ph: 'Something you have been turning over lately' })}
    <div class="row2">
      ${select('mode', 'How to meet', [['online', 'Online'], ['offline', 'In person']], 'online')}
      ${select('size', 'How many people', [['1on1', '1-on-1'], ['group', 'Small group']], '1on1')}
    </div>
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">Post</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">Cancel</button>
    </div>
  </form>` : ''}

  ${S.myThoughts.length ? `
  <section class="mine">
    <h2>Your thoughts</h2>
    ${S.myThoughts.map((t) => `
    <article class="card card--mine">
      <p class="thought">${esc(t.text)}</p>
      <div class="meta-row"><p class="meta">${modeLabel(t)}</p></div>
      ${responsesBlock(t, 'thought')}
    </article>`).join('')}
  </section>` : ''}

  <div class="filters" role="group" aria-label="Filters">
    <select data-filter="mode" aria-label="Online or in person">${opt('', 'Any format', f.mode)}${opt('online', 'Online', f.mode)}${opt('offline', 'In person', f.mode)}</select>
    <select data-filter="size" aria-label="Group size">${opt('', 'Any size', f.size)}${opt('1on1', '1-on-1', f.size)}${opt('group', 'Small group', f.size)}</select>
    <select data-filter="city" aria-label="City">${opt('', 'All cities', f.city)}${cities.map((c) => opt(c, c, f.city)).join('')}</select>
    <select data-filter="field" aria-label="Field">${opt('', 'All fields', f.field)}${FIELDS.map((c) => opt(c, `${c}, ${flavor(c)[0]}`, f.field)).join('')}</select>
  </div>

  ${feed.length ? feed.map((t) => {
    const p = P[t.by];
    const existing = threadFor('explore', t.id);
    return `
    <article class="card">
      <p class="thought">${esc(t.text)}</p>
      <div class="meta-row"><p class="meta">${modeLabel(t)}, ${esc(p.city)}</p></div>
      ${byline(p)}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">Responded. Open chat</a>`
        : U.target === t.id
          ? `<form class="stack reply" data-form="respond" data-id="${t.id}" novalidate>
              ${field('reply', 'Your perspective', '', { area: true, rows: 3, req: true, ph: 'They see your response and your card, not your titles' })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">Send response</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">Cancel</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${t.id}" type="button">Respond</button>`}
    </article>`;
  }).join('') : `<p class="empty">Nothing matches. Change the filters, or share a thought of your own.</p>`}`;
}

/* ---------- Screen: Build ---------- */

function viewBuild() {
  return `
  <header class="head">
    <div><h1>Brew</h1><p class="sub">I need someone for something.</p>${explain('Brew means building something together. Post what you need, or apply to a post without showing your titles.')}</div>
    <button class="btn btn--primary" data-act="compose" data-what="post" type="button"><i class="ph ph-plus" aria-hidden="true"></i>Start a brew</button>
  </header>

  ${U.compose === 'post' ? `
  <form class="panel stack" data-form="post" novalidate>
    ${field('title', 'What you are building and who you are looking for', '', { area: true, req: true, ph: 'e.g. Building a shared-kitchen platform, looking for someone who knows food regulation' })}
    ${field('need', 'I need', '', { req: true })}
    ${field('offer', 'I can offer', '')}
    ${field('duration', 'Time', '', { ph: 'e.g. One call, a four-week project' })}
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">Post</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">Cancel</button>
    </div>
  </form>` : ''}

  ${S.myPosts.length ? `
  <section class="mine">
    <h2>Your brews</h2>
    ${S.myPosts.map((b) => `
    <article class="card card--mine">
      <h3 class="post-title">${esc(b.title)}</h3>
      <dl class="brief">
        <div><dt>I need</dt><dd>${esc(b.need)}</dd></div>
        ${b.offer ? `<div><dt>I can offer</dt><dd>${esc(b.offer)}</dd></div>` : ''}
        ${b.duration ? `<div><dt>Time</dt><dd>${esc(b.duration)}</dd></div>` : ''}
      </dl>
      ${responsesBlock(b, 'post')}
    </article>`).join('')}
  </section>` : ''}

  ${SEED_POSTS.map((b) => {
    const p = P[b.by];
    const existing = threadFor('build', b.id);
    return `
    <article class="card">
      <h3 class="post-title">${esc(b.title)}</h3>
      <dl class="brief">
        <div><dt>Needs</dt><dd>${esc(b.need)}</dd></div>
        <div><dt>Offers</dt><dd>${esc(b.offer)}</dd></div>
        <div><dt>Time</dt><dd>${esc(b.duration)}</dd></div>
      </dl>
      ${byline(p)}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">Applied. Open chat</a>`
        : U.target === b.id
          ? `<form class="stack reply" data-form="apply" data-id="${b.id}" novalidate>
              ${field('reply', 'Why you are a fit', '', { area: true, rows: 3, req: true, ph: 'Say what you would bring. They cannot see your titles' })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">Send anonymously</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">Cancel</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${b.id}" type="button">Apply anonymously</button>`}
    </article>`;
  }).join('')}`;
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
  return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function bubbles(msgs, typing) {
  return msgs.map((m) => `<li class="msg msg--${m.from}">${esc(m.text)}</li>`).join('')
    + (typing ? `<li class="msg msg--them msg--typing" aria-label="They are typing"><span></span><span></span><span></span></li>` : '');
}

function viewDrop() {
  const now = new Date();
  const p = D.pid && P[D.pid];

  if (D.phase === 'matching') {
    return `
    <section class="drop-stage">
      <div class="shake">${cup('var(--orange)', { level: 0.82, mark: '?', cls: 'cup--lg' })}</div>
      <div class="pearls" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>Shaking your mystery cup</h1>
      <p class="sub">Someone in a different city and a different field.</p>
    </section>`;
  }

  if (D.phase === 'live') {
    return `
    <section class="chat">
      <header class="chat__head">
        <div>
          <h1>Someone in ${esc(p.country)}</h1>
          <p class="sub">Field: ${esc(p.field)}. That is all you know.</p>
        </div>
        <div class="chat__tools">
          <span class="timer" id="drop-timer" role="timer">${clock(D.ends - Date.now())}</span>
          <button class="btn btn--ghost btn--sm" data-act="drop-end" type="button">End chat</button>
        </div>
      </header>
      <ul class="log" id="log">${bubbles(D.msgs, D.typing)}</ul>
      <form class="composer" data-form="drop-msg">
        <label class="sr" for="c-msg">Message</label>
        <input id="c-msg" name="msg" autocomplete="off" placeholder="Say something">
        <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
      </form>
    </section>`;
  }

  if (D.phase === 'decide' || D.phase === 'waiting') {
    return `
    <section class="drop-stage">
      <h1>Cup's empty. Want a refill?</h1>
      <p class="sub">Refill means you keep talking and your real profiles are revealed. It only happens if you both choose it. If either of you says no, this cup disappears.</p>
      ${D.phase === 'waiting'
        ? `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>Waiting for them to decide</p>`
        : `<div class="btnrow btnrow--center">
            <button class="btn btn--primary" data-act="drop-yes" type="button">Refill</button>
            <button class="btn btn--ghost" data-act="drop-no" type="button">I'm good</button>
          </div>`}
    </section>`;
  }

  if (D.phase === 'result') {
    const t = D.result === 'match' && S.threads.find((x) => x.origin === 'drop' && x.pid === D.pid);
    return `
    <section class="drop-stage">
      ${t ? `
        <h1>You both want a refill.</h1>
        <p class="sub">You were talking to ${esc(p.real.name)}, ${esc(p.real.title.toLowerCase())}.</p>
        <div class="btnrow btnrow--center">
          <a class="btn btn--primary" href="#/chats/${t.id}">Refill</a>
          <button class="btn btn--ghost" data-act="drop-reset" type="button">Back to Mystery Cup</button>
        </div>` : `
        <h1>This cup is gone.</h1>
        <p class="sub">${D.result === 'passed' ? 'You chose not to refill.' : 'They passed on a refill this time. Say a bit more next time and your odds go up.'}</p>
        <div class="btnrow btnrow--center">
          <button class="btn btn--primary" data-act="drop-reset" type="button">Back to Mystery Cup</button>
        </div>`}
    </section>`;
  }

  const open = dropIsOpen(now);
  const localTime = nextDrop(now).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
  return `
  <header class="head">
    <div><h1>Mystery Cup</h1><p class="sub">You can’t pick the flavor.</p>${explain('A Mystery Cup is a surprise match. Once a week, everyone joins at the same time and gets paired with someone from a different city and field.')}</div>
  </header>
  <section class="drop-card">
    ${cup('var(--milk)', { level: 0.82, mark: '?', cls: 'cup--mystery' })}
    <div>
      ${open
        ? `<p class="drop-card__label">Mystery Cup is open</p><p class="drop-card__time">Join now</p>`
        : `<p class="drop-card__label">Next Mystery Cup in</p><p class="drop-card__time" id="drop-count" role="timer">${countdownText(now)}</p>`}
      <p class="drop-card__when">${esc(localTime)} your time. Open for 10 minutes.</p>
      <button class="btn btn--dark" data-act="drop-join" type="button">${open ? 'Pour me one' : 'Try a practice cup'}</button>
    </div>
  </section>
  <ul class="rules">
    <li><i class="ph ph-shuffle" aria-hidden="true"></i><div><strong>No picking flavors</strong><p>We pour you someone from a different city and field.</p></div></li>
    <li><i class="ph ph-hourglass-medium" aria-hidden="true"></i><div><strong>8 minutes</strong><p>Text only. When time is up, it ends.</p></div></li>
    <li><i class="ph ph-handshake" aria-hidden="true"></i><div><strong>Refill only if you both want one</strong><p>Otherwise the cup disappears.</p></div></li>
  </ul>
  ${S.drops ? `<p class="meta">You have had ${S.drops} mystery ${S.drops === 1 ? 'cup' : 'cups'}.</p>` : ''}`;
}

function dropStart() {
  const me = S.me;
  const met = new Set(S.threads.map((t) => t.pid));
  const far = PEOPLE.filter((p) => p.city !== me.city && p.field !== me.field);
  const pool = far.filter((p) => !met.has(p.id));
  const p = pick(pool.length ? pool : far.length ? far : PEOPLE);
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
    <div><h1>Chats</h1><p class="sub">Every chat starts with a first sip.</p>${explain('Sugar goes up the longer you talk. At half sugar (50%) you can pop the seal. A chat goes cold and closes if nobody replies for 3 days.')}</div>
  </header>
  ${list.length ? `<ul class="threads">${list.map((t) => {
    const last = t.msgs[t.msgs.length - 1];
    return `
    <li class="${isCold(t) ? 'is-cold' : ''}">
      <a href="#/chats/${t.id}">
        <span class="avatar ${t.reveal.them ? 'avatar--on' : 'avatar--cup'}" aria-hidden="true">${t.reveal.them ? esc(P[t.pid].real.name.charAt(0)) : cupFor(P[t.pid])}</span>
        <span class="threads__body">
          <strong>${esc(shownName(t))}</strong>
          <small>${ORIGIN[t.origin]}, ${isCold(t) ? 'went cold' : `${sugarOf(t)}% sugar`}${t.status === 'pending' ? ', waiting for them to accept' : ''}</small>
          <span class="threads__last">${last ? esc(last.text) : ''}</span>
        </span>
        ${t.unread ? `<span class="badge" aria-label="${t.unread} unread">${t.unread}</span>` : ''}
      </a>
    </li>`;
  }).join('')}</ul>` : `
  <div class="empty">
    ${cup('var(--milk)', { level: 0, cls: 'cup--lg' })}
    <p>No cups yet.</p>
    <div class="btnrow btnrow--center">
      <a class="btn btn--dark btn--sm" href="#/explore">Respond to a thought</a>
      <a class="btn btn--ghost btn--sm" href="#/drop">Try a Mystery Cup</a>
    </div>
  </div>`}`;
}

function viewThread(t) {
  const p = P[t.pid];
  const both = t.reveal.me && t.reveal.them;
  const sugar = sugarOf(t);
  const cold = isCold(t);
  const today = new Date().toISOString().slice(0, 10);
  const locked = (label, value) => `<div><dt>${label}</dt><dd>${both ? esc(value) : '<span class="locked"><i class="ph ph-lock-simple" aria-hidden="true"></i>Sealed</span>'}</dd></div>`;

  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="Back to chats"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1>${esc(shownName(t))}</h1>
        <p class="sub">${ORIGIN[t.origin]}, ${esc(p.city)}</p>
        <div class="meta-row">${sugarMeter(sugar)}${t.status === 'open' && !cold ? `<span class="expiry">${closesText(t)}</span>` : ''}</div>
      </div>
      ${t.status === 'open' && !cold ? `
      <div class="chat__tools">
        <button class="btn btn--ghost btn--sm" data-act="call" data-id="${t.id}" type="button"><i class="ph ph-video-camera" aria-hidden="true"></i>Call</button>
        <button class="btn btn--ghost btn--sm" data-act="book-open" data-id="${t.id}" type="button"><i class="ph ph-person-simple-walk" aria-hidden="true"></i>Boba run</button>
        ${both ? '' : t.reveal.me
          ? `<button class="btn btn--sm" type="button" disabled>Waiting for them to pop</button>`
          : sugar >= REVEAL_AT
            ? `<button class="btn btn--primary btn--sm" data-act="reveal" data-id="${t.id}" type="button">Pop the seal</button>`
            : `<button class="btn btn--sm" type="button" disabled>Pop the seal at ${REVEAL_AT}%</button>`}
      </div>` : ''}
    </header>

    ${explain(both
      ? `You both popped the seal, so real names and profiles are visible. The chat closes if nobody replies for ${CLOSE_AFTER_DAYS} days.`
      : `Names are still hidden. Sugar goes up the longer you talk: 10 minutes of chatting is half sugar (50%), and then you can pop the seal if you both agree. The chat closes if nobody replies for ${CLOSE_AFTER_DAYS} days. “Boba run” means meeting in person.`)}

    <details class="who">
      <summary>${both ? 'Their full card' : 'Their card'}</summary>
      ${brief(p)}
      <p class="chips">${p.topics.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      <dl class="brief brief--locked ${both ? '' : 'is-sealed'}">
        ${locked('Name', p.real.name)}
        ${locked('School', p.real.school)}
        ${locked('Company', p.real.company)}
        ${locked('Job title', p.real.title)}
        ${locked('LinkedIn', p.real.linkedin)}
      </dl>
    </details>

    ${U.booking === t.id ? `
    <form class="panel stack" data-form="book" data-id="${t.id}" novalidate>
      <h2>Go on a boba run</h2>
      ${explain('A boba run means meeting in person, at a boba shop or a café.')}
      <div class="row2">
        ${select('kind', 'Type', ['Boba shop, 1-on-1', 'Café', 'Small dinner table'], 'Boba shop, 1-on-1')}
        ${field('area', 'Area', S.me.city || '', { req: true, ph: "e.g. Taipei, Da'an" })}
      </div>
      <div class="row2">
        ${field('date', 'Date', '', { type: 'date', req: true, min: today })}
        ${select('time', 'Time', ['12:00', '15:00', '19:00'], '15:00')}
      </div>
      <p class="hint">Demo mode: this is saved in the chat, but no table is really booked.</p>
      <p class="error" id="book-error" hidden>Please add an area and a date.</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" type="submit">Send invite</button>
        <button class="btn btn--ghost btn--sm" data-act="book-close" type="button">Cancel</button>
      </div>
    </form>` : ''}

    ${t.booking ? `<p class="booking"><i class="ph ph-calendar-check" aria-hidden="true"></i>${esc(t.booking.label)}</p>` : ''}

    <ul class="log" id="log">${bubbles(t.msgs, U.typing[t.id])}</ul>

    ${cold
      ? `<p class="cold"><i class="ph ph-snowflake" aria-hidden="true"></i>This cup went cold. Nobody replied for ${CLOSE_AFTER_DAYS} days, so the chat closed.</p>`
      : t.status === 'open'
        ? `<div class="devrow"><button class="btn btn--ghost btn--sm" data-act="dev-time" data-id="${t.id}" type="button">Dev: +5 min</button><button class="btn btn--ghost btn--sm" data-act="dev-days" data-id="${t.id}" type="button">Dev: +${CLOSE_AFTER_DAYS} days</button></div>`
        : ''}

    ${cold ? '' : t.status === 'pending'
      ? `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>Waiting for them to accept your response</p>`
      : `<form class="composer" data-form="msg" data-id="${t.id}">
          <label class="sr" for="c-msg">Message</label>
          <input id="c-msg" name="msg" autocomplete="off" placeholder="Say something">
          <button class="btn btn--dark" type="submit" aria-label="Send"><i class="ph ph-paper-plane-right" aria-hidden="true"></i></button>
        </form>`}
  </section>`;
}

/* ---------- Screen: About ---------- */

// Small grey line that explains a boba word in plain language
const explain = (html) => `<p class="explain"><i class="ph ph-info" aria-hidden="true"></i><span>${html}</span></p>`;

const GLOSSARY = [
  ['My order', 'ph-receipt', 'Your profile. It shows what you are working on, never your titles.'],
  ['Flavor', 'ph-drop', 'Your field. Each field is a boba flavor and sets the colour of your cup.'],
  ['Sugar', 'ph-chart-line-up', 'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.'],
  ['Explore', 'ph-compass', 'Browse open thoughts and questions. Reply with your view to start talking.'],
  ['Brew', 'ph-hammer', 'Build something together. Post what you need, or apply to a post without showing your titles.'],
  ['Mystery Cup', 'ph-sparkle', 'A surprise match once a week. Everyone joins at the same time and you cannot pick who you get.'],
  ['First Sip', 'ph-chat-circle', 'Your first conversation with someone. Real names are still hidden.'],
  ['Pop the seal', 'ph-lock-simple-open', 'Show your real name, school, company and title. It only happens when both of you press it.'],
  ['Refill', 'ph-arrows-clockwise', 'At the end of a Mystery Cup, you both choose Refill to keep talking.'],
  ['Gone cold', 'ph-snowflake', 'A chat closes if nobody replies for 3 days.'],
  ['Boba run', 'ph-person-simple-walk', 'Meet in person, at a boba shop or a café.'],
];

function viewAbout() {
  const next = S.me
    ? '<a class="btn btn--primary" href="#/explore">Back to Explore</a>'
    : '<a class="btn btn--primary" href="#/">Start sipping</a>';
  return `
  <article class="about">
    <header class="about__hero">
      <div>
        <h1>Boba chat, not coffee chat.</h1>
        <p class="lead">Half Sugar is a place to meet people by talking first. Schools, companies and job titles stay hidden until you both want to share them.</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </header>

    <section class="about__block">
      <h2>Why we built it</h2>
      <p>Networking today leans on résumés. People decide whether you are worth talking to before you say a word. So networking turns into a performance, people from different fields rarely meet, and lots of online matches never become a real conversation.</p>
    </section>

    <section class="about__pair">
      <div class="about__card">
        <h2>Why boba</h2>
        <p>A coffee chat sounds like a meeting. Grabbing boba sounds like hanging out with a friend. We want that second feeling, because good collaborations often start in relaxed conversations.</p>
      </div>
      <div class="about__card about__card--sugar">
        <h2>Why half sugar</h2>
        <p>Not too sweet, not too serious. Half sugar is the order for people who want balance: less performing, and still something real to take home. It is also the moment a chat reaches 50%, when you can finally see who you have been talking to.</p>
      </div>
    </section>

    <section class="about__block">
      <h2>How it works</h2>
      <ol class="steps">
        <li><strong>Fill in your order.</strong> Say what you are working on. Your titles stay sealed.</li>
        <li><strong>Take a first sip.</strong> Reply to a thought in Explore, apply to a Brew, or join the weekly Mystery Cup.</li>
        <li><strong>Reach half sugar, then pop the seal.</strong> Sugar goes up as you talk. At 50%, if you both want to, show each other who you are.</li>
        <li><strong>Keep it warm.</strong> Keep talking, build something, or go on a boba run and meet in person. A chat goes cold after 3 days with no reply.</li>
      </ol>
    </section>

    <section class="about__block">
      <h2>The menu</h2>
      <p class="about__hint">What our boba words mean.</p>
      <dl class="glossary">
        ${GLOSSARY.map(([term, icon, text]) => `<div><dt><i class="ph ${icon}" aria-hidden="true"></i>${term}</dt><dd>${text}</dd></div>`).join('')}
      </dl>
      <h3 class="flavors__title">Flavors</h3>
      <ul class="flavors">
        ${FIELDS.map((f) => `<li><span class="flavor" style="--flavor:${flavor(f)[1]}">${esc(flavor(f)[0])}</span>${esc(f)}</li>`).join('')}
      </ul>
    </section>

    <section class="about__belief">
      <p>Conversation before credentials.</p>
      <p>Meet the person before the résumé.</p>
      <p class="accent">Meet. Think. Build.</p>
      <div class="btnrow btnrow--center">${next}</div>
    </section>
  </article>`;
}

/* ---------- Shell ---------- */

const NAV = [
  ['explore', 'Explore', 'ph-compass', 'Browse ideas'],
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
      <a class="logo" href="#/explore" aria-label="Half Sugar home">${LOGO}</a>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([name, label, icon, desc]) => `
        <a href="#/${name}" ${route.name === name ? 'aria-current="page"' : ''}>
          <i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span>${label}</span><small>${desc}</small></span>
          ${name === 'chats' && unread ? `<span class="badge" aria-label="${unread} unread">${unread}</span>` : ''}
        </a>`).join('')}
      </nav>
      <a class="side__about" href="#/about" ${route.name === 'about' ? 'aria-current="page"' : ''}><i class="ph ph-info" aria-hidden="true"></i>What is Half Sugar?</a>
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
    S.me = data;
    save();
    if (first) { lastPath = null; go('explore'); render({ fresh: true }); } else { toast('Saved'); render(); }
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
    S.myPosts.unshift(item);
    U.compose = null;
    save();
    render({ fresh: true });
    scheduleIncoming(item, 'post');
  },

  respond(form, data) {
    if (!data.reply) { $('#f-reply', form).focus(); return; }
    const seed = SEED_THOUGHTS.find((t) => t.id === form.dataset.id);
    const t = createThread(seed.by, 'explore', seed.id, 'pending', `You responded to this thought: "${seed.text}"`);
    t.msgs.push({ from: 'me', text: data.reply, at: Date.now() });
    U.target = null;
    save();
    go('chats/' + t.id);
    scheduleAccept(t);
  },

  apply(form, data) {
    if (!data.reply) { $('#f-reply', form).focus(); return; }
    const seed = SEED_POSTS.find((b) => b.id === form.dataset.id);
    const t = createThread(seed.by, 'build', seed.id, 'pending', `You applied anonymously to this post: "${seed.title}"`);
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
    const day = new Date(`${data.date}T${data.time}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    t.booking = { ...data, label: `${day}, ${data.time}. ${data.kind}, ${data.area}` };
    U.booking = null;
    pushMsg(t, 'sys', `You suggested a boba run: ${t.booking.label}.`);
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
    const intro = key === 'thought' ? `They responded to your thought: "${item.text}"` : `They applied anonymously to your post: "${item.title}"`;
    const t = createThread(resp.pid, key === 'thought' ? 'explore' : 'build', item.id + resp.pid, 'open', intro);
    t.msgs.push({ from: 'them', text: resp.text, at: Date.now() });
    save();
    go('chats/' + t.id);
  },

  decline(el) { takeResponse(el); save(); render(); },

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
    toast('Call room opened in a new tab');
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

  // Development shortcut: skip onboarding with a sample card. Remove before launch.
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

  'dev-skip'() {
    S.me = { alias: 'Dev', city: 'Taipei', field: 'Design', doing: 'Testing Half Sugar', topics: 'Networking, Product', proof: '', name: 'Dev User', title: 'Builder', school: '', company: '', linkedin: '' };
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

document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-filter]');
  if (!el) return;
  U.f[el.dataset.filter] = el.value;
  render();
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
