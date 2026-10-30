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
  // Reaching half sugar earns a gift box, once per chat
  if (before < REVEAL_AT && after >= REVEAL_AT && !(t.rewards && t.rewards.half)) {
    t.rewards = { ...t.rewards, half: true };
    earnBox('small', 'For reaching half sugar with {0}.', [P[t.pid].alias]);
  }
}

// The boba cup: a clear plastic cup with a dome lid, a red straw, pearls at the
// bottom, and a red seal label.
// Big cups can come apart: the straw and lid lift up, and the toppings and
// pearls fly out to the left and right. The tea and the cup stay together.
// level goes from 0 (empty) to 1 (full). ids are toppings to put in the drink.
const BIG_CUP = /cup--(hero|mystery|lg|profile)/;
const CUP_SHELL = 'M2.5 9.4 L4.5 25.1 Q12 27.3 19.5 25.1 L21.5 9.4'; // open at the top, so no line across the opening
const CUP_IN = 'M3.2 10.4 L5.1 24.6 Q12 26.5 18.9 24.6 L20.8 10.4 Z';
const CUP_DOME = 'M2.3 9.2 Q2.5 1.6 12 1.6 Q21.5 1.6 21.7 9.2'; // open at the bottom, so no line across the lid
const CUP_STRAW = 'M14.2 -4.6 L16 -4.4 L13.4 21 L11.6 20.8 Z';
const CUP_PEARLS = [[8.6, 23.4, '#3b2518'], [11.9, 23.9, '#4a2c1c'], [15.3, 23.3, '#7d93a0'], [10.2, 21.4, '#5a3a28'], [13.7, 21.6, '#3b2518'], [7, 21.4, '#6f8796'], [17, 21.2, '#4a2c1c']];
// Where each piece goes when the cup comes apart, and when it starts moving
const APART = {
  straw: '--dy:-16px;--d:0s',
  lid: '--dy:-10px;--d:.05s',
  layer: '--dy:-5.5px;--d:.08s',
  topL: '--dx:-14px;--r:-10deg;--d:.12s',
  topR: '--dx:14px;--r:10deg;--d:.12s',
  pearlsL: '--dx:-13px;--dy:1.5px;--r:-8deg;--d:.18s',
  pearlsR: '--dx:13px;--dy:1.5px;--r:8deg;--d:.18s',
};
// Cups that come apart get extra room around them for the pieces
const EXPLODE = /cup--(hero|profile)/;
const WIDE_VIEW = '-11 -16 46 44';

