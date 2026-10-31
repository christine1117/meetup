/* The data contract between the crawler and the apps: what one competition
   looks like in data/competitions.json (also written up as
   data/competitions.schema.json).

   The crawler checks every record before saving, and the app checks again
   when loading. A record that breaks the contract is dropped, never shown. */

import { L } from './i18n.js?v=20261031u';

export const SOURCES = ['devpost', 'mlh', 'bhuntr'];
// Categories the LLM picks from (crawler/extract/schema.py), with their English names
export const CATEGORIES = [
  ['hackathon', 'Hackathon'], ['tech', 'Tech & AI'], ['startup', 'Startup & business'], ['design', 'Design'],
  ['film_photo', 'Film & photo'], ['writing', 'Writing'], ['art', 'Art'], ['performance', 'Music & performance'],
  ['science', 'Science'], ['social_impact', 'Social impact'], ['sports', 'Sports & games'], ['other', 'Other'],
];
const CATEGORY_IDS = CATEGORIES.map(([id]) => id);
// Older records have only an English "kind"; map it to a category
const KIND_TO_CATEGORY = { 'Startup & business': 'startup', Tech: 'tech', 'Film & photo': 'film_photo', 'Music & stage': 'performance', Competition: 'other' };
export const categoryOf = (c) => (CATEGORY_IDS.includes(c.category) ? c.category
  : KIND_TO_CATEGORY[c.kind] || (CATEGORIES.find(([, n]) => n === c.kind) || ['other'])[0]);
export const categoryName = (id) => L((CATEGORIES.find(([v]) => v === id) || CATEGORIES[CATEGORIES.length - 1])[1]);
export const REGIONS = ['tw', 'intl'];

const isText = (v, max = 400) => typeof v === 'string' && v.length <= max;
const isDate = (v) => v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));
const isLink = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const isCount = (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 100);

// Returns a list of problems; an empty list means the record is fine
export function checkCompetition(x) {
  const errors = [];
  const need = (ok, field) => { if (!ok) errors.push(field); };
  if (!x || typeof x !== 'object') return ['not an object'];
  need(isText(x.id, 120) && /^[a-z]+-[\w-]+$/i.test(x.id), 'id');
  need(SOURCES.includes(x.source), 'source');
  need(REGIONS.includes(x.region), 'region');
  need(isText(x.kind, 40) && x.kind.length > 0, 'kind');
  need(isText(x.name, 200) && x.name.length > 0, 'name');
  need(isText(x.organizer, 200), 'organizer');
  need(isLink(x.url), 'url');
  need(isDate(x.start) && isDate(x.deadline) && isDate(x.end ?? null), 'dates');
  need(isText(x.where, 120), 'where');
  need(Array.isArray(x.tags) && x.tags.length <= 8 && x.tags.every((t) => isText(t, 60)), 'tags');
  need(isText(x.prize, 60), 'prize');
  need(isText(x.summary, 200), 'summary');
  // Only team competitions are listed: max is 2 or more, or not stated
  const t = x.team;
  need(t && typeof t === 'object' && isCount(t.min) && isCount(t.max) && (t.max === null || t.max >= 2) && (t.min === null || t.max === null || t.min <= t.max), 'team');
  // Per-track rules read by the LLM, each with the exact quote it came from (optional)
  need(x.tracks === undefined || (Array.isArray(x.tracks) && x.tracks.every((r) => r && (r.name === null || r.name === undefined || isText(r.name, 80))
    && isCount(r.min ?? null) && isCount(r.max ?? null) && isText(r.evidence, 1000))), 'tracks');
  need(x.eligibility === undefined || x.eligibility === null || isText(x.eligibility, 300), 'eligibility');
  need(x.category === undefined || CATEGORY_IDS.includes(x.category), 'category');
  need(x.i18n === undefined || (x.i18n && typeof x.i18n === 'object' && Object.values(x.i18n).every((v) => v && typeof v === 'object' && isText(v.name || '', 200))), 'i18n');
  return errors;
}

// "2–5 people", "1–5 people" (only a maximum: no minimum means one person can enter),
// "3 per team", "2+ people", "No size limit", or not listed
export function teamSizeText(team) {
  const { min = null, max = null, unlimited = false } = team || {};
  if (unlimited) return L`No size limit`;
  if (max) {
    const low = min || 1;
    return low === max ? L`${max} per team` : L`${low}–${max} people`;
  }
  if (min) return L`${min}+ people`;
  return L`Team size on the official page`;
}

// One track's rule, e.g. "高中組: 2–4 people, plus 1 mentor". name: the track name to show.
export function trackText(t, name = t.name) {
  const size = teamSizeText({ min: t.min ?? (t.solo ? 1 : null), max: t.max ?? null, unlimited: !!t.unlimited });
  // mentors is the most allowed ("1-2名指導老師" is up to 2)
  const mentors = t.mentors ? (t.mentors > 1 ? L`, plus up to ${t.mentors} mentors` : L`, plus 1 mentor`) : '';
  return `${name ? `${name}: ` : ''}${size}${mentors}`;
}

/* One size for the list view across tracks (the same rule as the crawler's
   validate.overall): the maximum is only known if every track that allows
   teams states one; "one person may enter" counts as a minimum of 1. */
export function overallSize(tracks = []) {
  if (!tracks.length) return { min: null, max: null, unlimited: false };
  if (tracks.some((t) => t.unlimited)) return { min: null, max: null, unlimited: true };
  const mins = tracks.map((t) => (t.min != null ? t.min : t.solo ? 1 : null));
  const teamTracks = tracks.filter((t) => t.max == null || t.max >= 2);
  const maxes = teamTracks.map((t) => t.max);
  let top = maxes.length && maxes.every((m) => m != null) ? Math.max(...maxes) : null;
  let low = mins.every((m) => m != null) ? Math.min(...mins) : null;
  if (top != null && top < 2) top = null;
  if (low != null && top != null && low > top) low = null;
  return { min: low, max: top, unlimited: false };
}

// A row from the database (competitions + competition_team_rules) in the shape above
export function competitionFromRow(row) {
  const tracks = (row.competition_team_rules || []).map((r) => ({
    name: r.track, min: r.min_members, max: r.max_members, solo: r.individual_allowed, unlimited: !!r.unlimited, mentors: r.mentors_max, evidence: r.evidence,
    name_en: r.track_en || null, name_zh: r.track_zh || null, evidence_en: r.evidence_en || null, evidence_zh: r.evidence_zh || null,
  }));
  return {
    id: row.id, source: row.source, region: row.region, kind: row.kind, name: row.name,
    organizer: row.organizer || '', url: row.url, start: row.start_at, end: row.end_at || null, deadline: row.deadline_at,
    where: row.location || '', tags: row.tags || [], prize: row.prize || '', summary: row.summary || '',
    team: overallSize(tracks), tracks, eligibility: row.eligibility || null,
    category: row.category || undefined, i18n: row.i18n || undefined,
  };
}
