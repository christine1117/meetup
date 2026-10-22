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

// Someone can have two fields, like a layered two-flavor drink. The first one is their main field.
const fieldsOf = (p) => [p.field, p.field2].filter(Boolean);
const fieldsLabel = (p) => fieldsOf(p).map(fieldName).join(' + ');
const flavorsLabel = (p) => fieldsOf(p).map(flavorName).join(' + ');
const drinkFor = (p) => (p.field2 ? L`${flavorsLabel(p)} milk tea` : drinkName(p.field));

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
    learnWeights();
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
    <rect x="0" y="${y}" width="24" height="28" fill="${o.color2 || color}" clip-path="url(#${id})"/>
    ${o.color2 ? `<rect x="0" y="${((+y + 27) / 2).toFixed(1)}" width="24" height="28" fill="${color}" clip-path="url(#${id})"/>` : ''}
    ${level > 0 ? `<g fill="var(--pearl)" clip-path="url(#${id})"><circle cx="8.7" cy="24.4" r="1.6"/><circle cx="12" cy="25" r="1.6"/><circle cx="15.3" cy="24.4" r="1.6"/><circle cx="10.4" cy="21.6" r="1.6"/><circle cx="13.6" cy="21.6" r="1.6"/></g>` : ''}
    <path d="M14.6 1.4 11.8 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="${CUP_PATH}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    ${o.mark ? `<text x="8.6" y="18.4" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor">${o.mark}</text>` : ''}
  </svg>`;
}
const cupFor = (p, cls = '') => cup(flavor(p.field)[1], { cls, color2: p.field2 ? flavor(p.field2)[1] : '' });

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

// Explore is a forum. Each post sits in a topic, has an age in minutes, and a few public comments.
const CATEGORIES = [
  ['tech', 'Tech'],
  ['startups', 'Startups'],
  ['design', 'Design'],
  ['science', 'Science & research'],
  ['society', 'Society & cities'],
  ['creative', 'Writing & creative'],
  ['career', 'Work & career'],
];
const catName = (k) => L((CATEGORIES.find(([v]) => v === k) || CATEGORIES[1])[1]);

const SEED_THOUGHTS = [
  {
    id: 't1', by: 'p2', cat: 'society', ago: 190,
    text: 'If a city gives away its data for free, who should be responsible when someone builds something harmful with it?',
    comments: [
      { by: 'p5', ago: 150, text: 'Researchers ask this too. We publish our air data and still worry about how it gets used.' },
      { by: 'p3', ago: 95, text: 'Whoever sells a product built on it should carry the risk, not the city.' },
    ],
  },
  {
    id: 't2', by: 'p5', cat: 'science', ago: 420,
    text: 'Everyone says "build what users want". But as a researcher, how do I even know who my user is?',
    comments: [
      { by: 'p1', ago: 380, text: 'Find the person who is annoyed enough to email you twice. That is your user.' },
      { by: 'p7', ago: 300, text: 'Run one small pilot. The first person who asks to keep using it is your user.' },
    ],
  },
  {
    id: 't3', by: 'p4', cat: 'creative', ago: 75,
    text: 'Is a newsletter a product or a habit? I cannot tell which one I am building.',
    comments: [
      { by: 'p6', ago: 40, text: 'If people miss it when it is late, it is a habit. If they pay to keep it, it is a product.' },
    ],
  },
  {
    id: 't4', by: 'p8', cat: 'career', ago: 1500,
    text: 'If you took over a family business, how did you convince your parents to let you try something new?',
    comments: [
      { by: 'p3', ago: 1320, text: 'I showed my parents numbers from a small test first. Arguments did not work, results did.' },
    ],
  },
  {
    id: 't5', by: 'p3', cat: 'startups', ago: 260,
    text: 'What is one thing that works in your city that would never work in mine? I am collecting examples.',
    comments: [
      { by: 'p8', ago: 210, text: 'Cash on delivery. Everyone told me online prepayment would win here. It did not.' },
      { by: 'p2', ago: 120, text: 'Bike sharing without docks. Great in one city, chaos in the next.' },
    ],
  },
  {
    id: 't6', by: 'p6', cat: 'design', ago: 30,
    text: 'Designers: when did you last change your mind because an engineer was right?',
    comments: [
      { by: 'p7', ago: 12, text: 'Last week. The engineer showed the design would break on slow phones.' },
    ],
  },
  {
    id: 't7', by: 'p7', cat: 'tech', ago: 600,
    text: 'Is running AI on the device worth the pain for a small team, or should we just use the cloud?',
    comments: [
      { by: 'p2', ago: 560, text: 'Cloud first. Move only the part users actually notice onto the device.' },
    ],
  },
  {
    id: 't8', by: 'p1', cat: 'startups', ago: 900,
    text: 'How do you price a tool for tiny shops that already think software is too expensive?',
    comments: [
      { by: 'p3', ago: 840, text: 'Charge per week, not per month. Small shops think in weeks.' },
    ],
  },
];

// Brew posts: what kind of project, and the roles it needs. The author ticks a role off once it is filled.
const BREW_KINDS = [
  ['competition', 'Competition'],
  ['hackathon', 'Hackathon'],
  ['startup', 'Startup'],
  ['side', 'Side project'],
  ['research', 'Research'],
  ['course', 'Course project'],
  ['other', 'Other'],
];
const kindName = (k) => L((BREW_KINDS.find(([v]) => v === k) || BREW_KINDS[6])[1]);
const hasEvent = (k) => k === 'competition' || k === 'hackathon';
const ROLE_SUGGESTIONS = ['Frontend developer', 'Backend developer', 'Designer', 'Product manager', 'Data analyst', 'Researcher', 'Marketer', 'Writer', 'Pitch presenter'];
const MAX_ROLES = 6;

const SEED_POSTS = [
  {
    id: 'b5', by: 'p5', kind: 'hackathon', event: 'Taipei Climate Hackathon', deadline: '2026-11-28',
    title: 'Joining a climate hackathon with our indoor air data. Need two more people.',
    roles: [{ name: 'Frontend developer', filled: false }, { name: 'Designer', filled: false }, { name: 'Data analyst', filled: true }],
    offer: 'Real sensor data from 23 homes', duration: 'Two weekends',
  },
  {
    id: 'b1', by: 'p1', kind: 'side',
    title: 'Building a checker for second-hand cameras.',
    roles: [{ name: 'Hardware sourcing expert', filled: false }, { name: 'Inspection process expert', filled: true }],
    offer: 'Front-end development and a list of 40 sellers', duration: 'Six-week project',
  },
  {
    id: 'b2', by: 'p7', kind: 'startup',
    title: 'Making clinic software that nurses do not hate.',
    roles: [{ name: 'Designer', filled: false }],
    offer: 'A working speech model and three clinics to test in', duration: 'Two-week sprint',
  },
  {
    id: 'b6', by: 'p4', kind: 'competition', event: 'Asia Story Prize', deadline: '2026-12-15',
    title: 'Entering a nonfiction prize with a story about one factory family.',
    roles: [{ name: 'Photographer', filled: false }, { name: 'Editor', filled: true }],
    duration: 'Six weeks',
  },
  {
    id: 'b3', by: 'p3', kind: 'startup',
    title: 'Need someone to challenge my pricing before I launch in a second city.',
    roles: [{ name: 'Pricing reviewer', filled: false }],
    offer: 'Real numbers from 1,300 users', duration: 'One or two calls',
  },
  {
    id: 'b4', by: 'p8', kind: 'startup',
    title: 'Building a produce ordering system for restaurants.',
    roles: [{ name: 'Backend developer', filled: true }, { name: 'Chat bot developer', filled: false }],
    offer: '9 restaurant customers and real daily orders', duration: 'Two months, revenue share is possible',
  },
];

// Older saved posts had a single "need" line instead of roles
const rolesOf = (b) => b.roles || (b.need ? [{ name: b.need, filled: false }] : []);
const openRoles = (b) => rolesOf(b).filter((r) => !r.filled);

/* ---------- Matching ----------
   1. Who can show up: people you do not have a chat with yet.
   2. Score each person from six things (see DEFAULT_WEIGHTS), in both
      directions: "is this person good for you" and "are you good for them".
      Keep the lower one, so a match has to work for both people.
   3. Highest first, no more than two people from one field.
   4. Every chat remembers the score it started with. Once enough chats have
      finished, the weights move toward what actually led to good chats
      (reaching half sugar). */

// What people are curious about, and what they can share. Free tags, with suggestions to tap.
const TAG_SUGGESTIONS = [
  'AI products', 'AI in supply chains', 'Supply chains', 'Semiconductors', 'Chip packaging', 'Hardware',
  'Pricing', 'Fundraising', 'Sales', 'Marketing', 'Branding', 'Product design', 'User research', 'Data analysis',
  'Fintech', 'Health tech', 'Climate tech', 'Open data', 'Education', 'Writing', 'Community building',
  'Small business', 'Side projects', 'Hiring', 'Job interviews', 'Career change', 'Studying abroad', 'Working abroad',
];
const MAX_TAGS = 6;

// Compare tags loosely: case, spacing and a plural "s" do not matter,
// and a longer tag counts if it contains a shorter one ("supply chain" in "AI in supply chains")
const normTag = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim().replace(/s\b/g, '');
const tagsMatch = (a, b) => {
  const x = normTag(a);
  const y = normTag(b);
  return x === y || (x.length > 3 && y.includes(x)) || (y.length > 3 && x.includes(y));
};
// The tags in `wants` that someone's `has` list covers
const overlapTags = (wants, has) => (wants || []).filter((w) => (has || []).some((h) => tagsMatch(w, h)));

const STAGES = [
  ['startup', 'Building a startup'],
  ['side', 'Working on a side project'],
  ['research', 'Doing research'],
  ['study', 'Studying'],
  ['job', 'Working at a company'],
  ['exploring', 'Still figuring it out'],
];
const MEETS = [['online', 'Online'], ['inperson', 'In person'], ['both', 'Either is fine']];

// relevance: they can share what you are curious about, shared curiosity, the same stage, shared work words.
// complement: different fields. reliable: how often they reply. active: visited recently.
// nearby: the same city. fresh: a little daily luck so picks change from day to day.
const DEFAULT_WEIGHTS = { relevance: 0.35, complement: 0.2, reliable: 0.2, active: 0.1, nearby: 0.1, fresh: 0.05 };
const weights = () => S.weights || DEFAULT_WEIGHTS;

const TOP_PICKS = 3;
const BREW_TOP_PICKS = 2;
const BREW_SEND_TO = 4;
const SAME_FIELD_LIMIT = 2; // top picks never hold more than this many people from one field
const PRIOR_CHATS = 5;      // how much someone's starting reply rate counts against real history
const LEARN_AFTER = 20;     // finished chats needed before the weights start to move
const LEARN_STEP = 0.05;    // how much weight moves each time
const MIN_WEIGHT = 0.05;    // no factor ever drops below this

// Simulated people: curiosities, what they can share, stage, how they like to meet,
// a starting reply rate, and days since their last visit
const PEOPLE_EXTRA = {
  p1: { field2: 'Engineering', curious: ['Pricing', 'Sales', 'Small business'], share: ['Product design', 'User research', 'Side projects'], stage: 'side', meet: 'both', replyRate: 0.9, activeDays: 0 },
  p2: { curious: ['Climate tech', 'Community building', 'Fundraising'], share: ['Open data', 'Data analysis', 'Working abroad'], stage: 'side', meet: 'online', replyRate: 0.7, activeDays: 2 },
  p3: { curious: ['Product design', 'Hiring', 'AI products'], share: ['Fintech', 'Small business', 'Fundraising'], stage: 'startup', meet: 'online', replyRate: 0.85, activeDays: 1 },
  p4: { curious: ['Community building', 'Pricing', 'Supply chains'], share: ['Writing', 'Branding', 'Studying abroad'], stage: 'side', meet: 'online', replyRate: 0.6, activeDays: 3 },
  p5: { field2: 'Engineering', curious: ['Product design', 'Health tech', 'Career change'], share: ['Data analysis', 'Hardware', 'Studying abroad'], stage: 'research', meet: 'inperson', replyRate: 0.8, activeDays: 1 },
  p6: { curious: ['Fintech', 'Sales', 'Side projects'], share: ['Branding', 'Product design', 'Working abroad'], stage: 'startup', meet: 'online', replyRate: 0.75, activeDays: 0 },
  p7: { curious: ['User research', 'Health tech', 'Semiconductors'], share: ['AI products', 'Job interviews', 'Hardware'], stage: 'job', meet: 'online', replyRate: 0.95, activeDays: 0 },
  p8: { curious: ['AI in supply chains', 'Side projects', 'Hiring'], share: ['Supply chains', 'Sales', 'Small business'], stage: 'startup', meet: 'inperson', replyRate: 0.65, activeDays: 4 },
};
PEOPLE.forEach((p) => {
  Object.assign(p, PEOPLE_EXTRA[p.id]);
  p.thought = (SEED_THOUGHTS.find((t) => t.by === p.id) || {}).text;
});

const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const hashNum = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Your tags. Older cards had broad topics, which count as things you are curious about.
const myCurious = () => {
  if (!S.me) return [];
  if (Array.isArray(S.me.curious)) return S.me.curious;
  if (Array.isArray(S.me.interests)) return S.me.interests;
  return String(S.me.topics || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
};
const myShare = () => (S.me && Array.isArray(S.me.share) ? S.me.share : []);

// Mystery Cup anchor, best first.
// swap: each can share what the other is curious about. theyShare / youShare: one direction.
// both: curious about the same thing. work: a word from what you both work on.
function anchorOf(p) {
  const learn = overlapTags(myCurious(), p.share); // they can share it with you
  const teach = overlapTags(myShare(), p.curious); // your tag that they are curious about
  if (learn.length && teach.length) return { kind: 'swap', a: learn[0], b: teach[0], weight: 14 };
  if (learn.length) return { kind: 'theyShare', a: learn[0], weight: 10 };
  if (teach.length) return { kind: 'youShare', a: teach[0], weight: 10 };
  const both = overlapTags(myCurious(), p.curious);
  if (both.length) return { kind: 'both', a: both[0], weight: 8 };
  const mine = meAsPerson().words;
  const word = [...asCandidate(p).words].find((w) => mine.has(w));
  return word ? { kind: 'work', a: word, weight: 5 } : null;
}

function anchorLabel(x) {
  if (x.kind === 'swap') return L`Swap: they know ${x.a}, you know ${x.b}`;
  if (x.kind === 'theyShare') return L`They can share: ${x.a}`;
  if (x.kind === 'youShare') return L`You can share: ${x.a}`;
  if (x.kind === 'both') return L`Both curious: ${x.a}`;
  return L`In common: ${x.a}`;
}

// The first note in a Mystery Cup chat, built around the anchor (stored as English keys for translation)
const ANCHOR_OPENERS = {
  swap: 'You can trade: they know {0}, you know {1}. Start with whichever you are more curious about.',
  theyShare: 'They can share about {0}, which you are curious about. Ask where they would start.',
  youShare: 'They are curious about {0}, and you can share it. Ask what they want to know.',
  both: 'You are both curious about {0}. Start there: what got you interested?',
  work: 'You both care about {0}. Start there: how does it show up in your work?',
};

// The meaningful words in what someone works on. A real version would use AI to compare meaning.
const STOP_WORDS = new Set(['about', 'after', 'also', 'because', 'from', 'have', 'into', 'just', 'like', 'more', 'that', 'their', 'them', 'they', 'this', 'what', 'when', 'with', 'your', 'tool', 'people', 'someone', 'something', 'looking', 'building', 'working', 'every', 'cannot', 'should',
  'running', 'using', 'making', 'getting', 'doing', 'trying', 'small', 'team', 'worth', 'would',
  'could', 'there', 'which', 'where', 'other', 'only', 'even', 'much', 'many', 'some', 'first',
  'really', 'think', 'know', 'want', 'need', 'find', 'make', 'take', 'thing', 'way', 'new']);
const wordsOf = (text) => new Set((String(text || '').toLowerCase().match(/[a-z]{4,}/g) || [])
  .map((w) => w.replace(/s$/, ''))
  .filter((w) => w.length > 3 && !STOP_WORDS.has(w)));

// Share of chats where you wrote back after they wrote to you. Starts at 0.8 with no history.
function myReplyRate() {
  const theyWrote = S.threads.filter((t) => t.msgs.some((m) => m.from === 'them'));
  if (!theyWrote.length) return 0.8;
  const replied = theyWrote.filter((t) => {
    const first = t.msgs.findIndex((m) => m.from === 'them');
    return t.msgs.slice(first + 1).some((m) => m.from === 'me');
  });
  return replied.length / theyWrote.length;
}

// Their starting reply rate, corrected by whether they actually wrote back to you
function replyRateOf(p) {
  const chats = S.threads.filter((t) => t.pid === p.id && t.msgs.some((m) => m.from === 'me'));
  const replied = chats.filter((t) => {
    const first = t.msgs.findIndex((m) => m.from === 'me');
    return t.msgs.slice(first + 1).some((m) => m.from === 'them');
  }).length;
  return (p.replyRate * PRIOR_CHATS + replied) / (PRIOR_CHATS + chats.length);
}

// Days since they were last seen: their last message to you, or their starting value
function activeDaysOf(p) {
  const times = S.threads.filter((t) => t.pid === p.id).flatMap((t) => t.msgs.filter((m) => m.from === 'them' && m.at).map((m) => m.at));
  return times.length ? Math.min(p.activeDays, (Date.now() - Math.max(...times)) / 86400000) : p.activeDays;
}

// Everyone, you included, in the same shape for scoring
const asCandidate = (p) => ({ ...p, replyRate: replyRateOf(p), activeDays: activeDaysOf(p), words: wordsOf(`${p.doing} ${p.thought || ''}`) });
const meAsPerson = () => ({
  id: 'me', field: S.me.field, field2: S.me.field2, curious: myCurious(), share: myShare(), stage: S.me.stage,
  meet: S.me.meet || 'both', city: S.me.city, replyRate: myReplyRate(), activeDays: 0,
  words: wordsOf([S.me.doing, ...S.myThoughts.map((t) => t.text), ...S.myPosts.map((b) => `${b.title} ${rolesOf(b).map((r) => r.name).join(' ')}`)].join(' ')),
});

const meetsFit = (a, b) => a === 'both' || b === 'both' || a === b;
const sameCity = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Each factor from 0 to 1, for how good `to` is for `from`
function scoreParts(from, to, seed) {
  const offers = overlapTags(from.curious, to.share).length; // `to` can share what `from` is curious about
  const sameCuriosity = overlapTags(from.curious, to.curious).length;
  const sharedWords = [...from.words].filter((w) => to.words.has(w)).length;
  const overlap = fieldsOf(from).filter((f) => fieldsOf(to).includes(f)).length;
  return {
    relevance: Math.min(1, offers * 0.35 + sameCuriosity * 0.15 + Math.min(2, sharedWords) * 0.1 + (from.stage && from.stage === to.stage ? 0.15 : 0)),
    // No field in common is best; sharing one of two fields still counts half
    complement: overlap === 0 ? 1 : overlap < Math.max(fieldsOf(from).length, fieldsOf(to).length) ? 0.5 : 0,
    reliable: to.replyRate ?? 0.8,
    active: Math.max(0, 1 - (to.activeDays || 0) / 7),
    // Same city counts fully when both are open to meeting in person
    nearby: sameCity(from.city, to.city) ? (from.meet !== 'online' && to.meet !== 'online' ? 1 : 0.5) : 0,
    fresh: (hashNum(seed + [from.id, to.id].sort().join()) % 100) / 100,
  };
}

const weigh = (parts) => Object.entries(weights()).reduce((sum, [k, w]) => sum + w * parts[k], 0);

// How good `to` is for `from`, from 0 to 1
function oneWay(from, to, seed) {
  const score = weigh(scoreParts(from, to, seed));
  // One wants online only and the other in person only: still possible, but less likely to happen
  return meetsFit(from.meet, to.meet) ? score : score * 0.5;
}

// Both directions have to work, so the match score is the lower of the two
function matchScore(p, seed) {
  const me = meAsPerson();
  const them = asCandidate(p);
  return Math.min(oneWay(me, them, seed), oneWay(them, me, seed));
}

// People you already have a chat with are not recommended again
function topPicks(people, n, seed) {
  const met = new Set(S.threads.map((t) => t.pid));
  const ranked = people.filter((p) => !met.has(p.id)).sort((a, b) => matchScore(b, seed) - matchScore(a, seed));
  const out = [];
  ranked.forEach((p) => {
    if (out.length < n && out.filter((x) => x.field === p.field).length < SAME_FIELD_LIMIT) out.push(p);
  });
  return out;
}

// Who a new Brew is sent to: people who can share what it needs, reliable people first
function brewMatches(item) {
  const text = `${item.title} ${rolesOf(item).map((r) => r.name).join(' ')}`.toLowerCase();
  const score = (p) => p.share.filter((t) => text.includes(normTag(t))).length * 3
    + [p.field, p.field2].filter((w) => w && text.includes(w.toLowerCase())).length
    + replyRateOf(p) + (hashNum(item.id + p.id) % 100) / 100;
  return [...PEOPLE].sort((a, b) => score(b) - score(a)).slice(0, BREW_SEND_TO).map((p) => p.id);
}

/* ---------- Scorecard ----------
   A chat is "good" if it reached half sugar. A finished chat either got
   there or went cold. */

// Save the factors a chat started with
function stampMatch(t) {
  t.match = { parts: scoreParts(meAsPerson(), asCandidate(P[t.pid]), dayKey()), at: Date.now() };
}

const outcomeOf = (t) => ({
  replied: t.msgs.some((m) => m.from === 'them') && t.msgs.some((m) => m.from === 'me'),
  half: sugarOf(t) >= REVEAL_AT,
  popped: t.reveal.me && t.reveal.them,
  bobaRun: !!t.booking,
});

// With enough finished chats, move a little weight from the factor that tells good
// and bad chats apart the least, to the one that tells them apart the most
function learnWeights() {
  const finished = S.threads.filter((t) => t.match && (outcomeOf(t).half || isCold(t)));
  const good = finished.filter((t) => outcomeOf(t).half);
  const bad = finished.filter((t) => !outcomeOf(t).half);
  if (finished.length < LEARN_AFTER || good.length < 5 || bad.length < 5) return;
  const avg = (list, k) => list.reduce((sum, t) => sum + (t.match.parts[k] || 0), 0) / list.length;
  const keys = Object.keys(DEFAULT_WEIGHTS).filter((k) => k !== 'fresh');
  const gap = Object.fromEntries(keys.map((k) => [k, avg(good, k) - avg(bad, k)]));
  const w = { ...weights() };
  const up = keys.reduce((a, b) => (gap[b] > gap[a] ? b : a));
  // Take from the factor that helps least; on a tie, take from the smaller weight so key factors are not drained
  const down = keys.filter((k) => k !== up && w[k] - LEARN_STEP >= MIN_WEIGHT)
    .sort((a, b) => gap[a] - gap[b] || w[a] - w[b])[0];
  if (!down || gap[up] <= gap[down]) return;
  w[up] = +(w[up] + LEARN_STEP).toFixed(2);
  w[down] = +(w[down] - LEARN_STEP).toFixed(2);
  S.weights = w;
}

// The scorecard and weights, shown in My order
function viewAlgorithm() {
  const chats = S.threads.filter((t) => t.match);
  const count = (k) => chats.filter((t) => outcomeOf(t)[k]).length;
  const finished = chats.filter((t) => outcomeOf(t).half || isCold(t)).length;
  const pct = (n) => (chats.length ? Math.round((n / chats.length) * 100) : 0);
  const names = { relevance: L`Relevance`, complement: L`Different fields`, reliable: L`Replies`, active: L`Recently active`, nearby: L`Same city`, fresh: L`Daily luck` };
  return `
  <section class="panel algo">
    <h2>${L`How your picks are chosen`}</h2>
    <p class="hint">${L`Scored from both sides. Weights adjust after ${LEARN_AFTER} finished chats (now ${finished}).`}</p>
    <ul class="algo__weights">
      ${Object.entries(weights()).map(([k, w]) => `<li><span>${names[k]}</span><strong>${Math.round(w * 100)}%</strong></li>`).join('')}
    </ul>
    <h3>${L`Scorecard`}</h3>
    <ul class="algo__funnel">
      <li><span>${L`Chats started`}</span><strong>${chats.length}</strong></li>
      <li><span>${L`Both replied`}</span><strong>${count('replied')} (${pct(count('replied'))}%)</strong></li>
      <li><span>${L`Reached half sugar`}</span><strong>${count('half')} (${pct(count('half'))}%)</strong></li>
      <li><span>${L`Popped the seal`}</span><strong>${count('popped')} (${pct(count('popped'))}%)</strong></li>
      <li><span>${L`Boba runs`}</span><strong>${count('bobaRun')} (${pct(count('bobaRun'))}%)</strong></li>
    </ul>
    ${S.weights ? `<button class="btn btn--ghost btn--sm" data-act="reset-weights" type="button">${L`Reset weights`}</button>` : ''}
  </section>`;
}

/* ---------- State ---------- */

const blank = () => ({ me: null, myThoughts: [], myPosts: [], threads: [], drops: 0 });

function load() {
  try {
    const saved = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    // Old or damaged data: keep lists as lists and drop chats with people who no longer exist
    ['myThoughts', 'myPosts', 'threads'].forEach((k) => { if (!Array.isArray(saved[k])) saved[k] = []; });
    if (saved.me && typeof saved.me !== 'object') saved.me = null;
    saved.threads = saved.threads.filter((t) => t && P[t.pid] && Array.isArray(t.msgs));
    return saved;
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
const U = {
  compose: null, target: null, booking: null, typing: {}, confirmReset: false,
  cat: 'all', dm: null, typingPost: null,
  draft: { kind: 'side', roles: [] },
  quiz: { step: 0, field: '', field2: '', stage: '', curious: [], share: [], meet: '', city: '' },
};
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


const brief = (p) => `
  <dl class="brief">
    <div><dt>${L`Flavor`}</dt><dd>${esc(drinkFor(p))} (${esc(fieldsLabel(p))})</dd></div>
    <div><dt>${L`Working on`}</dt><dd>${esc(p.doing)}</dd></div>
    ${p.proof ? `<div><dt>${L`Proof of work`}</dt><dd>${esc(p.proof)}</dd></div>` : ''}
    ${p.curious ? `<div><dt>${L`Curious about`}</dt><dd>${esc(p.curious.join(', '))}</dd></div>` : ''}
    ${p.share ? `<div><dt>${L`Can share`}</dt><dd>${esc(p.share.join(', '))}</dd></div>` : ''}
  </dl>`;

const byline = (p) => `
  <p class="byline">
    <span class="avatar avatar--cup" aria-hidden="true">${cupFor(p)}</span>
    <span><strong>${esc(p.alias)}</strong> <span class="flavor" style="--flavor:${flavor(p.field)[1]};--flavor2:${flavor(p.field2 || p.field)[1]}" title="${esc(L`Flavor = field. ${flavorsLabel(p)} means ${fieldsLabel(p)}.`)}">${esc(flavorsLabel(p))}</span><br><small>${L`${esc(fieldsLabel(p))}. ${esc(p.doing)}`}</small></span>
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