function cupArt(color, o = {}) {
  const id = 'cp' + uid();
  const ids = o.ids || [];
  const has = (k) => ids.includes(k);
  const big = BIG_CUP.test(o.cls || '');
  const meter = /cup--chip/.test(o.cls || '');
  const level = o.level ?? 0.62;
  const fill = meter ? level : level > 0 ? 1 : 0; // cups look full unless empty or a sugar meter
  const teaTop = +(24.9 - 14.1 * fill).toFixed(2);
  const mid = ((teaTop + 25) / 2).toFixed(1);
  const halfAt = (y) => 9.3 - 1.9 * ((y - 10.4) / 14.2); // the cup is narrower lower down
  // Big cups get edges from light and shade; small cups keep a thin grey line so they stay readable
  const line = big ? 0.22 : 0.6;
  const ink = big ? '#8d877d' : '#a39d93';
  const part = (name, body) => (body ? `<g class="part p-${name}" style="${APART[name] || ''}">${body}</g>` : '');
  // Floating toppings, split into the left and right halves of the cup
  const placed = ids.filter((k) => PIECE[k]).flatMap((k, i) => [0, 1].map((n) => {
    const [x, y] = PIECE_SLOTS[(i * 2 + n) % PIECE_SLOTS.length];
    return { x, svg: PIECE[k](id, x, y, PIECE_SIZE, n) };
  }));
  const side = (list, left) => list.filter((p) => (left ? p.x < 12 : p.x >= 12)).map((p) => p.svg).join('');
  const pearls = fill > 0.3 ? CUP_PEARLS.map(([x, y, c]) => ({ x, svg: `<ellipse cx="${x}" cy="${y + 1.25}" rx="1.3" ry=".35" fill="#000" fill-opacity=".18"/><circle cx="${x}" cy="${y}" r="1.5" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.5" fill="url(#${id}-pearl)"/>` })) : [];
  return `
    ${toppingDefs(id)}
    <defs>
      <clipPath id="${id}-in"><path d="${CUP_IN}"/></clipPath>
      <linearGradient id="${id}-shade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#2a1d16" stop-opacity="0"/><stop offset="1" stop-color="#2a1d16" stop-opacity=".22"/></linearGradient>
      <radialGradient id="${id}-pearl" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
      <linearGradient id="${id}-deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a1d16" stop-opacity=".2"/></linearGradient>
      <linearGradient id="${id}-plastic" x1="0" x2="1">
        <stop offset="0" stop-color="#6f675c" stop-opacity=".32"/><stop offset=".05" stop-color="#fff" stop-opacity=".55"/><stop offset=".13" stop-color="#fff" stop-opacity=".08"/>
        <stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".86" stop-color="#fff" stop-opacity=".06"/><stop offset=".93" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#6f675c" stop-opacity=".34"/>
      </linearGradient>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#ece7de"/><stop offset="1" stop-color="#b8b1a6"/></linearGradient>
      <radialGradient id="${id}-dome" cx=".38" cy=".25" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".22"/><stop offset=".85" stop-color="#cfc8bc" stop-opacity=".22"/><stop offset="1" stop-color="#8d877d" stop-opacity=".4"/></radialGradient>
      <linearGradient id="${id}-straw" x1="0" x2="1"><stop offset="0" stop-color="#b8341c"/><stop offset=".35" stop-color="#f26a45"/><stop offset=".55" stop-color="#e2492a"/><stop offset="1" stop-color="#a02c17"/></linearGradient>
      <radialGradient id="${id}-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b2518" stop-opacity=".22"/><stop offset="1" stop-color="#3b2518" stop-opacity="0"/></radialGradient>
    </defs>
    ${big ? `<ellipse cx="12" cy="26.7" rx="10" ry="1.6" fill="url(#${id}-floor)"/>` : ''}
    ${fill > 0 ? `<g clip-path="url(#${id}-in)">
      <rect x="0" y="${teaTop}" width="24" height="20" fill="${o.color2 || color}"/>
      ${o.color2 ? `<rect x="0" y="${mid}" width="24" height="20" fill="${color}"/>` : ''}
      ${has('tiger') ? `<g fill="none" stroke="url(#${id}-syrup)" stroke-width="1.3" stroke-opacity=".8" stroke-linecap="round"><path d="M6 11.5Q9 15 7 19T9 25"/><path d="M12.5 11Q15 14.5 12.8 18.5T14.6 24.5"/><path d="M17.8 11.8Q19.4 15 17.4 18.6"/></g>` : ''}
      <rect x="0" y="${teaTop}" width="24" height="20" fill="url(#${id}-shade)"/>
      <rect x="0" y="${teaTop}" width="24" height="20" fill="url(#${id}-deep)"/>
      ${has('foam') || has('brulee') ? '' : `<ellipse cx="12" cy="${teaTop}" rx="${halfAt(teaTop).toFixed(2)}" ry=".75" fill="#fff" fill-opacity=".22"/>`}
    </g>` : ''}
    ${part('layer', (() => {
      // A round slice the shape of the cup at that height: side band plus a top oval
      const disc = (y, thick, sideFill, topFill, extra = '') => {
        const hw = halfAt(y);
        return `<path d="M${(12 - hw).toFixed(2)} ${y} v${thick} a${hw.toFixed(2)} .9 0 0 0 ${(2 * hw).toFixed(2)} 0 v-${thick} Z" fill="${sideFill}" stroke="#3b2518" stroke-opacity=".18" stroke-width=".2"/><ellipse cx="12" cy="${y}" rx="${hw.toFixed(2)}" ry=".9" fill="${topFill}" stroke="#3b2518" stroke-opacity=".18" stroke-width=".2"/>${extra}`;
      };
      const foamY = teaTop;
      const bruY = has('foam') ? teaTop - 1.2 : teaTop;
      return (fill > 0.5 && has('foam') ? disc(foamY, 2, `url(#${id}-foamL)`, '#fffaf0') : '')
        + (fill > 0.5 && has('brulee') ? disc(bruY, 1.2, `url(#${id}-bruL)`, `url(#${id}-caramel)`, `<g fill="#5e2c0c" fill-opacity=".5"><ellipse cx="9.5" cy="${bruY}" rx=".7" ry=".2"/><ellipse cx="14.2" cy="${bruY + 0.2}" rx=".5" ry=".15"/><ellipse cx="12" cy="${bruY - 0.3}" rx=".4" ry=".12"/></g>`) : '');
    })())}
    ${part('pearlsL', side(pearls, true))}
    ${part('pearlsR', side(pearls, false))}
    ${part('topL', side(placed, true))}
    ${part('topR', side(placed, false))}
    ${part('straw', `<path d="${CUP_STRAW}" fill="url(#${id}-straw)" ${big ? '' : 'stroke="#a3301b" stroke-width=".4" stroke-linejoin="round"'}/><path d="M14.85 -3.6 12.55 18.5" stroke="#fff" stroke-opacity=".5" stroke-width=".3" stroke-linecap="round"/><ellipse cx="15.1" cy="-4.5" rx=".95" ry=".3" fill="#8f2615"/>`)}
    <path d="${CUP_SHELL} Z" fill="url(#${id}-plastic)"/>
    <path d="${CUP_SHELL}" fill="none" stroke="${ink}" stroke-opacity="${big ? 0.55 : 1}" stroke-width="${line}" stroke-linejoin="round"/>
    <path d="M4.5 25.1 Q12 27.3 19.5 25.1" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".3"/>
    <path d="M3.9 11.2 5.5 23.9" stroke="#fff" stroke-opacity=".7" stroke-width=".75" stroke-linecap="round"/>
    <path d="M19.4 11.6 18.3 21" stroke="#fff" stroke-opacity=".45" stroke-width=".3" stroke-linecap="round"/>
    <path d="M2.5 9.4 A9.5 1.1 0 0 1 21.5 9.4" fill="none" stroke="${ink}" stroke-opacity=".5" stroke-width="${line}"/>
    <path d="M2.3 9.4 A9.7 1.25 0 0 0 21.7 9.4 L21.7 9 A9.7 1.25 0 0 1 2.3 9 Z" fill="url(#${id}-rim)" stroke="${ink}" stroke-opacity="${big ? 0.4 : 0.9}" stroke-width="${line * 0.8}"/>
    <rect x="9.6" y="11.8" width="4.8" height="6" rx=".5" fill="#c8352b"/>
    ${big ? `<rect x="10" y="12.2" width="4" height="5.2" rx=".3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".14"/>` : ''}
    ${o.mark
      ? `<text x="12" y="16.7" text-anchor="middle" font-family="Outfit, sans-serif" font-size="4" font-weight="700" fill="#fff">${o.mark}</text>`
      : big ? `<text x="12" y="14.6" text-anchor="middle" font-family="'Noto Sans TC', sans-serif" font-size="2.2" font-weight="700" fill="#fff">半</text><text x="12" y="17.1" text-anchor="middle" font-family="'Noto Sans TC', sans-serif" font-size="2.2" font-weight="700" fill="#fff">糖</text>
        <text x="12" y="19.6" text-anchor="middle" font-family="Outfit, sans-serif" font-size="1.05" font-weight="600" letter-spacing=".32" fill="#2a1d16" fill-opacity=".8">HALF SUGAR</text>` : ''}
    ${part('lid', `<path d="${CUP_DOME} Z" fill="url(#${id}-dome)"/>
      <path d="${CUP_DOME}" fill="none" stroke="${ink}" stroke-opacity="${big ? 0.45 : 1}" stroke-width="${line}" stroke-linejoin="round"/>
      <path d="M4.6 7.6Q5.2 3.3 10.6 2.5" fill="none" stroke="#fff" stroke-opacity=".95" stroke-width=".7" stroke-linecap="round"/>
      <path d="M17.6 3.6Q19.6 5 20.2 7" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".35" stroke-linecap="round"/>
      <path d="M2.1 9.2 A9.9 1.3 0 0 0 21.9 9.2 L21.9 8.6 A9.9 1.3 0 0 1 2.1 8.6 Z" fill="url(#${id}-rim)" fill-opacity=".9" stroke="${ink}" stroke-opacity="${big ? 0.4 : 0.9}" stroke-width="${line * 0.8}"/>
      <path d="M3.4 9.6 A8.8 .9 0 0 0 20.6 9.6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".25"/>`)}`;
}

function cup(color, o = {}) {
  const x = EXPLODE.test(o.cls || '');
  return `<svg class="cup ${x ? 'cup-x' : ''} ${o.cls || ''}" viewBox="${x ? WIDE_VIEW : '-2 -6 28 34'}" aria-hidden="true">${cupArt(color, o)}</svg>`;
}
const cupFor = (p, cls = '') => cup(flavor(p.field)[1], { cls, color2: p.field2 ? flavor(p.field2)[1] : '' });

/* ---------- Simulated people ---------- */

const PEOPLE = [
  {
    id: 'p1', alias: 'Mochi', city: 'Taipei', country: 'Taiwan', field: 'Design',
    doing: 'An inventory tool for independent bookstores',
    topics: ['Bookstores', 'Pricing', 'Interviews'],
    fun: 'Has visited 140 independent bookstores across Taiwan.',
    real: { name: 'Yen Shu-Wei', school: 'National Cheng Kung University, Industrial Design', company: 'Logistics startup, 12 people', title: 'Product designer', linkedin: 'linkedin.com/in/shuwei-yen' },
    lines: ['Interesting. How did you get started on it?', 'I interviewed a dozen bookstore owners. What they dread most is stock counting.', 'Which part are you most stuck on right now?', 'If you like, I can send you my interview guide.'],
    take: 'In my experience, talking to three people face to face beats a hundred survey replies.',
    pitch: 'I have run user interviews from scratch twice. I can help you ask the right questions.',
  },
  {
    id: 'p2', alias: 'Kite', city: 'Berlin', country: 'Germany', field: 'Engineering',
    doing: 'An open-source tool that maps bike-lane gaps from GPS traces',
    topics: ['Open data', 'Cities', 'Rust'],
    fun: 'Bikes 40 km to work, even in winter.',
    real: { name: 'Jonas Albrecht', school: 'TU Berlin, Computer Science', company: 'Mobility startup, 40 people', title: 'Backend engineer', linkedin: 'linkedin.com/in/jonas-albrecht' },
    lines: ['Interesting. What made you start on that?', "Here it's the opposite: the city has the data but nobody is allowed to use it.", 'How are you testing whether people actually want it?', "I'd love to see what you have so far, even if it's rough."],
    take: 'I would flip the question: who loses something if this works? Talk to them first.',
    pitch: 'I can build the data side in a weekend. I mostly want to learn how you find users.',
  },
  {
    id: 'p3', alias: 'Sol', city: 'Lagos', country: 'Nigeria', field: 'Founder',
    doing: 'A savings app for market traders who get paid daily',
    topics: ['Fintech', 'Informal markets', 'Distribution'],
    fun: 'Sold handmade soap at the market at age 12.',
    real: { name: 'Adaeze Okonkwo', school: 'University of Lagos, Economics', company: 'Her own startup', title: 'Co-founder', linkedin: 'linkedin.com/in/adaeze-okonkwo' },
    lines: ["That sounds familiar. Our traders don't trust anything that asks for a password.", "What's the hardest part for you right now?", 'We got our first 50 users by standing in the market for a week. Nothing clever.', 'If you want, I can share how we run agent onboarding.'],
    take: 'In my market this fails for one reason: trust. Who vouches for you on day one?',
    pitch: 'I know distribution in places where ads do not work. Happy to trade notes.',
  },
  {
    id: 'p4', alias: 'Nori', city: 'Seoul', country: 'South Korea', field: 'Content',
    doing: 'A newsletter about small factories in Asia',
    topics: ['Manufacturing', 'Writing', 'Community'],
    fun: 'Writes every first draft on a typewriter.',
    real: { name: 'Han Seo-yeon', school: 'Yonsei University, Sociology', company: 'Freelance', title: 'Writer', linkedin: 'linkedin.com/in/seoyeon-han' },
    lines: ['Oh nice. Who is this for, exactly?', "I've interviewed about thirty factory owners. Most said nobody had ever asked.", 'What would make you pay for something like this yourself?', 'Happy to read a draft if you have one.'],
    take: 'Write down the story of one real person who has this problem. It clears things up fast.',
    pitch: 'I can write the story of the project so strangers get it in ten seconds.',
  },
  {
    id: 'p5', alias: 'Pim', city: 'Taipei', country: 'Taiwan', field: 'Research',
    doing: 'Measuring indoor air in old apartments with cheap sensors',
    topics: ['Air quality', 'Sensors', 'Housing'],
    fun: 'Keeps a sensor in the fridge, just to see.',
    real: { name: 'Tsou Ting-An', school: 'National Tsing Hua University, MSc Environmental Engineering', company: 'University lab', title: 'Research assistant', linkedin: 'linkedin.com/in/tingan-tsou' },
    lines: ['I see. Whose problem are you trying to solve?', 'I measured twenty-some old apartments. The kitchen numbers were worse than I expected.', 'Have you tried showing it to users directly?', 'I can share the data. I just really cannot build interfaces.'],
    take: 'I would check for existing data first. Many questions were already measured, just never organized.',
    pitch: 'I can help with data and experiment design. I want to learn how research becomes a product.',
  },
  {
    id: 'p6', alias: 'Rue', city: 'São Paulo', country: 'Brazil', field: 'Design',
    doing: 'A booking tool for independent tattoo artists',
    topics: ['Branding', 'Creators', 'Mobile'],
    fun: 'Has drawn over 300 tattoo designs and has no tattoos.',
    real: { name: 'Beatriz Nogueira', school: 'Universidade de São Paulo, Design', company: 'Design studio, 8 people', title: 'Brand designer', linkedin: 'linkedin.com/in/beatriz-nogueira' },
    lines: ['Love that. How did you find your first users?', "Tattoo artists here take bookings over Instagram DMs. It's chaos.", 'What does it look like today? A sketch is fine.', 'Payments are the part that scares me. Have you dealt with that?'],
    take: 'Show it to people before it looks good. Ugly prototypes get more honest answers.',
    pitch: 'I can make it look and feel right. I need someone to argue with about scope.',
  },
  {
    id: 'p7', alias: 'Tavi', city: 'Bangalore', country: 'India', field: 'Engineering',
    doing: 'Turning voice notes into structured records for small clinics',
    topics: ['Health', 'Speech', 'ML'],
    fun: 'Can recite pi to 80 digits.',
    real: { name: 'Karthik Venkataraman', school: 'IISc Bangalore, MTech', company: 'Health-tech company', title: 'ML engineer', linkedin: 'linkedin.com/in/karthik-venkataraman' },
    lines: ['Got it. What does a normal day of using it look like?', 'Small clinics here write everything by hand, then type it again at night.', "What have you tried that didn't work?", 'I can share the on-device setup if that is useful.'],
    take: 'Measure the boring thing first: how many minutes does this save one person per day?',
    pitch: 'I can handle the ML part. I am looking for people who question my assumptions.',
  },
  {
    id: 'p8', alias: 'Ode', city: 'Taichung', country: 'Taiwan', field: 'Business',
    doing: "Selling small farms' surplus produce to restaurants",
    topics: ['Farming', 'Sales channels', 'Logistics'],
    fun: 'Can tell how sweet a mango is by smell.',
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
  ['other', 'Other'],
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
    roles: [{ name: 'Frontend developer', desc: 'Turn our air data into a simple map people can read in 30 seconds.', filled: false }, { name: 'Designer', desc: 'Make the demo and slides clear on a projector.', filled: false }, { name: 'Data analyst', desc: 'Clean the readings and find the three most surprising numbers.', filled: true }],
    offer: 'Real sensor data from 23 homes', duration: 'Two weekends',
  },
  {
    id: 'b1', by: 'p1', kind: 'side',
    title: 'Building a checker for second-hand cameras.',
    roles: [{ name: 'Hardware sourcing expert', desc: 'Know where camera parts come from and what a fair price looks like.', filled: false }, { name: 'Inspection process expert', desc: 'Design a 10-minute check that sellers can follow.', filled: true }],
    offer: 'Front-end development and a list of 40 sellers', duration: 'Six-week project',
  },
  {
    id: 'b2', by: 'p7', kind: 'startup',
    title: 'Making clinic software that nurses do not hate.',
    roles: [{ name: 'Designer', desc: 'Design screens a nurse can use with one hand during a busy shift.', filled: false }],
    offer: 'A working speech model and three clinics to test in', duration: 'Two-week sprint',
  },
  {
    id: 'b6', by: 'p4', kind: 'competition', event: 'Asia Story Prize', deadline: '2026-12-15',
    title: 'Entering a nonfiction prize with a story about one factory family.',
    roles: [{ name: 'Photographer', desc: 'Spend two days in the factory and photograph the family at work.', filled: false }, { name: 'Editor', desc: 'Tighten the story to 5,000 words.', filled: true }],
    duration: 'Six weeks',
  },
  {
    id: 'b3', by: 'p3', kind: 'startup',
    title: 'Need someone to challenge my pricing before I launch in a second city.',
    roles: [{ name: 'Pricing reviewer', desc: 'Look at our numbers and tell us what you would charge, and why.', filled: false }],
    offer: 'Real numbers from 1,300 users', duration: 'One or two calls',
  },
  {
    id: 'b4', by: 'p8', kind: 'startup',
    title: 'Building a produce ordering system for restaurants.',
    roles: [{ name: 'Backend developer', desc: 'Build the back office where orders come in.', filled: true }, { name: 'Chat bot developer', desc: 'Let restaurants order through a chat app in a few taps.', filled: false }],
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
// How to reach you once the seal is popped
const CONTACTS = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['other', 'Other']];
const contactName = (type) => (CONTACTS.find(([v]) => v === type) || CONTACTS[2])[1];
// [label, value] for a person's contact, or null. Older data only had LinkedIn.
function contactOf(r) {
  if (r && r.contact) return [contactName(r.contactType), r.contact];
  if (r && r.linkedin) return ['LinkedIn', r.linkedin];
  return null;
}

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
  p1: { toppings: ['coconut', 'pudding', 'foam'], field2: 'Engineering', curious: ['Pricing', 'Sales', 'Small business'], share: ['Product design', 'User research', 'Side projects'], stage: 'side', meet: 'both', replyRate: 0.9, activeDays: 0 },
  p2: { toppings: ['grass', 'aloe'], curious: ['Climate tech', 'Community building', 'Fundraising'], share: ['Open data', 'Data analysis', 'Working abroad'], stage: 'side', meet: 'online', replyRate: 0.7, activeDays: 2 },
  p3: { toppings: ['redbean', 'crystal', 'tiger', 'mochi'], curious: ['Product design', 'Hiring', 'AI products'], share: ['Fintech', 'Small business', 'Fundraising'], stage: 'startup', meet: 'online', replyRate: 0.85, activeDays: 1 },
  p4: { toppings: ['coconut'], curious: ['Community building', 'Pricing', 'Supply chains'], share: ['Writing', 'Branding', 'Studying abroad'], stage: 'side', meet: 'online', replyRate: 0.6, activeDays: 3 },
  p5: { toppings: ['aloe', 'crystal', 'taroball'], field2: 'Engineering', curious: ['Product design', 'Health tech', 'Career change'], share: ['Data analysis', 'Hardware', 'Studying abroad'], stage: 'research', meet: 'inperson', replyRate: 0.8, activeDays: 1 },
  p6: { toppings: ['pudding', 'foam', 'sakura'], curious: ['Fintech', 'Sales', 'Side projects'], share: ['Branding', 'Product design', 'Working abroad'], stage: 'startup', meet: 'online', replyRate: 0.75, activeDays: 0 },
  p7: { toppings: ['grass', 'redbean', 'brulee', 'golden'], curious: ['User research', 'Health tech', 'Semiconductors'], share: ['AI products', 'Job interviews', 'Hardware'], stage: 'job', meet: 'online', replyRate: 0.95, activeDays: 0 },
  p8: { toppings: ['redbean', 'tiger'], curious: ['AI in supply chains', 'Side projects', 'Hiring'], share: ['Supply chains', 'Sales', 'Small business'], stage: 'startup', meet: 'inperson', replyRate: 0.65, activeDays: 4 },
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
  bobaRun: !!(t.booking && t.booking.met),
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

/* ---------- State ---------- */

const blank = () => ({ me: null, myThoughts: [], myPosts: [], threads: [], drops: 0, toppings: {}, boxes: [] });

function load() {
  try {
    const saved = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    // Old or damaged data: keep lists as lists and drop chats with people who no longer exist
    ['myThoughts', 'myPosts', 'threads', 'boxes'].forEach((k) => { if (!Array.isArray(saved[k])) saved[k] = []; });
    if (!saved.toppings || typeof saved.toppings !== 'object') saved.toppings = {};
    if (saved.me && typeof saved.me !== 'object') saved.me = null;
    // Older profiles kept only a LinkedIn link; it is now one contact of any kind
    if (saved.me && saved.me.linkedin && !saved.me.contact) Object.assign(saved.me, { contactType: 'linkedin', contact: saved.me.linkedin });
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
  cat: 'all', dm: null, typingPost: null, openSec: {},
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



const flavorChip = (p) => `<span class="flavor" style="--flavor:${flavor(p.field)[1]};--flavor2:${flavor(p.field2 || p.field)[1]}" title="${esc(L`Flavor = field. ${flavorsLabel(p)} means ${fieldsLabel(p)}.`)}">${esc(flavorsLabel(p))}</span>`;

// Name and cup open that person's profile
const whoAttrs = (p) => `data-act="profile" data-pid="${p.id || 'me'}" type="button"`;
const byline = (p, full = false) => `
  <p class="byline">
    <button class="avatar avatar--cup avatar-btn" ${whoAttrs(p)} tabindex="-1" aria-hidden="true">${cupFor(p)}</button>
    <span><button class="name-btn" ${whoAttrs(p)}>${esc(p.alias)}</button> ${flavorChip(p)}${full ? `<br><small>${esc(p.doing)}</small>` : ''}</span>
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

