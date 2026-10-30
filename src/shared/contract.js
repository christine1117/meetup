/* The data contract between the crawler and the apps: what one competition
   looks like in data/competitions.json (also written up as
   data/competitions.schema.json).

   The crawler checks every record before saving, and the app checks again
   when loading. A record that breaks the contract is dropped, never shown. */

export const SOURCES = ['devpost', 'mlh', 'bhuntr'];
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
  return errors;
}

// "Teams of 2–5", "Up to 4 people", "Teams of 3 or more", or not listed
export function teamSizeText(team) {
  const { min = null, max = null } = team || {};
  if (min && max) return min === max ? `Teams of ${max}` : `Teams of ${min}–${max}`;
  if (max) return `Up to ${max} people`;
  if (min) return `Teams of ${min} or more`;
  return 'Team size on the official page';
}