function createThread(pid, origin, ref, status, intro, vars) {
  const t = { id: uid(), pid, origin, ref, status, msgs: [], li: 0, reveal: { me: false, them: false }, booking: null, unread: 0, at: Date.now() };
  if (intro) t.msgs.push({ from: 'sys', text: intro, vars, at: Date.now() });
  stampMatch(t);
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
  item.seen = item.seen || (item.responses || item.comments || []).map((r) => r.pid || r.by);
  if (item.seen.length >= 2) return;
  later(4000 + Math.random() * 3000, () => {
    const list = key === 'thought' ? S.myThoughts : S.myPosts;
    if (!list.includes(item) || item.seen.length >= 2) return;
    if (key === 'post' && !openRoles(item).length) return;
    const pool = key === 'post' && item.sentTo ? PEOPLE.filter((x) => item.sentTo.includes(x.id)) : PEOPLE;
    const left = pool.filter((x) => !item.seen.includes(x.id));
    if (!left.length) return;
    const p = pick(left);
    item.seen.push(p.id);
    if (key === 'thought') (item.comments = item.comments || []).push({ by: p.id, text: p.take, at: Date.now() });
    else item.responses.push({ pid: p.id, text: p.pitch, role: pick(openRoles(item)).name });
    save();
    toast(key === 'thought' ? L`Someone commented on your post` : L`Someone applied to your post`);
    render();
    scheduleIncoming(item, key);
  });
}