/* ---------- Toppings ----------
   Rewards that land in your cup.
   Every milestone earns one gift box: reaching half sugar, a mutual Mystery Cup
   refill, or a boba run where you both check in. All boxes draw from the same
   toppings, with a small chance of a secret one.
   A gift box shows three closed boxes; you pick one. */

const TOPPINGS = [
  { id: 'coconut', name: 'Coconut jelly', tier: 'small' },
  { id: 'aloe', name: 'Aloe vera', tier: 'small' },
  { id: 'grass', name: 'Grass jelly', tier: 'small' },
  { id: 'redbean', name: 'Red bean', tier: 'small' },
  { id: 'pudding', name: 'Egg pudding', tier: 'small' },
  { id: 'crystal', name: 'Crystal boba', tier: 'small' },
  { id: 'foam', name: 'Cheese foam', tier: 'small' },
  { id: 'tiger', name: 'Brown sugar stripes', tier: 'small' },
  { id: 'taroball', name: 'Taro balls', tier: 'small' },
  { id: 'mochi', name: 'Mochi', tier: 'small' },
  { id: 'brulee', name: 'Crème brûlée', tier: 'small' },
  { id: 'golden', name: 'Golden pearl', tier: 'secret' },
  { id: 'galaxy', name: 'Galaxy jelly', tier: 'secret' },
  { id: 'sakura', name: 'Sakura jelly', tier: 'secret' },
];
const TOPPING = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
const SECRET_CHANCE = 0.1;
const TIER_NAME = { small: 'Topping', secret: 'Secret topping' };
const TIER_HOW = {
  small: 'Reach half sugar, refill a Mystery Cup together, or both show up to a boba run.',
  secret: 'Found by luck in any gift box.',
};

// Three different toppings for the three boxes. Every box draws from the same toppings.
function rollBoxes() {
  const out = [];
  while (out.length < 3) {
    const tier = Math.random() < SECRET_CHANCE ? 'secret' : 'small';
    const pool = TOPPINGS.filter((t) => t.tier === tier && !out.includes(t.id));
    if (pool.length) out.push(pick(pool).id);
  }
  return out;
}

const myToppings = () => Object.keys(S.toppings || {}).filter((k) => TOPPING[k] && S.toppings[k] > 0);
// Your cup shows up to 5 toppings, and you choose which. Until you choose, the first 5 you own.
const MAX_SHOWN = 5;
const shownToppings = () => {
  const own = myToppings();
  return Array.isArray(S.shown) ? S.shown.filter((k) => own.includes(k)) : own.slice(0, MAX_SHOWN);
};
const toppingsOf = (pid) => (pid === 'me' ? shownToppings() : (P[pid].toppings || []));

