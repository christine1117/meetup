/* ---------- Matching ----------
   1. Who can show up: people you do not have a chat with yet.
   2. Score each person from six things (see DEFAULT_WEIGHTS), in both
      directions: "is this person good for you" and "are you good for them".
      Keep the lower one, so a match has to work for both people.
   3. Highest first, no more than two people from one field.
   4. Every chat remembers the score it started with. Once enough chats have
      finished, the weights move toward what actually led to good chats
      (reaching half sugar). */

import { L } from '../shared/i18n.js?v=20261030d';
import { fieldsOf } from '../shared/flavors.js?v=20261030d';
import { REVEAL_AT, isCold, sugarOf } from '../shared/sugar.js?v=20261030d';
import { P, PEOPLE, SEED_THOUGHTS, rolesOf } from './people.js?v=20261030d';
import { S } from './state.js?v=20261030d';


// What people are curious about, and what they can share. Free tags, with suggestions to tap.
export const TAG_SUGGESTIONS = [
  'AI products', 'AI in supply chains', 'Supply chains', 'Semiconductors', 'Chip packaging', 'Hardware',
  'Pricing', 'Fundraising', 'Sales', 'Marketing', 'Branding', 'Product design', 'User research', 'Data analysis',
  'Fintech', 'Health tech', 'Climate tech', 'Open data', 'Education', 'Writing', 'Community building',
  'Small business', 'Side projects', 'Hiring', 'Job interviews', 'Career change', 'Studying abroad', 'Working abroad',
];
export const MAX_TAGS = 6;

// Compare tags loosely: case, spacing and a plural "s" do not matter,
// and a longer tag counts if it contains a shorter one ("supply chain" in "AI in supply chains")
export const normTag = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim().replace(/s\b/g, '');
export const tagsMatch = (a, b) => {
  const x = normTag(a);
  const y = normTag(b);
  return x === y || (x.length > 3 && y.includes(x)) || (y.length > 3 && x.includes(y));
};
// The tags in `wants` that someone's `has` list covers
export const overlapTags = (wants, has) => (wants || []).filter((w) => (has || []).some((h) => tagsMatch(w, h)));

export const STAGES = [
  ['startup', 'Building a startup'],
  ['side', 'Working on a side project'],
  ['research', 'Doing research'],
  ['study', 'Studying'],
  ['job', 'Working at a company'],
  ['exploring', 'Still figuring it out'],
];

// relevance: they can share what you are curious about, shared curiosity, the same stage, shared work words.
// complement: different fields. reliable: how often they reply. active: visited recently.
// nearby: the same city. fresh: a little daily luck so picks change from day to day.
export const DEFAULT_WEIGHTS = { relevance: 0.35, complement: 0.2, reliable: 0.2, active: 0.1, nearby: 0.1, fresh: 0.05 };
export const weights = () => S.weights || DEFAULT_WEIGHTS;

export const TOP_PICKS = 3;
export const BREW_TOP_PICKS = 2;
export const BREW_SEND_TO = 4;
export const SAME_FIELD_LIMIT = 2; // top picks never hold more than this many people from one field
export const PRIOR_CHATS = 5;      // how much someone's starting reply rate counts against real history
export const LEARN_AFTER = 20;     // finished chats needed before the weights start to move
export const LEARN_STEP = 0.05;    // how much weight moves each time
export const MIN_WEIGHT = 0.05;    // no factor ever drops below this