/* ---------- Screen: profile ---------- */

// Type tags (Enter or a comma adds one) or tap a suggestion. scope is 'quiz' or 'me'.
function tagEditor(scope, key, list, label) {
  const left = TAG_SUGGESTIONS.filter((x) => !list.some((t) => normTag(t) === normTag(x))).slice(0, scope === 'me' ? 8 : 14);
  return `
      <div class="field tags" role="group" aria-labelledby="${key}-label">
        <p class="field__label" id="${key}-label">${label}</p>
        ${list.length ? `<ul class="tags__list">${list.map((t) => `<li class="tag-chip">${esc(t)}<button type="button" data-act="tag-remove" data-scope="${scope}" data-key="${key}" data-value="${esc(t)}" aria-label="${esc(L`Remove ${t}`)}"><i class="ph ph-x" aria-hidden="true"></i></button></li>`).join('')}</ul>` : ''}
        ${list.length < MAX_TAGS ? `
        <div class="tags__add">
          <input id="c-tag-${key}" data-tag-input data-scope="${scope}" data-key="${key}" autocomplete="off" aria-label="${esc(label)}" placeholder="${esc(L`Type and press Enter`)}">
          <button class="btn btn--ghost btn--sm" data-act="tag-add" data-scope="${scope}" data-key="${key}" type="button">${L`Add`}</button>
        </div>
        <div class="tags__suggest">${left.map((x) => `<button class="cat cat--sm" data-act="tag-add" data-scope="${scope}" data-key="${key}" data-value="${esc(x)}" type="button">+ ${esc(x)}</button>`).join('')}</div>` : `<p class="hint">${L`Up to ${MAX_TAGS}.`}</p>`}
      </div>`;
}