// Toppings are small illustrations in the same style as the cup: a thin
// dark-brown outline, soft colour with one gentle shade, and a short white
// highlight. Each is drawn around (x, y) at size s; one unit is about the
// topping's half-width. Every SVG gets its own gradient ids so they never clash.
function toppingDefs(id) {
  const lin = (name, a, b, angle = '0 0 1 1') => {
    const [x1, y1, x2, y2] = angle.split(' ');
    return `<linearGradient id="${id}-${name}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  };
  const rad = (name, a, b, c) => `<radialGradient id="${id}-${name}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
  return `<defs>
    ${lin('coco', '#ffffff', '#ebe1cb')}
    ${lin('aloe', '#eef8dc', '#b4d68b')}
    ${lin('grass', '#57463a', '#241a13')}
    ${lin('galaxy', '#8a7ae6', '#33267a')}
    ${lin('bean', '#a8392f', '#5e1813')}
    ${lin('flan', '#fae29a', '#e3a93f', '0 0 1 0')}
    ${lin('taro', '#cdb6e6', '#9572c0')}
    ${lin('sweet', '#ffc48a', '#e98a3d')}
    ${lin('mochi', '#ffffff', '#efe4d0', '0 0 0 1')}
    ${lin('dish', '#ffffff', '#ece3d2', '0 0 1 0')}
    ${lin('syrup', '#b9732f', '#5c2c0e')}
    ${lin('foamL', '#ffffff', '#f0e1c2', '0 0 0 1')}
    ${lin('bruL', '#7a3c10', '#f0cd84', '0 0 0 1')}
    ${rad('crystal', '#ffffff', '#f3ecdf', '#d7c8ab')}
    ${rad('gold', '#fff4bf', '#ecbd43', '#a8761b')}
    ${rad('caramel', '#e9a85b', '#b8692a', '#7a3c10')}
    ${rad('foam', '#ffffff', '#fbf3e3', '#e6d4b2')}
    ${rad('drop', '#ffffff', '#fdeef2', '#f3cddb')}
  </defs>`;
}

const INK = '#2a1d16';
const ink = (s) => `stroke="#3b2518" stroke-opacity=".12" stroke-width="${(0.06 * s).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`;
const glint = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".11" stroke-linecap="round"/>`;
const shadow = (x, y, s) => `<ellipse cx="${x}" cy="${y + 0.9 * s}" rx="${0.68 * s}" ry="${0.13 * s}" fill="#3b2518" fill-opacity=".14"/>`;

// Everything inside a topping is drawn at unit size, then moved and scaled
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// A soft rounded jelly cube with a lighter core you can see into
const jelly = (fill, core, coreOpacity, opacity = 1, tilt = -10) => `
  <g transform="rotate(${tilt})" fill-opacity="${opacity}">
    <rect x="-.75" y="-.72" width="1.5" height="1.44" rx=".34" fill="${fill}" ${ink(1)}/>
    <rect x="-.42" y="-.38" width=".84" height=".76" rx=".2" fill="${core}" fill-opacity="${coreOpacity}"/>
    ${glint('M-.52 -.3 Q-.5 -.52 -.28 -.54')}
  </g>`;

const PIECE = {
  coconut: (id, x, y, s) => at(x, y, s, jelly(`url(#${id}-coco)`, '#fff', 0.7, 0.97, -12)),
  aloe: (id, x, y, s) => at(x, y, s, `${jelly(`url(#${id}-aloe)`, '#f6fcec', 0.65, 0.95, 8)}<circle cx=".25" cy=".22" r=".08" fill="#fff" fill-opacity=".8"/>`),
  grass: (id, x, y, s) => at(x, y, s, jelly(`url(#${id}-grass)`, '#7a6553', 0.35, 1, -6)),
  galaxy: (id, x, y, s) => at(x, y, s, `${jelly(`url(#${id}-galaxy)`, '#b9adf5', 0.25, 1, 10)}
    <circle cx="-.2" cy=".25" r=".06" fill="#fff"/><circle cx=".3" cy="-.05" r=".05" fill="#fff"/>
    <path d="M.12 -.4l.05.13.13.05-.13.05-.05.13-.05-.13-.13-.05.13-.05z" fill="#fff"/>`),
  // Kidney-shaped beans with a little pale line where they joined the pod
  redbean: (id, x, y, s) => at(x, y, s, [[-0.36, 0.22, -25], [0.4, 0.28, 30], [0.02, -0.34, 5]].map(([bx, by, r]) => `
    <g transform="translate(${bx} ${by}) rotate(${r})">
      <path d="M-.42 -.05 Q-.42 -.3 -.12 -.3 Q.05 -.3 .12 -.22 Q.2 -.3 .3 -.28 Q.46 -.24 .44 0 Q.42 .28 0 .28 Q-.42 .28 -.42 -.05 Z" fill="url(#${id}-bean)" ${ink(1)}/>
      <path d="M.02 -.2 Q.08 -.14 .15 -.17" fill="none" stroke="#f2dccd" stroke-width=".07" stroke-linecap="round"/>
      ${glint('M-.3 -.06 Q-.28 -.18 -.15 -.2')}
    </g>`).join('')),
  // Flan with caramel on top, dripping a little down the sides
  pudding: (id, x, y, s) => at(x, y, s, `
    <path d="M-.58 -.38 L.58 -.38 L.82 .5 Q0 .74 -.82 .5 Z" fill="url(#${id}-flan)" ${ink(1)}/>
    <path d="M-.58 -.38 L.58 -.38 L.62 -.22 Q.5 -.18 .46 -.05 Q.4 .04 .36 -.12 Q.2 -.2 .05 -.16 Q-.05 .08 -.15 -.16 Q-.35 -.18 -.45 -.12 Q-.52 .02 -.58 -.2 Z" fill="#8f4b17"/>
    <ellipse cx="0" cy="-.38" rx=".58" ry=".16" fill="url(#${id}-caramel)" ${ink(1)}/>
    ${glint('M-.55 .05 L-.62 .38')}`),
  crystal: (id, x, y, s) => at(x, y, s, `
    <circle r=".76" fill="url(#${id}-crystal)" fill-opacity=".9" ${ink(1)}/>
    <circle cx=".1" cy=".12" r=".42" fill="#fff" fill-opacity=".35"/>
    ${glint('M-.45 -.15 Q-.42 -.45 -.12 -.52')}`),
  // Chewy little pillows: purple taro and orange sweet potato
  taroball: (id, x, y, s, n) => at(x, y, s, `
    <g transform="rotate(${n % 2 ? 18 : -14})">
      <rect x="-.68" y="-.46" width="1.36" height=".92" rx=".44" fill="url(#${id}-${n % 2 ? 'sweet' : 'taro'})" ${ink(1)}/>
      ${glint('M-.4 -.22 Q-.2 -.32 .05 -.3')}
    </g>`),
  mochi: (id, x, y, s) => at(x, y, s, `
    <path d="M-.86 .2 Q-.9 -.55 0 -.58 Q.9 -.55 .86 .2 Q.8 .52 0 .52 Q-.8 .52 -.86 .2 Z" fill="url(#${id}-mochi)" ${ink(1)}/>
    <g fill="#e9dcc4"><circle cx="-.3" cy="-.15" r=".05"/><circle cx=".2" cy="-.3" r=".04"/><circle cx=".42" cy=".05" r=".05"/><circle cx="-.05" cy=".18" r=".04"/></g>
    ${glint('M-.55 -.22 Q-.45 -.42 -.2 -.45')}`),
  golden: (id, x, y, s) => at(x, y, s, `
    <circle r=".78" fill="url(#${id}-gold)" ${ink(1)}/>
    ${glint('M-.45 -.18 Q-.4 -.45 -.12 -.5')}
    <path d="M.62 -.92l.08.22.22.08-.22.08-.08.22-.08-.22-.22-.08.22-.08z" fill="#fff6c8"/>`),
  // A clear drop of jelly with a sakura flower inside
  sakura: (id, x, y, s) => at(x, y, s, `
    <path d="M-.86 .42 Q-.92 -.82 0 -.82 Q.92 -.82 .86 .42 Q0 .66 -.86 .42 Z" fill="url(#${id}-drop)" fill-opacity=".9" ${ink(1)}/>
    <g transform="translate(0 -.06)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-.2" rx=".12" ry=".2" fill="#f29abb" transform="rotate(${a})"/>`).join('')}<circle r=".08" fill="#fff0a3"/></g>
    ${glint('M-.55 -.1 Q-.5 -.52 -.2 -.62')}`),
};

// Toppings that are not floating pieces get their own picture for chips and gift boxes
const LAYER_ICON = {
  // A swirled dollop of cream cheese foam
  foam: (id) => `
    <path d="M-.92 .5 C-1 .05 -.62 -.12 -.38 -.15 C-.42 -.55 -.05 -.8 .18 -.95 C.14 -.6 .58 -.52 .52 -.16 C.85 -.12 1 .2 .9 .5 Q0 .72 -.92 .5 Z" fill="url(#${id}-foamL)" ${ink(1)}/>
    <path d="M-.5 .12 Q0 .3 .55 .1 M-.25 -.18 Q.1 -.05 .4 -.2" fill="none" stroke="#dcc6a0" stroke-width=".07" stroke-linecap="round"/>
    ${glint('M-.65 .25 Q-.7 0 -.45 -.08')}`,
  // Brown sugar syrup dripping down
  tiger: (id) => `
    <path d="M-.92 -.75 H.92 V-.42 Q.78 -.36 .74 -.05 Q.7 .5 .52 .5 Q.34 .5 .34 0 Q.3 -.24 .1 -.24 Q-.1 -.24 -.12 .3 Q-.16 .9 -.38 .9 Q-.6 .9 -.6 .3 Q-.62 -.3 -.92 -.36 Z" fill="url(#${id}-syrup)" ${ink(1)}/>
    ${glint('M-.42 .1 L-.44 .55')}${glint('M.48 -.05 L.47 .22')}`,
  // A white ramekin with a torched sugar top
  brulee: (id) => `
    <path d="M-.94 -.2 L-.84 .52 Q0 .74 .84 .52 L.94 -.2 Z" fill="url(#${id}-dish)" ${ink(1)}/>
    <g stroke="#ddd2bf" stroke-width=".06">${[-0.6, -0.3, 0, 0.3, 0.6].map((dx) => `<path d="M${dx} 0 L${dx * 0.92} .55"/>`).join('')}</g>
    <ellipse cx="0" cy="-.2" rx=".94" ry=".28" fill="url(#${id}-caramel)" ${ink(1)}/>
    <g fill="#5e2c0c" fill-opacity=".55"><ellipse cx="-.3" cy="-.22" rx=".14" ry=".05"/><ellipse cx=".35" cy="-.16" rx=".1" ry=".04"/><ellipse cx=".05" cy="-.3" rx=".08" ry=".03"/></g>
    ${glint('M-.55 -.3 Q-.35 -.38 -.12 -.38')}`,
};

const PIECE_SLOTS = [[6.6, 12.6], [12, 11], [17.4, 12.6], [7, 15.4], [17, 15.4], [7.4, 18.3], [16.6, 18.3], [8.8, 11.6], [15.2, 11.6], [18.1, 20.2]];
const PIECE_SIZE = 1.15;

// Your base drink with your toppings in it
function drinkCup(p, ids = [], cls = '') {
  return `<svg class="cup drink ${EXPLODE.test(cls) ? 'cup-x' : ''} ${cls}" viewBox="${EXPLODE.test(cls) ? WIDE_VIEW : '-2 -6 28 34'}" role="img" aria-label="${esc(drinkFor(p))}${ids.length ? esc(L`, with ${ids.length} toppings`) : ''}">${cupArt(flavor(p.field)[1], { cls, ids, level: 0.82, color2: p.field2 ? flavor(p.field2)[1] : '' })}</svg>`;
}

// A topping on its own, for chips and gift boxes
function toppingIcon(k) {
  const id = 'ti' + uid();
  const art = PIECE[k] ? PIECE[k](id, 0, 0, 1, 0) : LAYER_ICON[k](id);
  return `<svg class="ti" viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">${toppingDefs(id)}${shadow(0, 0.02, 1)}${art}</svg>`;
}

// Five fixed slots for what is in a cup: filled ones show the topping, empty ones a dashed circle
const toppingSlots = (ids) => `<ul class="slots" aria-label="${esc(ids.length ? ids.map((k) => L(TOPPING[k].name)).join(', ') : L`No toppings yet`)}">${Array.from({ length: MAX_SHOWN }, (_, i) => {
  const k = ids[i];
  return k ? `<li class="slot slot--${TOPPING[k].tier}" title="${esc(L(TOPPING[k].name))}">${toppingIcon(k)}</li>` : '<li class="slot slot--empty" aria-hidden="true"></li>';
}).join('')}</ul>`;

const toppingChip = (k, count = 1) => `<span class="tchip tchip--${TOPPING[k].tier}">${toppingIcon(k)}${esc(L(TOPPING[k].name))}${count > 1 ? `<b>×${count}</b>` : ''}</span>`;

// Gift boxes wait in a queue until you open them
function earnBox(tier, reason, vars = []) {
  S.boxes = S.boxes || [];
  S.boxes.push({ id: uid(), tier, reason, vars });
  save();
  toast(L`You earned a gift box!`);
  later(700, () => { if (!U.modal) openNextBox(); });
}

function openNextBox() {
  if (!(S.boxes || []).length) return;
  const box = S.boxes[0];
  U.modal = { type: 'box', box, contents: rollBoxes(), picked: null, phase: 'pick' };
  renderModal();
}

/* ---------- Pop-up window: gift boxes and profiles ---------- */

const modalEl = document.createElement('div');
modalEl.id = 'modal';
document.body.appendChild(modalEl);
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const giftSvg = (tier) => `
  <svg class="gift__art" viewBox="0 0 60 60" aria-hidden="true">
    <rect class="gift__body" x="9" y="27" width="42" height="27" rx="4"/>
    <rect class="gift__ribbon" x="27" y="27" width="6" height="27"/>
    <g class="gift__lid">
      <rect class="gift__top" x="6" y="18" width="48" height="11" rx="3"/>
      <rect class="gift__ribbon" x="27" y="18" width="6" height="11"/>
      <path class="gift__bow" d="M30 18c-4-8-13-8-11-2 1 3 7 3 11 2zm0 0c4-8 13-8 11-2-1 3-7 3-11 2z"/>
    </g>
  </svg>`;

function boxModal(m) {
  const opened = m.phase === 'open';
  const got = opened && TOPPING[m.contents[m.picked]];
  const left = (S.boxes || []).length;
  return `
    <div class="modal__card modal__card--box" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="${esc(L`Close`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
      <p class="tier-tag">${L`Gift box`}</p>
      <h2 id="modal-title">${opened ? L`You got ${esc(L(got.name))}!` : L`Pick a box.`}</h2>
      <p class="sub">${esc(tr(m.box.reason, m.box.vars))}</p>
      <div class="gifts">
        ${m.contents.map((k, i) => `
        <button class="gift ${m.picked === i ? 'is-picked' : ''} ${m.picked !== null && m.picked !== i ? 'is-other' : ''} is-${m.phase}" data-act="box-pick" data-i="${i}" type="button" ${m.phase === 'pick' ? '' : 'disabled'} aria-label="${esc(L`Box ${i + 1}`)}">
          ${giftSvg()}
          ${opened ? `<span class="gift__prize">${toppingIcon(k)}</span><small class="gift__name">${esc(L(TOPPING[k].name))}</small>` : ''}
        </button>`).join('')}
      </div>
      ${opened ? `
      <p class="prize-line"><span class="tier-tag tier-tag--${got.tier}">${L(TIER_NAME[got.tier])}</span>${(S.toppings[got.id] || 0) > 1 ? `<span class="meta">${L`You now have ${S.toppings[got.id]}.`}</span>` : ''}</p>
      <div class="btnrow btnrow--center">
        ${left ? `<button class="btn btn--primary" data-act="box-next" type="button">${L`Open next box (${left})`}</button>` : `<button class="btn btn--primary" data-act="modal-close" type="button">${L`Add to my cup`}</button>`}
        <a class="btn btn--ghost" href="#/me">${L`See my cup`}</a>
      </div>` : `<p class="meta">${L`The other two open after you pick.`}</p>`}
    </div>`;
}

// What anyone can see about a person, plus their sealed details once you have both popped the seal
function profileModal(pid) {
  const me = pid === 'me';
  const p = me ? { ...S.me, curious: myCurious(), share: myShare() } : P[pid];
  const ids = toppingsOf(pid);
  const t = me ? null : S.threads.find((x) => x.pid === pid);
  const revealed = t && t.reveal.me && t.reveal.them;
  const stage = (STAGES.find(([v]) => v === p.stage) || [])[1];
  const fun = p.fun || p.proof;
  const chips = (list) => list.map((x) => `<span>${esc(x)}</span>`).join('');
  return `
    <div class="modal__card modal__card--profile" tabindex="-1">
      <button class="modal__x" data-act="modal-close" type="button" aria-label="${esc(L`Close`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
      <div class="pf__top">
        <div class="pf__cup">${drinkCup(p, ids, 'cup--profile')}</div>
        <div class="pf__who">
          <h2 id="modal-title">${esc(me ? S.me.alias : p.alias)}</h2>
          <p>${flavorChip(p)}</p>
          <p class="meta">${[stage && L(stage), p.city].filter(Boolean).map(esc).join(', ')}</p>
          <p class="pf__drink">${esc(drinkFor(p))}</p>
        </div>
      </div>
      <div class="slots-row">${toppingSlots(ids.slice(0, MAX_SHOWN))}</div>
      <dl class="brief">
        ${p.doing ? `<div><dt>${L`Working on`}</dt><dd>${esc(p.doing)}</dd></div>` : ''}
        ${fun ? `<div><dt>${L`Fun fact`}</dt><dd>${esc(fun)}</dd></div>` : ''}
      </dl>
      ${p.curious && p.curious.length ? `<div class="pf__tags"><p class="field__label">${L`Curious about`}</p><p class="chips">${chips(p.curious)}</p></div>` : ''}
      ${p.share && p.share.length ? `<div class="pf__tags"><p class="field__label">${L`Can share`}</p><p class="chips">${chips(p.share)}</p></div>` : ''}
      ${me ? '' : revealed ? `
      <dl class="brief brief--locked">
        <div><dt>${L`Name`}</dt><dd>${esc(p.real.name)}</dd></div>
        <div><dt>${L`School`}</dt><dd>${esc(p.real.school)}</dd></div>
        <div><dt>${L`Company`}</dt><dd>${esc(p.real.company)}</dd></div>
        <div><dt>${L`Job title`}</dt><dd>${esc(p.real.title)}</dd></div>
        ${contactOf(p.real) ? `<div><dt>${esc(L(contactOf(p.real)[0]))}</dt><dd>${esc(contactOf(p.real)[1])}</dd></div>` : ''}
      </dl>` : `<p class="pf__sealed"><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Name, school and company stay sealed until you both pop the seal.`}</p>`}
      <div class="pf__actions">
        ${me
          ? ''
          : t ? `<a class="btn btn--dark btn--sm" href="#/chats/${t.id}">${L`Open chat`}</a>`
          : `<form class="stack" data-form="hi" data-pid="${pid}" novalidate>
              <label class="sr" for="c-hi">${L`Say hi`}</label>
              <textarea id="c-hi" name="hi" rows="2" placeholder="${esc(L`Say hi. Start with what caught your eye.`)}"></textarea>
              <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
            </form>`}
      </div>
    </div>`;
}

function renderModal() {
  const m = U.modal;
  document.body.classList.toggle('modal-open', !!m);
  if (!m) { modalEl.innerHTML = ''; return; }
  const wasOpen = !!modalEl.firstElementChild;
  modalEl.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__backdrop" data-act="modal-close"></div>
      ${m.type === 'box' ? boxModal(m) : profileModal(m.pid)}
    </div>`;
  if (!wasOpen) $('.modal__card', modalEl).focus();
}

function closeModal() {
  U.modal = null;
  renderModal();
  render();
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
// On Me each half of the card folds into a short summary; tap Edit to open it
function secStart(key, icon, title, summary) {
  return `<details class="panel sec ${key === 'sealed' ? 'panel--locked' : ''}" data-sec="${key}" ${U.openSec[key] ? 'open' : ''}>
      <summary class="sec__head">
        <span class="sec__title"><i class="ph ${icon}" aria-hidden="true"></i>${title}</span>
        <span class="sec__edit">${L`Edit`}</span>
        <div class="sec__sum">${summary}</div>
      </summary>
      <div class="sec__body stack">`;
}

function publicSummary(me) {
  const line = [me.alias, flavorsLabel(me), me.city].filter(Boolean).map(esc).join(' · ');
  const tags = (label, list) => (list.length ? `<p class="meta">${label}: ${esc(list.join(', '))}</p>` : '');
  const meet = (MEETS.find(([v]) => v === me.meet) || [])[1];
  return `<p><strong>${line}</strong></p>${meet ? `<p class="meta">${L`Meet`}: ${esc(L(meet))}</p>` : ''}${tags(L`Curious`, myCurious())}${me.fun ? `<p class="meta">${L`Fun fact`}: ${esc(me.fun)}</p>` : ''}`;
}

function sealedSummary(me) {
  const keys = [['name', L`name`], ['title', L`title`], ['school', L`school`], ['company', L`company`], ['contact', L`contact`]];
  const filled = keys.filter(([k]) => me[k]);
  return `<p class="meta">${filled.length ? L`${filled.length} of 5 filled: ${filled.map(([, l]) => l).join(', ')}` : L`Nothing added yet.`}</p>`;
}

function profileForm(me, first) {
  me = me || {};
  const fold = !first;
  return `
  <form data-form="profile" class="stack profile-form ${fold ? 'is-folding' : ''}" novalidate>
    ${fold ? secStart('public', 'ph-eye', L`Visible from the start`, publicSummary(me)) : `<fieldset class="panel">
      <legend><i class="ph ph-eye" aria-hidden="true"></i>${L`Visible from the start`}</legend>`}
      ${field('alias', L`Nickname`, me.alias, { req: true, hint: L`Not your real name.` })}
      ${first ? '' : `
      <div class="row2">
        ${select('field', L`Field (your flavor)`, FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`]), me.field || FIELDS[0])}
        ${select('field2', L`Second field (optional)`, [['', L`None`], ...FIELDS.map((f) => [f, L`${fieldName(f)}, ${flavorName(f)}`])], me.field2 || '')}
      </div>
      <div class="row2">
        ${field('city', L`City`, me.city, { ph: L`e.g. Taipei` })}
        ${select('meet', L`How you like to meet`, MEETS.map(([v, l]) => [v, L(l)]), me.meet || 'both')}
      </div>
      ${tagEditor('me', 'curious', myCurious(), L`Curious about`)}`}
      ${field('fun', L`Fun fact`, me.fun ?? me.proof, { ph: L`Something people would not guess about you` })}
    ${fold ? '</div></details>' : '</fieldset>'}
    ${fold ? secStart('sealed', 'ph-lock-simple', L`Sealed until you both pop the seal`, sealedSummary(me)) : `<fieldset class="panel panel--locked">
      <legend><i class="ph ph-lock-simple" aria-hidden="true"></i>${L`Sealed until you both pop the seal`}</legend>`}
      <div class="row2">
        ${field('name', L`Real name`, me.name)}
        ${field('title', L`Job title`, me.title)}
      </div>
      <div class="row2">
        ${field('school', L`School`, me.school)}
        ${field('company', L`Company`, me.company)}
      </div>
      <div class="row2 row2--contact">
        ${select('contactType', L`Contact`, CONTACTS.map(([v, l]) => [v, L(l)]), me.contactType || 'instagram')}
        ${field('contact', L`Handle or link`, me.contact, { ph: L`e.g. @yourname` })}
      </div>
    ${fold ? '</div></details>' : '</fieldset>'}
    <p class="error" id="profile-error" hidden>${L`Please add a nickname.`}</p>
    <button class="btn btn--primary save-btn" type="submit">${first ? L`Start sipping` : L`Save`}</button>
  </form>`;
}

/* ---------- Screen: onboarding ----------
   A few quick questions, one per screen, then the profile form.
   Single-choice answers move on by themselves. */

const QUIZ_STEPS = 3;

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
    <h2 class="quiz__q">${L`How do you like to meet?`}</h2>
    <div class="options">${MEETS.map(([v, l]) => option('meet', v, L(l))).join('')}</div>
    ${field('city', L`Which city are you in?`, q.city, { ph: L`e.g. Taipei` })}`;
  }
  if (q.step === 2) {
    return `
    <h2 class="quiz__q">${L`What are you curious about?`}</h2>
    <p class="quiz__hint">${L`Things you would love to hear about. Type your own or tap one.`}</p>
    ${tagEditor('quiz', 'curious', q.curious, L`Curious about`)}`;
  }
  return `
    <h2 class="quiz__q">${L`Last step: a little about you.`}</h2>
    ${profileForm(null, true)}`;
}

function viewOnboard() {
  const q = U.quiz;
  const shown = U.quizShown;
  U.quizShown = q.step;
  const canNext = [q.field, q.meet, q.curious.length][q.step];
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
    <section class="quiz ${shown === q.step ? '' : 'enter'}">${quizStep(q)}</section>
    <div class="quiz__nav">
      ${q.step ? `<button class="btn btn--ghost" data-act="quiz-back" type="button"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`Back`}</button>` : '<span></span>'}
      ${q.step < QUIZ_STEPS ? `<button class="btn btn--primary" data-act="quiz-next" type="button" ${canNext ? '' : 'disabled'}>${L`Next`}</button>` : ''}
    </div>
  </main>`;
}

function viewMe() {
  return `
  <header class="head">
    <div><h1 lang="en">${L`Me`}</h1><p class="sub">${L`Your profile and your usual. Change them any time.`}</p></div>
  </header>
  <section class="receipt mydrink">
    <div class="mydrink__cup">${drinkCup(S.me, shownToppings(), 'cup--profile')}</div>
    <div class="mydrink__info">
      <p class="receipt__label">${L`Your usual`}</p>
      <p class="receipt__item">1 × ${esc(drinkFor(S.me))}</p>
      <div class="slots-row">${toppingSlots(shownToppings())}<span class="receipt__meta">${L`In your cup ${shownToppings().length}/${MAX_SHOWN}`}</span></div>
      <div class="pick-toppings">
        <p class="receipt__meta">${myToppings().length ? L`Your toppings. Tap to add or take out.` : L`No toppings yet.`}</p>
        <div class="strip-wrap">
        <button class="strip-arrow" data-act="strip" data-dir="-1" type="button" aria-label="${esc(L`Scroll left`)}"><i class="ph ph-caret-left" aria-hidden="true"></i></button>
        <div class="pick-strip">${myToppings().map((k) => {
          const on = shownToppings().includes(k);
          return `<button class="tchip tchip--${TOPPING[k].tier} tchip-btn ${on ? 'is-on' : ''}" data-act="topping-toggle" data-id="${k}" type="button" aria-pressed="${on}">${toppingIcon(k)}${esc(L(TOPPING[k].name))}${S.toppings[k] > 1 ? `<b>×${S.toppings[k]}</b>` : ''}<i class="ph ${on ? 'ph-check' : 'ph-plus'}" aria-hidden="true"></i></button>`;
        }).join('')}</div>
        <button class="strip-arrow" data-act="strip" data-dir="1" type="button" aria-label="${esc(L`Scroll right`)}"><i class="ph ph-caret-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="btnrow">
        ${(S.boxes || []).length ? `<button class="btn btn--primary btn--sm gift-cta" data-act="box-next" type="button"><i class="ph ph-gift" aria-hidden="true"></i>${L`Open gift box (${S.boxes.length})`}</button>` : ''}
        <button class="btn btn--ghost btn--sm" data-act="profile" data-pid="me" type="button">${L`See my profile`}</button>
      </div>
    </div>
  </section>
  ${profileForm(S.me, false)}
  <section class="panel note">
    <h2>${L`Demo mode`}</h2>
    <p><a class="inline-link" href="#/about">${L`What is Half Sugar?`}</a></p>
    <p>${L`Not connected to a server yet. Your data stays in this browser, and the other people are simulated.`}</p>
    <button class="btn btn--ghost btn--sm" data-act="dev-box" type="button">Dev: get a gift box</button>
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
      ${byline(P[r.pid], true)}
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
const authorLine = (by, full = false) => byline(by === 'me' ? { ...S.me, alias: L`You` } : P[by], full);

function agoText(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return L`just now`;
  if (m < 60) return L`${m}m ago`;
  if (m < 1440) return L`${Math.floor(m / 60)}h ago`;
  return L`${Math.floor(m / 1440)}d ago`;
}

// One line about who someone is, so you know who you are messaging
const introLine = (p) => p.doing;

const commentCount = (n) => (n === 1 ? L`1 comment` : L`${n} comments`);

// Message someone you met in Explore. `spot` says where the box opens, so only one shows at a time.
function dmBox(pid, spot) {
  const existing = S.threads.find((t) => t.pid === pid);
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Open chat`}</a>`;
  if (U.dm && U.dm.pid === pid && U.dm.spot === spot) {
    return `
      <form class="stack reply" data-form="dm" data-pid="${pid}" data-post="${esc(spot.split(':')[0])}" novalidate>
        ${parseRoute().name === 'post' ? '' : `<div class="dm-who">${byline(P[pid], true)}</div>`}
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
      <div class="forum-post__foot">
        ${authorLine(post.by)}
        <a class="count-link" href="#/post/${post.id}" aria-label="${esc(commentCount(commentsOf(post).length))}"><i class="ph ph-chat-circle" aria-hidden="true"></i>${commentsOf(post).length}</a>
        <span class="meta">${agoText(post.at)}</span>
        ${post.by === 'me' ? '' : dmBox(post.by, post.id)}
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
    <div class="brew-nudge" id="brew-nudge" hidden>
      <i class="ph ph-hammer" aria-hidden="true"></i>
      <p>${L`Looking for people to build with? Brew is made for that.`}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="to-brew" type="button">${L`Move to Brew`}</button>
        <button class="btn btn--ghost btn--sm" data-act="nudge-off" type="button">${L`Keep it here`}</button>
      </div>
    </div>
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
    ${authorLine(post.by, true)}
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
        <button class="avatar avatar--cup avatar-btn" data-act="profile" data-pid="${c.by}" type="button" tabindex="-1" aria-hidden="true">${cupFor(c.by === 'me' ? S.me : P[c.by])}</button>
        <div class="comment__body">
          <p class="comment__head">
            <button class="name-btn" data-act="profile" data-pid="${c.by}" type="button">${esc(authorName(c.by))}</button>
            ${c.by === 'me' ? '' : flavorChip(P[c.by])}
            ${c.by !== 'me' && c.by === post.by ? `<span class="tag">${L`Author`}</span>` : ''}
            <span class="meta">${agoText(c.at)}</span>
          </p>
          ${c.by === 'me' ? '' : `<p class="comment__intro">${esc(introLine(P[c.by]))}</p>`}
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
          ${r.desc
            ? `<details class="role__more"><summary class="role__name">${esc(r.name)}</summary><p>${esc(r.desc)}</p></details>`
            : `<span class="role__name">${esc(r.name)}</span>`}
          ${mine
            ? `<button class="btn btn--ghost btn--sm" data-act="role-toggle" data-id="${b.id}" data-i="${i}" type="button">${r.filled ? L`Reopen` : L`Mark filled`}</button>`
            : r.filled ? `<span class="role__tag">${L`Filled`}</span>` : ''}
        </li>`).join('')}
      </ul>
      <p class="fill">${roles.length && filled === roles.length
        ? `<strong class="done"><i class="ph ph-check" aria-hidden="true"></i>${L`Team complete`}</strong>`
        : `<span class="dots" aria-hidden="true">${[...roles].sort((x, y) => y.filled - x.filled).map((r) => `<i class="${r.filled ? 'on' : ''}"></i>`).join('')}</span><span class="meta">${L`${filled}/${roles.length} filled`}</span>`}</p>`;
}

const brewExtras = (b, mine) => (b.offer || b.duration ? `
      <details class="more">
      <summary>${L`Details`}</summary>
      <dl class="brief">
        ${b.offer ? `<div><dt>${mine ? L`I can offer` : L`Offers`}</dt><dd>${esc(b.offer)}</dd></div>` : ''}
        ${b.duration ? `<div><dt>${L`Time`}</dt><dd>${esc(b.duration)}</dd></div>` : ''}
      </dl>
      </details>` : '');

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
              <p class="hint role-hint">${esc(open[0].desc || '')}</p>
              ${field('reply', L`Why you are a fit`, '', { area: true, rows: 3, req: true, ph: L`Say what you would bring. They cannot see your titles` })}
              <div class="btnrow">
                <button class="btn btn--dark btn--sm" type="submit">${L`Send anonymously`}</button>
                <button class="btn btn--ghost btn--sm" data-act="target" data-id="" type="button">${L`Cancel`}</button>
              </div>
            </form>`
          : `<button class="btn btn--dark btn--sm" data-act="target" data-id="${b.id}" type="button">${L`Apply anonymously`}</button>`}
    </article>`;
}

// Roles for a new Brew: type one or tap a suggestion, then describe it if you like
function roleEditor() {
  const roles = U.draft.roles;
  const left = ROLE_SUGGESTIONS.filter((x) => !roles.some((r) => normTag(r.name) === normTag(x)));
  return `
    <div class="field tags" role="group" aria-labelledby="roles-label">
      <p class="field__label" id="roles-label">${L`Roles you need`}</p>
      ${roles.length ? `<ul class="role-drafts">${roles.map((r, i) => `
        <li class="role-draft">
          <div class="role-draft__head">
            <strong>${esc(r.name)}</strong>
            <button class="icon-btn" type="button" data-act="role-remove" data-i="${i}" aria-label="${esc(L`Remove ${r.name}`)}"><i class="ph ph-x" aria-hidden="true"></i></button>
          </div>
          <textarea id="rd-${i}" data-role-desc="${i}" rows="2" aria-label="${esc(L`What the ${r.name} will do`)}" placeholder="${esc(L`What will they do? (optional)`)}">${esc(r.desc)}</textarea>
        </li>`).join('')}</ul>` : ''}
      ${roles.length < MAX_ROLES ? `
      <div class="tags__add">
        <input id="c-role" data-role-input autocomplete="off" aria-label="${esc(L`Roles you need`)}" placeholder="${esc(L`Type a role and press Enter`)}">
        <button class="btn btn--ghost btn--sm" data-act="role-add" type="button">${L`Add`}</button>
      </div>
      <div class="tags__suggest">${left.map((x) => `<button class="cat cat--sm" data-act="role-add" data-value="${esc(x)}" type="button">+ ${esc(x)}</button>`).join('')}</div>` : ''}
    </div>`;
}

// Keep what was typed in the description boxes before the form is drawn again
function syncRoleDescs() {
  document.querySelectorAll('[data-role-desc]').forEach((box) => {
    const role = U.draft.roles[Number(box.dataset.roleDesc)];
    if (role) role.desc = box.value;
  });
}

function viewBuild() {
  // Text carried over from an Explore post that was really looking for people
  const prefill = U.pendingBrew || '';
  U.pendingBrew = null;
  const open = SEED_POSTS.filter((b) => openRoles(b).length);
  const forYou = topPicks(open.map((b) => P[b.by]), BREW_TOP_PICKS, dayKey() + 'brew').map((p) => SEED_POSTS.find((b) => b.by === p.id));
  const rest = SEED_POSTS.filter((b) => !forYou.includes(b));
  const d = U.draft;

  return `
  <header class="head">
    <div><h1 lang="en">${L`Brew`}</h1><p class="sub" lang="en">${L`I need someone for something.`}</p></div>
    <button class="btn btn--primary" data-act="compose" data-what="post" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`Start a brew`}</button>
  </header>

  ${U.compose === 'post' ? `
  <form class="panel stack" data-form="post" novalidate>
    ${field('title', L`What are you building?`, prefill, { area: true, req: true, ph: L`e.g. A shared-kitchen platform for home cooks` })}
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
      <div class="swirl">${cup('var(--orange)', { level: 0.82, mark: '?', cls: 'cup--lg' })}</div>
      <div class="pearls" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1>${L`Shaking your mystery cup`}</h1>
      <p class="sub">${L`Different field, different city, one thing in common.`}</p>
    </section>`;
  }

  if (D.phase === 'live') {
    // The chat flips open right after a match (the first redraws happen within this window)
    const flip = Date.now() < D.flipUntil;
    return `
    <section class="chat">
      <header class="chat__head ${flip ? 'flip-in' : ''}">
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
      <p class="drop-card__when">${L`${esc(localTime)}, open ${DROP_MINUTES} minutes`}</p>
      <button class="btn btn--dark" data-act="drop-join" type="button">${open ? L`Pour me one` : L`Try a practice cup`}</button>
    </div>
  </section>
  <ul class="rule-pills">
    <li><i class="ph ph-shuffle" aria-hidden="true"></i>${L`One thing in common`}</li>
    <li><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`${DROP_MINUTES} minutes`}</li>
    <li><i class="ph ph-handshake" aria-hidden="true"></i>${L`Both refill to reveal`}</li>
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
  Object.assign(D, { phase: 'live', flipUntil: Date.now() + 700, pid: p.id, anchor, li: 0, typing: false, result: null, ends: Date.now() + DROP_LENGTH_MS });
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
      t.rewards = { half: true };
      save();
      D.result = 'match';
      earnBox('small', 'For a mutual refill with {0}.', [P[t.pid].alias]);
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
    <div><h1>${L`Chats`}</h1><p class="sub">${L`Every chat starts with a first sip.`}</p></div>
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

  return `
  <section class="chat">
    <header class="chat__head">
      <a class="back" href="#/chats" aria-label="${esc(L`Back to chats`)}"><i class="ph ph-arrow-left" aria-hidden="true"></i></a>
      <div>
        <h1><button class="name-btn name-btn--big" data-act="profile" data-pid="${t.pid}" type="button">${esc(shownName(t))}<i class="ph ph-caret-right" aria-hidden="true"></i></button></h1>
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

    ${t.booking ? `<div class="booking">
      <i class="ph ph-calendar-check" aria-hidden="true"></i>
      <span>${esc(bookingLabel(t.booking))}</span>
      ${t.booking.met ? `<strong class="done"><i class="ph ph-check" aria-hidden="true"></i>${L`You both showed up`}</strong>`
        : t.booking.me ? `<span class="meta">${L`Waiting for them to check in`}</span>`
        : `<button class="btn btn--dark btn--sm" data-act="checkin" data-id="${t.id}" type="button"><i class="ph ph-map-pin" aria-hidden="true"></i>${L`I'm here`}</button>`}
    </div>` : ''}

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
  ['Me', 'ph-user', 'Your profile and your usual drink. It shows your flavor and what you are curious about, never your titles.'],
  ['Flavor', 'ph-drop', 'Your field. Each field is a boba flavor and sets the colour of your cup. Two fields make a two-flavor cup.'],
  ['Sugar', 'ph-chart-line-up', 'How long you two have talked. Every minute adds 5%, so 10 minutes is half sugar (50%), when you can pop the seal. Long pauses do not count.'],
  ['Explore', 'ph-compass', 'A forum by topic. Comment in public, or message someone privately. Top picks come first.'],
  ['Brew', 'ph-hammer', 'Build something together. Post what you need and it goes to the people who fit, or apply to a Brew without showing your titles.'],
  ['Mystery Cup', 'ph-sparkle', 'A surprise match once a week: a different field and background, with one thing in common. You cannot pick who you get.'],
  ['First Sip', 'ph-chat-circle', 'Your first conversation with someone. Real names are still hidden.'],
  ['Pop the seal', 'ph-lock-simple-open', 'Show your real name, school, company and title. It only happens when both of you press it.'],
  ['Refill', 'ph-arrows-clockwise', 'At the end of a Mystery Cup, you both choose Refill to keep talking.'],
  ['Gone cold', 'ph-snowflake', 'A chat closes if nobody replies for 3 days.'],
  ['Toppings', 'ph-gift', 'Rewards for your cup. Each milestone earns a gift box: half sugar, a mutual refill, or a boba run where you both show up. Some toppings are secret.'],
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
        <li><strong>${L`Set up Me.`}</strong> ${L`Pick your flavor and what you are curious about. Your name, titles and contact stay sealed.`}</li>
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
      <h3 class="flavors__title">${L`Toppings`}</h3>
      ${['small'].map((tier) => `
      <div class="about-tops">
        <p class="collection__how"><span class="tier-tag tier-tag--${tier}">${L(TIER_NAME[tier])}</span>${L(TIER_HOW[tier])}</p>
        <div class="pf__toppings">${TOPPINGS.filter((x) => x.tier === tier).map((x) => toppingChip(x.id)).join('')}</div>
      </div>`).join('')}
      <p class="about-tops collection__how"><span class="tier-tag tier-tag--secret">${L`Secret toppings`}</span>${L`A few rare ones hide in gift boxes. Keep sipping to find them.`}</p>
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
  ['me', 'Me', 'ph-user', 'Your profile'],
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
          <i class="ph ${icon}" aria-hidden="true"></i><span class="nav__text"><span ${name === 'chats' ? '' : 'lang="en"'}>${L(label)}</span></span>
          ${name === 'chats' && unread ? `<span class="badge" aria-label="${esc(L`${unread} unread`)}">${unread}</span>` : ''}
          ${name === 'me' && (S.boxes || []).length ? `<span class="badge" aria-label="${esc(L`${S.boxes.length} gift boxes`)}">${S.boxes.length}</span>` : ''}
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
    // Keep the topping row where it was scrolled to when the page is redrawn
    const strip = $('.pick-strip', app);
    const stripX = strip ? strip.scrollLeft : 0;
    draw(opt);
    const after = $('.pick-strip', app);
    if (after && stripX) after.scrollLeft = stripX;
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
    // Content rises in when you arrive on a page, not on every update
    if (path !== lastPath) $('.main', app).classList.add('enter');
  }

  Object.entries(keep).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value; });
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
    if (first) { lastPath = null; go('explore'); render({ fresh: true }); } else { U.openSec = {}; toast(L`Saved`); render({ fresh: true }); }
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
    if (U.compose === 'thought') U.nudgeOff = false;
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

  // Both check in at a boba run: a gift box
  checkin(el) {
    const t = thread(el.dataset.id);
    if (!t || !t.booking || t.booking.me) return;
    t.booking.me = true;
    pushMsg(t, 'sys', 'You checked in at the boba run.');
    later(2200, () => {
      if (!thread(t.id) || t.booking.met) return;
      t.booking.met = true;
      pushMsg(t, 'sys', '{0} checked in too. You both showed up!', [P[t.pid].alias]);
      earnBox('small', 'For showing up to a boba run with {0}.', [P[t.pid].alias]);
    });
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

  profile(el) {
    U.modal = { type: 'profile', pid: el.dataset.pid };
    renderModal();
  },
  'modal-close'() { closeModal(); },
  // Arrows beside the topping row scroll it sideways
  strip(el) {
    const row = el.parentElement.querySelector('.pick-strip');
    if (!row) return;
    const from = row.scrollLeft;
    const to = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, from + Number(el.dataset.dir) * row.clientWidth * 0.7));
    row.scrollTo({ left: to, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    // Some browsers skip smooth scrolling; make sure the row still moves
    later(450, () => { if (row.scrollLeft === from) row.scrollLeft = to; });
  },
  'topping-toggle'(el) {
    const k = el.dataset.id;
    const list = shownToppings();
    if (list.includes(k)) S.shown = list.filter((x) => x !== k);
    else if (list.length >= MAX_SHOWN) { toast(L`Your cup holds ${MAX_SHOWN}. Take one out first.`); return; }
    else S.shown = [...list, k];
    save();
    render();
  },
  'box-next'() { openNextBox(); },
  'box-pick'(el) {
    const m = U.modal;
    if (!m || m.type !== 'box' || m.phase !== 'pick') return;
    m.picked = Number(el.dataset.i);
    m.phase = 'shake';
    renderModal();
    later(REDUCED_MOTION ? 0 : 750, () => {
      if (U.modal !== m) return;
      const k = m.contents[m.picked];
      S.shown = shownToppings();
      S.toppings[k] = (S.toppings[k] || 0) + 1;
      // A new topping goes into your cup if there is room
      if (!S.shown.includes(k) && S.shown.length < MAX_SHOWN) S.shown.push(k);
      S.boxes = S.boxes.filter((b) => b.id !== m.box.id);
      m.phase = 'open';
      save();
      renderModal();
      render();
    });
  },
  // Development shortcut: a free gift box to try the game. Remove before launch.
  'to-brew'() {
    const box = $('#f-text');
    U.pendingBrew = box ? box.value.trim() : '';
    go('build');
  },
  'nudge-off'() {
    U.nudgeOff = true;
    const box = $('#brew-nudge');
    if (box) box.hidden = true;
  },
  'dev-box'() { earnBox('small', 'A free box for testing.'); },

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
    syncRoleDescs();
    const input = document.getElementById('c-role');
    const raw = el.dataset.value || (input ? input.value : '');
    raw.split(/[,，、]/).map((t) => t.trim()).filter(Boolean).forEach((t) => {
      if (U.draft.roles.length < MAX_ROLES && !U.draft.roles.some((r) => normTag(r.name) === normTag(t))) U.draft.roles.push({ name: t, desc: '' });
    });
    if (input) input.value = '';
    render({ focus: 'c-role' });
  },
  'role-remove'(el) {
    syncRoleDescs();
    U.draft.roles.splice(Number(el.dataset.i), 1);
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
    if (U.quiz.step === 1 && city) U.quiz.city = city.value.trim();
    U.quiz.step += 1;
    render({ fresh: true });
  },
  'quiz-back'() {
    const city = document.getElementById('f-city');
    if (U.quiz.step === 1 && city) U.quiz.city = city.value.trim();
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
    S.me = { alias: 'Dev', city: 'Taipei', field: 'Design', meet: 'both', curious: ['Pricing', 'AI products'], fun: 'Has tried every boba shop on one street', name: 'Dev User', title: 'Builder', school: '', company: '', contactType: 'instagram', contact: '@devuser' };
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

// A mouse wheel over the topping row scrolls it sideways
document.addEventListener('wheel', (event) => {
  const row = event.target.closest && event.target.closest('.pick-strip');
  if (!row || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const max = row.scrollWidth - row.clientWidth;
  if (max <= 0) return;
  event.preventDefault();
  row.scrollLeft = Math.max(0, Math.min(max, row.scrollLeft + event.deltaY));
}, { passive: false });

// Remember which sections on Me are open
document.addEventListener('toggle', (event) => {
  const d = event.target;
  if (d.matches && d.matches('details[data-sec]')) U.openSec[d.dataset.sec] = d.open;
}, true);

// Tap a big cup to pull it apart, tap again to put it back
document.addEventListener('click', (event) => {
  const c = event.target.closest('.cup-x');
  if (c && !c.closest('button, a')) c.classList.toggle('is-apart');
});

// Enter in a tag box adds the tag instead of sending the form
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && U.modal) { closeModal(); return; }
  const el = event.target.closest('[data-tag-input], [data-role-input]');
  if (!el || event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  acts[el.hasAttribute('data-role-input') ? 'role-add' : 'tag-add'](el);
});

// Words that usually mean someone is recruiting, not starting a discussion
const RECRUITING = /\b(co-?founders?|teammates?|team members?|collaborators?|hiring|recruit(ing)?|join (my|our) team|(looking for|need|seeking) (a |an |some |someone |people |)(designers?|developers?|engineers?|marketers?|partners?|photographers?|editors?|analysts?|researchers?|writers?|people to))\b|徵|找隊友|招募|找夥伴|合夥人/i;
document.addEventListener('input', (event) => {
  if (event.target.id !== 'f-text' || U.nudgeOff) return;
  const box = $('#brew-nudge');
  if (box) box.hidden = !RECRUITING.test(event.target.value);
});

// Competitions and hackathons ask which one it is
document.addEventListener('change', (event) => {
  if (event.target.id === 'f-role') {
    const form = event.target.closest('form');
    const b = SEED_POSTS.find((x) => x.id === form.dataset.id);
    const role = b && rolesOf(b).find((r) => r.name === event.target.value);
    const hint = $('.role-hint', form);
    if (hint) hint.textContent = (role && role.desc) || '';
    return;
  }
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
  if (U.modal) { U.modal = null; renderModal(); }
  U.target = null;
  U.dm = null;
  U.compose = null;
  U.booking = null;
  U.confirmReset = false;
  // Arriving from Explore's "Move to Brew": open the Brew form with the text
  if (U.pendingBrew != null) { U.compose = 'post'; U.draft = { kind: 'side', roles: [] }; }
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