// Simulated people: curiosities, what they can share, stage, how they like to meet,
// a starting reply rate, and days since their last visit
export const PEOPLE_EXTRA = {
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

export const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const hashNum = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Your tags. Older cards had broad topics, which count as things you are curious about.
export const myCurious = () => {
  if (!S.me) return [];
  if (Array.isArray(S.me.curious)) return S.me.curious;
  if (Array.isArray(S.me.interests)) return S.me.interests;
  return String(S.me.topics || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
};
export const myShare = () => (S.me && Array.isArray(S.me.share) ? S.me.share : []);

// Mystery Cup anchor, best first.
// swap: each can share what the other is curious about. theyShare / youShare: one direction.
// both: curious about the same thing. work: a word from what you both work on.
export function anchorOf(p) {
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

export function anchorLabel(x) {
  if (x.kind === 'swap') return L`Swap: they know ${x.a}, you know ${x.b}`;
  if (x.kind === 'theyShare') return L`They can share: ${x.a}`;
  if (x.kind === 'youShare') return L`You can share: ${x.a}`;
  if (x.kind === 'both') return L`Both curious: ${x.a}`;
  return L`In common: ${x.a}`;
}

// The first note in a Mystery Cup chat, built around the anchor (stored as English keys for translation)
export const ANCHOR_OPENERS = {
  swap: 'You can trade: they know {0}, you know {1}. Start with whichever you are more curious about.',
  theyShare: 'They can share about {0}, which you are curious about. Ask where they would start.',
  youShare: 'They are curious about {0}, and you can share it. Ask what they want to know.',
  both: 'You are both curious about {0}. Start there: what got you interested?',
  work: 'You both care about {0}. Start there: how does it show up in your work?',
};

// The meaningful words in what someone works on. A real version would use AI to compare meaning.
export const STOP_WORDS = new Set(['about', 'after', 'also', 'because', 'from', 'have', 'into', 'just', 'like', 'more', 'that', 'their', 'them', 'they', 'this', 'what', 'when', 'with', 'your', 'tool', 'people', 'someone', 'something', 'looking', 'building', 'working', 'every', 'cannot', 'should',
  'running', 'using', 'making', 'getting', 'doing', 'trying', 'small', 'team', 'worth', 'would',
  'could', 'there', 'which', 'where', 'other', 'only', 'even', 'much', 'many', 'some', 'first',
  'really', 'think', 'know', 'want', 'need', 'find', 'make', 'take', 'thing', 'way', 'new']);
export const wordsOf = (text) => new Set((String(text || '').toLowerCase().match(/[a-z]{4,}/g) || [])
  .map((w) => w.replace(/s$/, ''))
  .filter((w) => w.length > 3 && !STOP_WORDS.has(w)));

// Share of chats where you wrote back after they wrote to you. Starts at 0.8 with no history.
export function myReplyRate() {
  const theyWrote = S.threads.filter((t) => t.msgs.some((m) => m.from === 'them'));
  if (!theyWrote.length) return 0.8;
  const replied = theyWrote.filter((t) => {
    const first = t.msgs.findIndex((m) => m.from === 'them');
    return t.msgs.slice(first + 1).some((m) => m.from === 'me');
  });
  return replied.length / theyWrote.length;
}

// Their starting reply rate, corrected by whether they actually wrote back to you
export function replyRateOf(p) {
  const chats = S.threads.filter((t) => t.pid === p.id && t.msgs.some((m) => m.from === 'me'));
  const replied = chats.filter((t) => {
    const first = t.msgs.findIndex((m) => m.from === 'me');
    return t.msgs.slice(first + 1).some((m) => m.from === 'them');
  }).length;
  return (p.replyRate * PRIOR_CHATS + replied) / (PRIOR_CHATS + chats.length);
}

// Days since they were last seen: their last message to you, or their starting value
export function activeDaysOf(p) {
  const times = S.threads.filter((t) => t.pid === p.id).flatMap((t) => t.msgs.filter((m) => m.from === 'them' && m.at).map((m) => m.at));
  return times.length ? Math.min(p.activeDays, (Date.now() - Math.max(...times)) / 86400000) : p.activeDays;
}

// Everyone, you included, in the same shape for scoring
export const asCandidate = (p) => ({ ...p, replyRate: replyRateOf(p), activeDays: activeDaysOf(p), words: wordsOf(`${p.doing} ${p.thought || ''}`) });
export const meAsPerson = () => ({
  id: 'me', field: S.me.field, field2: S.me.field2, curious: myCurious(), share: myShare(), stage: S.me.stage,
  meet: S.me.meet || 'both', city: S.me.city, replyRate: myReplyRate(), activeDays: 0,
  words: wordsOf([S.me.doing, ...S.myThoughts.map((t) => t.text), ...S.myPosts.map((b) => `${b.title} ${rolesOf(b).map((r) => r.name).join(' ')}`)].join(' ')),
});

export const meetsFit = (a, b) => a === 'both' || b === 'both' || a === b;
export const sameCity = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

// Each factor from 0 to 1, for how good `to` is for `from`
export function scoreParts(from, to, seed) {
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

export const weigh = (parts) => Object.entries(weights()).reduce((sum, [k, w]) => sum + w * parts[k], 0);

// How good `to` is for `from`, from 0 to 1
export function oneWay(from, to, seed) {
  const score = weigh(scoreParts(from, to, seed));
  // One wants online only and the other in person only: still possible, but less likely to happen
  return meetsFit(from.meet, to.meet) ? score : score * 0.5;
}

// Both directions have to work, so the match score is the lower of the two
export function matchScore(p, seed) {
  const me = meAsPerson();
  const them = asCandidate(p);
  return Math.min(oneWay(me, them, seed), oneWay(them, me, seed));
}

// People you already have a chat with are not recommended again
export function topPicks(people, n, seed) {
  const met = new Set(S.threads.map((t) => t.pid));
  const ranked = people.filter((p) => !met.has(p.id)).sort((a, b) => matchScore(b, seed) - matchScore(a, seed));
  const out = [];
  ranked.forEach((p) => {
    if (out.length < n && out.filter((x) => x.field === p.field).length < SAME_FIELD_LIMIT) out.push(p);
  });
  return out;
}

// Who a new Brew is sent to: people who can share what it needs, reliable people first
export function brewMatches(item) {
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
export function stampMatch(t) {
  t.match = { parts: scoreParts(meAsPerson(), asCandidate(P[t.pid]), dayKey()), at: Date.now() };
}

export const outcomeOf = (t) => ({
  replied: t.msgs.some((m) => m.from === 'them') && t.msgs.some((m) => m.from === 'me'),
  half: sugarOf(t) >= REVEAL_AT,
  popped: t.reveal.me && t.reveal.them,
  bobaRun: !!(t.booking && t.booking.met),
});

// With enough finished chats, move a little weight from the factor that tells good
// and bad chats apart the least, to the one that tells them apart the most
export function learnWeights() {
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