// The list a tag button edits: your saved card, or the onboarding answers
function tagList(scope, key) {
  if (scope !== 'me') return U.quiz[key];
  if (!Array.isArray(S.me[key])) S.me[key] = key === 'curious' ? [...myCurious()] : [];
  return S.me[key];
}

// The first-time form skips what the quick questions already asked
function profileForm(me, first) {
  me = me || {};
  return `
  <form data-form="profile" class="stack" novalidate>
    <fieldset class="panel">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>${L`Visible from the start`}</legend>
      ${field('alias', L`Nickname`, me.alias, { req: true, hint: L`Not your real name.` })}
      ${first ? '' : `
      <div class="row2">
        ${select('field', L`Field (your flavor)`, FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`]), me.field || FIELDS[0])}
        ${select('field2', L`Second field (optional)`, [['', L`None`], ...FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`])], me.field2 || '')}
      </div>
      ${field('city', L`City`, me.city, { ph: L`e.g. Taipei` })}
      <div class="row2">
        ${select('stage', L`What you are doing these days`, STAGES.map(([v, l]) => [v, L(l)]), me.stage || 'exploring')}
        ${select('meet', L`How you like to meet`, MEETS.map(([v, l]) => [v, L(l)]), me.meet || 'both')}
      </div>
      ${tagEditor('me', 'curious', myCurious(), L`Curious about`)}
      ${tagEditor('me', 'share', myShare(), L`Can share`)}`}
      ${field('doing', L`What I'm working on`, me.doing, { area: true, req: true, ph: L`e.g. A sign-up system for a community college` })}
      ${field('proof', L`Proof of work`, me.proof, { ph: L`Something you built or achieved` })}
    </fieldset>
    <fieldset class="panel panel--locked">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed until you both pop the seal`}</legend>
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

/* ---------- Screen: onboarding ----------
   A few quick questions, one per screen, then the order form.
   Single-choice answers move on by themselves. */

const QUIZ_STEPS = 5;

function quizStep(q) {
  const option = (key, value, label, art = '') => `
    <button class="option ${q[key] === value ? 'is-on' : ''}" data-act="quiz-pick" data-key="${key}" data-value="${esc(value)}" type="button" aria-pressed="${q[key] === value}">${art}<span>${esc(label)}</span></button>`;

  if (q.step === 0) {
    return `
    <h2 class="quiz__q">${L`First, pick your flavor.`}</h2>
    <p class="quiz__hint">${L`Your field is your flavor. Two fields? Pick a second one.`}</p>
    <div class="options options--flavors">${FIELDS.map((f) => {
      const i = [q.field, q.field2].indexOf(f);
      const tag = q.field2 ? [L`Main`, L`Second`][i] : '';
      return `<button class="option ${i >= 0 ? 'is-on' : ''}" data-act="quiz-field" data-value="${f}" type="button" aria-pressed="${i >= 0}">${cup(flavor(f)[1], { cls: 'cup--option' })}<span>${esc(L`${fieldName(f)}, ${flavorName(f)}`)}${tag ? `<small>${tag}</small>` : ''}</span></button>`;
    }).join('')}</div>
    ${q.field ? `<p class="quiz__preview">${cupFor(q, 'cup--lg')}<span>${esc(drinkFor(q))}</span></p>` : ''}`;
  }
  if (q.step === 1) {
    return `
    <h2 class="quiz__q">${L`What are you doing these days?`}</h2>
    <div class="options">${STAGES.map(([v, l]) => option('stage', v, L(l))).join('')}</div>`;
  }
  if (q.step === 2) {
    return `
    <h2 class="quiz__q">${L`What are you curious about?`}</h2>
    <p class="quiz__hint">${L`Things you would love to hear about. Type your own or tap one.`}</p>
    ${tagEditor('quiz', 'curious', q.curious, L`Curious about`)}`;
  }
  if (q.step === 3) {
    return `
    <h2 class="quiz__q">${L`What can you share?`}</h2>
    <p class="quiz__hint">${L`Things you know well enough to talk about for an hour.`}</p>
    ${tagEditor('quiz', 'share', q.share, L`Can share`)}`;
  }
  if (q.step === 4) {
    return `
    <h2 class="quiz__q">${L`How do you like to meet?`}</h2>
    <div class="options">${MEETS.map(([v, l]) => option('meet', v, L(l))).join('')}</div>
    ${field('city', L`Which city are you in?`, q.city, { ph: L`e.g. Taipei` })}`;
  }
  return `
    <h2 class="quiz__q">${L`Last step: fill in your order.`}</h2>
    ${profileForm(null, true)}`;
}

function viewOnboard() {
  const q = U.quiz;
  const canNext = [q.field, q.stage, q.curious.length, q.share.length, q.meet][q.step];
  return `
  <main class="onboard">
    <div class="onboard__top">
      <p class="logo">${LOGO}</p>
      <div class="btnrow">
        <button class="btn btn--ghost btn--sm" data-act="dev-skip" type="button"><i class="ph ph-fast-forward" aria-hidden="true"></i>Dev: skip</button>
      </div>
    </div>
    ${q.step === 0 ? `
    <div class="onboard__hero">
      <div>
        <h1 lang="en">${L`Boba chat, not coffee chat.`}</h1>
        <p class="lead">${L`Meet the person before the résumé. A few quick questions, then you are in.`}</p>
      </div>
      ${cup('var(--milk)', { level: 0.5, cls: 'cup--hero' })}
    </div>
    <p class="onboard__about"><a href="#/about">${L`New here? Read what Half Sugar is and what the boba words mean.`}</a></p>` : ''}
    <div class="progress" role="progressbar" aria-label="${esc(L`Setup progress`)}" aria-valuemin="1" aria-valuemax="${QUIZ_STEPS + 1}" aria-valuenow="${q.step + 1}"><span style="width:${((q.step + 1) / (QUIZ_STEPS + 1)) * 100}%"></span></div>
    <section class="quiz">${quizStep(q)}</section>
    <div class="quiz__nav">
      ${q.step ? `<button class="btn btn--ghost" data-act="quiz-back" type="button"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`Back`}</button>` : '<span></span>'}
      ${q.step < QUIZ_STEPS ? `<button class="btn btn--primary" data-act="quiz-next" type="button" ${canNext ? '' : 'disabled'}>${L`Next`}</button>` : ''}
    </div>
  </main>`;
}

function viewMe() {
  return `
  <header class="head">
    <div><h1 lang="en">${L`My order`}</h1><p class="sub">${L`Your usual. Change it any time.`}</p></div>
  </header>
  <section class="receipt">
    ${cupFor(S.me, 'cup--lg')}
    <div>
      <p class="receipt__label">${L`Your usual`}</p>
      <p class="receipt__item">1 × ${esc(drinkFor(S.me))}</p>
      <p class="receipt__meta">${L`For ${esc(S.me.alias)}.`}</p>
      <p class="receipt__meta">${S.threads.some((t) => t.msgs.some((m) => m.from === 'them'))
        ? L`You reply to ${Math.round(myReplyRate() * 100)}% of chats.`
        : L`Your reply rate shows up after your first chats.`}</p>
    </div>
  </section>
  ${profileForm(S.me, false)}
  ${viewAlgorithm()}
  <section class="panel note">
    <h2>${L`Demo mode`}</h2>
    <p><a class="inline-link" href="#/about">${L`What is Half Sugar?`}</a></p>
    <p>${L`Not connected to a server yet. Your data stays in this browser, and the other people are simulated.`}</p>
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
      ${r.role ? `<p class="meta">${L`Applied as ${esc(r.role)}`}</p>` : ''}
      <p class="quote">${esc(r.text)}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="accept" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Accept, first sip`}</button>
        <button class="btn btn--ghost btn--sm" data-act="decline" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Skip`}</button>
      </div>
    </li>`).join('')}</ul>`;
}

/* ---------- Screen: Explore (a forum) ----------
   Posts sit in topics. Comments are public but anonymous, with no likes or
   follower counts, so nobody performs for an audience. Anyone can message a
   post's author or a commenter privately, which starts a normal chat. */

const LOADED_AT = Date.now();
const seedAt = (ago) => LOADED_AT - ago * 60000;

// Your posts and the seed posts in one shape, newest first
function allPosts() {
  const mine = S.myThoughts.map((t) => ({ ...t, by: 'me', cat: t.cat || 'startups', at: t.at || LOADED_AT, comments: t.comments || [] }));
  const seeds = SEED_THOUGHTS.map((t) => ({ ...t, at: seedAt(t.ago), comments: t.comments.map((c) => ({ ...c, at: seedAt(c.ago) })) }));
  return [...mine, ...seeds].sort((a, b) => b.at - a.at);
}
const postById = (id) => allPosts().find((p) => p.id === id);

// Comments that came with the post plus the ones written in this browser, oldest first
const commentsOf = (post) => [...post.comments, ...((S.comments || {})[post.id] || [])].sort((a, b) => a.at - b.at);

const authorName = (by) => (by === 'me' ? L`You` : P[by].alias);
const authorLine = (by) => byline(by === 'me' ? { ...S.me, alias: L`You` } : P[by]);

function agoText(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return L`just now`;
  if (m < 60) return L`${m}m ago`;
  if (m < 1440) return L`${Math.floor(m / 60)}h ago`;
  return L`${Math.floor(m / 1440)}d ago`;
}

const commentCount = (n) => (n === 1 ? L`1 comment` : L`${n} comments`);

// Message someone you met in Explore. `spot` says where the box opens, so only one shows at a time.
function dmBox(pid, spot) {
  const existing = S.threads.find((t) => t.pid === pid);
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Open chat`}</a>`;
  if (U.dm && U.dm.pid === pid && U.dm.spot === spot) {
    return `
      <form class="stack reply" data-form="dm" data-pid="${pid}" data-post="${esc(spot.split(':')[0])}" novalidate>
        ${field('dm', L`Message ${esc(P[pid].alias)} privately`, '', { area: true, rows: 3, req: true, ph: L`Only they will see this. Your titles stay hidden.` })}
        <div class="btnrow">
          <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
          <button class="btn btn--ghost btn--sm" data-act="dm-close" type="button">${L`Cancel`}</button>
        </div>
      </form>`;
  }
  return `<button class="btn btn--ghost btn--sm" data-act="dm-open" data-pid="${pid}" data-spot="${esc(spot)}" type="button"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>${L`Message`}</button>`;
}

function postCard(post) {
  return `
    <article class="card forum-post">
      <p class="forum-post__cat">${esc(catName(post.cat))}</p>
      <a class="thought forum-post__link" href="#/post/${post.id}">${esc(post.text)}</a>
      ${authorLine(post.by)}
      <div class="forum-post__foot">
        <p class="meta">${L`${commentCount(commentsOf(post).length)}, ${agoText(post.at)}`}</p>
        <div class="btnrow">
          <a class="btn btn--dark btn--sm" href="#/post/${post.id}"><i class="ph ph-chat-text" aria-hidden="true"></i>${L`Comments`}</a>
          ${post.by === 'me' ? '' : dmBox(post.by, post.id)}
        </div>
      </div>
    </article>`;
}

function viewExplore() {
  const cat = U.cat;
  const posts = allPosts();
  // Top picks: posts from the people who score highest with you today (All tab only)
  const top = cat === 'all'
    ? topPicks(SEED_THOUGHTS.map((t) => P[t.by]), TOP_PICKS, dayKey()).map((p) => posts.find((x) => x.by === p.id))
    : [];
  const list = posts.filter((p) => (cat === 'all' || p.cat === cat) && !top.includes(p));
  const tabs = [['all', L`All`], ...CATEGORIES.map(([v, l]) => [v, L(l)])];

  return `
  <header class="head">
    <div><h1 lang="en">${L`Explore`}</h1><p class="sub" lang="en">${L`I want to meet someone.`}</p></div>
    <button class="btn btn--primary" data-act="compose" data-what="thought" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`New post`}</button>
  </header>

  ${U.compose === 'thought' ? `
  <form class="panel stack" data-form="thought" novalidate>
    ${select('cat', L`Topic`, CATEGORIES.map(([v, l]) => [v, L(l)]), cat === 'all' ? 'startups' : cat)}
    ${field('text', L`Your thought or question`, '', { area: true, rows: 3, req: true, ph: L`Something you have been turning over lately` })}
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  <div class="cats" role="group" aria-label="${esc(L`Topics`)}">
    ${tabs.map(([v, l]) => `<button class="cat ${cat === v ? 'is-on' : ''}" data-act="cat" data-value="${v}" type="button" aria-pressed="${cat === v}">${esc(l)}</button>`).join('')}
  </div>

  ${top.length ? `
  <section class="mine">
    <h2>${L`Top picks`}</h2>
    ${top.map(postCard).join('')}
  </section>` : ''}

  <section class="mine">
    <h2>${cat === 'all' ? (top.length ? L`Latest` : L`All posts`) : esc(catName(cat))}</h2>
    ${list.length ? list.map(postCard).join('') : `<p class="empty">${L`No posts in this topic yet. Start one.`}</p>`}
  </section>`;
}

// One post with its public comments
function viewPost(id) {
  const post = postById(id);
  if (!post) return viewExplore();
  const comments = commentsOf(post);
  return `
  <a class="back-link" href="#/explore"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`Back to Explore`}</a>

  <article class="card forum-post forum-post--open">
    <p class="forum-post__cat">${esc(catName(post.cat))}</p>
    <p class="thought">${esc(post.text)}</p>
    ${authorLine(post.by)}
    <div class="forum-post__foot">
      <p class="meta">${agoText(post.at)}</p>
      ${post.by === 'me' ? '' : dmBox(post.by, post.id)}
    </div>
  </article>

  <section class="comments">
    <h2>${commentCount(comments.length)}</h2>
    <ul class="comments__list">
      ${comments.map((c) => `
      <li class="comment">
        <span class="avatar avatar--cup" aria-hidden="true">${cupFor(c.by === 'me' ? S.me : P[c.by])}</span>
        <div class="comment__body">
          <p class="comment__head">
            <strong>${esc(authorName(c.by))}</strong>
            ${c.by !== 'me' && c.by === post.by ? `<span class="tag">${L`Author`}</span>` : ''}
            <span class="meta">${agoText(c.at)}</span>
          </p>
          <p>${esc(c.text)}</p>
          ${c.by === 'me' ? '' : `<div class="comment__actions">${dmBox(c.by, `${post.id}:${c.at}`)}</div>`}
        </div>
      </li>`).join('')}
      ${U.typingPost === post.id ? `<li class="comment"><span class="msg msg--them msg--typing" aria-label="${esc(L`Someone is typing`)}"><span></span><span></span><span></span></span></li>` : ''}
    </ul>
    <form class="comment-form" data-form="comment" data-id="${post.id}" novalidate>
      <label class="sr" for="c-comment">${L`Add a public comment`}</label>
      <textarea id="c-comment" name="comment" rows="2" placeholder="${esc(L`Add a public comment`)}"></textarea>
      <button class="btn btn--dark" type="submit">${L`Comment`}</button>
    </form>
  </section>`;
}

/* ---------- Screen: Build ---------- */

const dateText = (d) => new Date(`${d}T00:00`).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' });

// Kind of project, and for competitions which one and when it closes
const brewHead = (b) => `
      <p class="brew-kind">
        <span class="kind-chip">${hasEvent(b.kind) ? '<i class="ph ph-trophy" aria-hidden="true"></i>' : ''}${esc(kindName(b.kind))}</span>
        ${hasEvent(b.kind) && b.event ? `<span class="brew-kind__event">${esc(b.event)}</span>` : ''}
        ${b.deadline ? `<span class="meta">${L`Deadline ${dateText(b.deadline)}`}</span>` : ''}
      </p>`;

// The roles a Brew needs. Filled ones are ticked off; the author can tick and untick.
function rolesList(b, mine) {
  const roles = rolesOf(b);
  const filled = roles.filter((r) => r.filled).length;
  return `
      <ul class="roles">${roles.map((r, i) => `
        <li class="role ${r.filled ? 'is-filled' : ''}">
          <i class="ph ${r.filled ? 'ph-check-circle' : 'ph-circle'}" aria-hidden="true"></i>
          <span class="role__name">${esc(r.name)}</span>
          ${mine
            ? `<button class="btn btn--ghost btn--sm" data-act="role-toggle" data-id="${b.id}" data-i="${i}" type="button">${r.filled ? L`Reopen` : L`Mark filled`}</button>`
            : r.filled ? `<span class="role__tag">${L`Filled`}</span>` : ''}
        </li>`).join('')}
      </ul>
      <p class="meta">${roles.length && filled === roles.length ? `<strong class="done"><i class="ph ph-check" aria-hidden="true"></i>${L`Team complete`}</strong>` : L`${filled} of ${roles.length} filled`}</p>`;
}

const brewExtras = (b, mine) => (b.offer || b.duration ? `
      <dl class="brief">
        ${b.offer ? `<div><dt>${mine ? L`I can offer` : L`Offers`}</dt><dd>${esc(b.offer)}</dd></div>` : ''}
        ${b.duration ? `<div><dt>${L`Time`}</dt><dd>${esc(b.duration)}</dd></div>` : ''}
      </dl>` : '');

function brewCard(b) {
  const p = P[b.by];
  const existing = threadFor('build', b.id);
  const open = openRoles(b);
  return `
    <article class="card brew ${open.length ? '' : 'is-complete'}">
      ${brewHead(b)}
      <h3 class="post-title">${esc(b.title)}</h3>
      ${rolesList(b, false)}
      ${brewExtras(b, false)}
      ${byline(p)}
      ${existing
        ? `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Applied. Open chat`}</a>`
        : !open.length ? ''
        : U.target === b.id
          ? `<form class="stack reply" data-form="apply" data-id="${b.id}" novalidate>
              ${select('role', L`Apply for`, open.map((r) => [r.name, r.name]), open[0].name)}
              ${field('reply', L`Why you are a fit`, '', { area: true, rows: 3, req: true, ph: L`Say what you would bring. They cannot see your titles` })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">${L`Send anonymously`}</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">${L`Cancel`}</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${b.id}" type="button">${L`Apply anonymously`}</button>`}
    </article>`;
}

// Roles for a new Brew: type one, or tap a suggestion
function roleEditor() {
  const roles = U.draft.roles;
  const left = ROLE_SUGGESTIONS.filter((x) => !roles.some((r) => normTag(r) === normTag(x)));
  return `
    <div class="field tags" role="group" aria-labelledby="roles-label">
      <p class="field__label" id="roles-label">${L`Roles you need`}</p>
      ${roles.length ? `<ul class="tags__list">${roles.map((r) => `<li class="tag-chip">${esc(r)}<button type="button" data-act="role-remove" data-value="${esc(r)}" aria-label="${esc(L`Remove ${r}`)}"><i class="ph ph-x" aria-hidden="true"></i></button></li>`).join('')}</ul>` : ''}
      ${roles.length < MAX_ROLES ? `
      <div class="tags__add">
        <input id="c-role" data-role-input autocomplete="off" aria-label="${esc(L`Roles you need`)}" placeholder="${esc(L`Type a role and press Enter`)}">
        <button class="btn btn--ghost btn--sm" data-act="role-add" type="button">${L`Add`}</button>
      </div>
      <div class="tags__suggest">${left.map((x) => `<button class="cat cat--sm" data-act="role-add" data-value="${esc(x)}" type="button">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    </div>`;
}

function viewBuild() {
  const open = SEED_POSTS.filter((b) => openRoles(b).length);
  const forYou = topPicks(open.map((b) => P[b.by]), BREW_TOP_PICKS, dayKey() + 'brew').map((p) => SEED_POSTS.find((b) => b.by === p.id));
  const rest = SEED_POSTS.filter((b) => !forYou.includes(b));
  const d = U.draft;

  return `
  <header class="head">
    <div><h1 lang="en">${L`Brew`}</h1><p class="sub" lang="en">${L`I need someone for something.`}</p>${explain(L`Post what you need. We send it to people who fit.`)}</div>
    <button class="btn btn--primary" data-act="compose" data-what="post" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`Start a brew`}</button>
  </header>

  ${U.compose === 'post' ? `
  <form class="panel stack" data-form="post" novalidate>
    ${field('title', L`What are you building?`, '', { area: true, req: true, ph: L`e.g. A shared-kitchen platform for home cooks` })}
    <div class="row2">
      ${select('kind', L`What kind of project`, BREW_KINDS.map(([v, l]) => [v, L(l)]), d.kind)}
      ${field('duration', L`Time`, '', { ph: L`e.g. One call, a four-week project` })}
    </div>
    <div class="row2 event-fields" ${hasEvent(d.kind) ? '' : 'hidden'}>
      ${field('event', L`Which competition`, '', { ph: L`e.g. Taipei Climate Hackathon` })}
      ${field('deadline', L`Deadline`, '', { type: 'date' })}
    </div>
    ${roleEditor()}
    ${field('offer', L`I can offer (optional)`, '')}
    <p class="error" id="post-error" hidden>${L`Add at least one role.`}</p>
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  ${S.myPosts.length ? `
  <section class="mine">
    <h2>${L`Your brews`}</h2>
    ${S.myPosts.map((b) => `
    <article class="card card--mine brew">
      ${b.kind ? brewHead(b) : ''}
      <h3 class="post-title">${esc(b.title)}</h3>
      ${rolesList(b, true)}
      ${brewExtras(b, true)}
      ${b.sentTo ? `
      <div class="sent">
        <p class="meta"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>${L`Sent to ${b.sentTo.length} people who fit`}</p>
        <ul class="sent__list">${b.sentTo.map((pid) => `<li><span class="avatar avatar--cup" aria-hidden="true">${cupFor(P[pid])}</span>${esc(P[pid].alias)}</li>`).join('')}</ul>
      </div>` : ''}
      ${openRoles(b).length ? responsesBlock(b, 'post') : ''}
    </article>`).join('')}
  </section>` : ''}

  ${forYou.length ? `
  <section class="mine">
    <h2>${L`Top picks`}</h2>
    ${forYou.map(brewCard).join('')}
  </section>` : ''}

  <section class="mine">
    <h2>${forYou.length ? L`More brews` : L`All brews`}</h2>
    ${rest.map(brewCard).join('')}
  </section>`;
}

/* ---------- Screen: Drop ----------
   The schedule is a placeholder: every Friday 13:00 UTC, open for 10 minutes.
   Each chat also lasts 10 minutes, which is exactly half sugar (5% a minute). */

const DROP_WEEKDAY_UTC = 5;
const DROP_HOUR_UTC = 13;
const DROP_WINDOW_MS = 10 * 60 * 1000;
const DROP_MINUTES = 10;
const DROP_LENGTH_MS = DROP_MINUTES * 60 * 1000;

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
      <p class="sub">${L`Different field, different city, one thing in common.`}</p>
    </section>`;
  }

  if (D.phase === 'live') {
    return `
    <section class="chat">
      <header class="chat__head">
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
      <p class="drop-card__when">${L`${esc(localTime)} your time. Open for 10 minutes.`}</p>
      <button class="btn btn--dark" data-act="drop-join" type="button">${open ? L`Pour me one` : L`Try a practice cup`}</button>
    </div>
  </section>
  <ul class="rules">
    <li><i class="ph ph-shuffle" aria-hidden="true"></i><div><strong>${L`No picking flavors`}</strong><p>${L`Different field and city, one thing in common.`}</p></div></li>
    <li><i class="ph ph-hourglass-medium" aria-hidden="true"></i><div><strong>${L`${DROP_MINUTES} minutes`}</strong><p>${L`Text only. That gets you to half sugar.`}</p></div></li>
    <li><i class="ph ph-handshake" aria-hidden="true"></i><div><strong>${L`Refill only if you both want one`}</strong><p>${L`Otherwise the cup disappears.`}</p></div></li>
  </ul>
  ${S.drops ? `<p class="meta">${S.drops === 1 ? L`You have had 1 mystery cup.` : L`You have had ${S.drops} mystery cups.`}</p>` : ''}`;
}

function dropStart() {
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
  Object.assign(D, { phase: 'live', pid: p.id, anchor, li: 0, typing: false, result: null, ends: Date.now() + DROP_LENGTH_MS });
  D.msgs = [anchor
    ? { from: 'sys', text: ANCHOR_OPENERS[anchor.kind], vars: [anchor.a, anchor.b] }
    : { from: 'sys', text: 'Your first sip lasts 10 minutes. Start by asking what they are busy with.' }];
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
    <div><h1>${L`Chats`}</h1><p class="sub">${L`Every chat starts with a first sip.`}</p>${explain(L`At 50% sugar you can pop the seal. No reply for 3 days and a chat closes.`)}</div>
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

    ${both ? '' : explain(L`Names stay hidden until 50% sugar, about 10 minutes of chat.`)}

    <details class="who">
      <summary>${both ? L`Their full card` : L`Their card`}</summary>
      ${brief(p)}
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
      <div class="row2">
        ${select('kind', L`Type`, [['Boba shop, 1-on-1', L`Boba shop, 1-on-1`], ['Café', L`Café`], ['Small dinner table', L`Small dinner table`]], 'Boba shop, 1-on-1')}
        ${field('area', L`Area`, S.me.city || '', { req: true, ph: L`e.g. Taipei, Da'an` })}
      </div>
      <div class="row2">
        ${field('date', L`Date`, '', { type: 'date', req: true, min: today })}
        ${select('time', L`Time`, ['12:00', '15:00', '19:00'], '15:00')}
      </div>
      <p class="hint">${L`Demo: no real booking is made.`}</p>
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
  ['Flavor', 'ph-drop', 'Your field. Each field is a boba flavor and sets the colour of your cup. Two fields make a two-flavor cup.'],
  ['Sugar', 'ph-chart-line-up', 'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.'],
  ['Explore', 'ph-compass', 'A forum by topic. Comment in public, or message someone privately. Top picks come first.'],
  ['Brew', 'ph-hammer', 'Build something together. Post what you need and it goes to the people who fit, or apply to a Brew without showing your titles.'],
  ['Mystery Cup', 'ph-sparkle', 'A surprise match once a week: a different field and background, with one thing in common. You cannot pick who you get.'],
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
    ${S.me ? '' : `<div class="onboard__top"><p class="logo">${LOGO}</p></div>`}
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
        <li><strong>${L`Take a first sip.`}</strong> ${L`Comment or message someone in Explore, apply to a Brew, or join the weekly Mystery Cup.`}</li>
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
  ['explore', 'Explore', 'ph-compass', 'Topics and posts'],
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
        <a href="#/${name}" ${route.name === name || (name === 'explore' && route.name === 'post') ? 'aria-current="page"' : ''}>
          <i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span ${name === 'chats' ? '' : 'lang="en"'}>${L(label)}</span><small>${L(desc)}</small></span>
          ${name === 'chats' && unread ? `<span class="badge" aria-label="${esc(L`${unread} unread`)}">${unread}</span>` : ''}
        </a>`).join('')}
      </nav>
      <div class="side__foot">
        <a class="side__about" href="#/about" ${route.name === 'about' ? 'aria-current="page"' : ''}><i class="ph ph-info" aria-hidden="true"></i>${L`What is Half Sugar?`}</a>
      </div>
    </aside>
    <main class="main ${isChat ? 'main--chat' : ''}" id="main">${body}</main>
  </div>`;
}

// Draw the page. If something breaks (often old saved data), show a way out instead of a blank screen.
function render(opt = {}) {
  try {
    draw(opt);
  } catch (err) {
    console.error(err);
    app.innerHTML = `
    <main class="onboard">
      <p class="logo">${LOGO}</p>
      <h1>${L`Something went wrong.`}</h1>
      <p class="lead">${L`Your saved data may come from an older version. Clearing it usually fixes this.`}</p>
      <p class="hint">${esc(err && err.message)}</p>
      <button class="btn btn--primary" data-act="reset-yes" type="button">${L`Clear data and restart`}</button>
    </main>`;
  }
}

function draw(opt = {}) {
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
    else if (route.name === 'post') body = viewPost(route.id);
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
    if (first) {
      const q = U.quiz;
      Object.assign(data, { field: q.field, field2: q.field2, stage: q.stage, curious: q.curious, share: q.share, meet: q.meet, city: q.city });
    } else if (data.field2 === data.field) {
      data.field2 = '';
    }
    // Keep what the form does not hold, like your tags
    S.me = first ? data : { ...S.me, ...data };
    save();
    if (first) { lastPath = null; go('explore'); render({ fresh: true }); } else { toast(L`Saved`); render(); }
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
    if (!U.draft.roles.length) { $('#post-error', form).hidden = false; $('#c-role', form).focus(); return; }
    const withEvent = hasEvent(data.kind);
    const item = {
      id: uid(), title: data.title, kind: data.kind,
      event: withEvent ? data.event : '', deadline: withEvent ? data.deadline : '',
      roles: U.draft.roles.map((name) => ({ name, filled: false })),
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
  compose(el) {
    U.compose = el.dataset.what || null;
    if (U.compose === 'post') U.draft = { kind: 'side', roles: [] };
    render({ fresh: true, focus: U.compose === 'thought' ? 'f-text' : U.compose === 'post' ? 'f-title' : null });
  },
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


  cat(el) { U.cat = el.dataset.value; render(); },
  'dm-open'(el) { U.dm = { pid: el.dataset.pid, spot: el.dataset.spot }; render({ fresh: true, focus: 'f-dm' }); },
  'dm-close'() { U.dm = null; render({ fresh: true }); },

  'quiz-pick'(el) {
    const q = U.quiz;
    const step = q.step;
    q[el.dataset.key] = el.dataset.value;
    render();
    // The meet question shares its screen with the city, so it waits for Next
    if (el.dataset.key !== 'meet') later(220, () => { if (q.step === step) { q.step += 1; render({ fresh: true }); } });
  },
  // First pick is the main field, second pick makes it a two-flavor cup. Tap again to remove.
  'quiz-field'(el) {
    const q = U.quiz;
    const v = el.dataset.value;
    if (q.field === v) { q.field = q.field2; q.field2 = ''; }
    else if (q.field2 === v) q.field2 = '';
    else if (!q.field) q.field = v;
    else q.field2 = v;
    render();
  },
  // Add tags from a suggestion or the text box (several at once, split by commas)
  'tag-add'(el) {
    const { scope, key } = el.dataset;
    const list = tagList(scope, key);
    const input = document.getElementById(`c-tag-${key}`);
    const raw = el.dataset.value || (input ? input.value : '');
    raw.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (list.length < MAX_TAGS && !list.some((x) => normTag(x) === normTag(t))) list.push(t);
    });
    if (input) input.value = '';
    if (scope === 'me') save();
    render({ focus: `c-tag-${key}` });
  },
  'role-add'(el) {
    const input = document.getElementById('c-role');
    const raw = el.dataset.value || (input ? input.value : '');
    raw.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (U.draft.roles.length < MAX_ROLES && !U.draft.roles.some((r) => normTag(r) === normTag(t))) U.draft.roles.push(t);
    });
    if (input) input.value = '';
    render({ focus: 'c-role' });
  },
  'role-remove'(el) {
    const i = U.draft.roles.indexOf(el.dataset.value);
    if (i >= 0) U.draft.roles.splice(i, 1);
    render();
  },
  // The author ticks a role off when it is filled, or opens it again
  'role-toggle'(el) {
    const b = S.myPosts.find((x) => x.id === el.dataset.id);
    if (!b) return;
    b.roles = rolesOf(b);
    const role = b.roles[Number(el.dataset.i)];
    role.filled = !role.filled;
    save();
    if (!openRoles(b).length) toast(L`Team complete. Nice brew.`);
    render();
  },
  'tag-remove'(el) {
    const list = tagList(el.dataset.scope, el.dataset.key);
    const i = list.indexOf(el.dataset.value);
    if (i >= 0) list.splice(i, 1);
    if (el.dataset.scope === 'me') save();
    render();
  },
  'quiz-next'() {
    const city = document.getElementById('f-city');
    if (U.quiz.step === 4 && city) U.quiz.city = city.value.trim();
    U.quiz.step += 1;
    render({ fresh: true });
  },
  'quiz-back'() {
    const city = document.getElementById('f-city');
    if (U.quiz.step === 4 && city) U.quiz.city = city.value.trim();
    U.quiz.step = Math.max(0, U.quiz.step - 1);
    render({ fresh: true });
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
    S.me = { alias: 'Dev', city: 'Taipei', field: 'Design', stage: 'side', meet: 'both', curious: ['Pricing', 'AI products'], share: ['Product design', 'User research'], doing: 'Testing Half Sugar', proof: '', name: 'Dev User', title: 'Builder', school: '', company: '', linkedin: '' };
    save();
    lastPath = null;
    go('explore');
    render({ fresh: true });
  },

  'reset-weights'() { delete S.weights; save(); render(); },

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

// Enter in a tag box adds the tag instead of sending the form
document.addEventListener('keydown', (event) => {
  const el = event.target.closest('[data-tag-input], [data-role-input]');
  if (!el || event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  acts[el.hasAttribute('data-role-input') ? 'role-add' : 'tag-add'](el);
});

// Competitions and hackathons ask which one it is
document.addEventListener('change', (event) => {
  if (event.target.id !== 'f-kind') return;
  U.draft.kind = event.target.value;
  const box = $('.event-fields');
  if (box) box.hidden = !hasEvent(U.draft.kind);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  forms[form.dataset.form](form, formData(form));
});

window.addEventListener('hashchange', () => {
  U.target = null;
  U.dm = null;
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

// After a reload, pick the unfinished simulations back up.
// If old data trips this up, still draw the page.
try {
  S.threads.forEach((t) => {
    if (t.status === 'pending') scheduleAccept(t);
    if (t.reveal && t.reveal.me && !t.reveal.them) later(2600, () => resolveReveal(t));
  });
  learnWeights();
  S.myThoughts.forEach((item) => scheduleIncoming(item, 'thought'));
  S.myPosts.forEach((item) => scheduleIncoming(item, 'post'));
} catch (err) {
  console.error(err);
}

render();
