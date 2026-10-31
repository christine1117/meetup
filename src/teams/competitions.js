/* Competition data. Reads the database (Supabase, filled once a day by the
   crawler), or data/competitions.json when the database cannot be reached.
   Drops any record that breaks the data contract
   (../shared/contract.js), and formats dates. Each listing links back to
   its official page. Once you join one, a copy is kept so your team still
   works after it drops off the list. */
import { L, LANG } from '../shared/i18n.js?v=20261031j';

import { logError } from '../shared/log.js?v=20261031j';
import { checkCompetition, competitionFromRow } from '../shared/contract.js?v=20261031j';
import { rest } from '../shared/supabase.js?v=20261031j';
import { S } from './state.js?v=20261031j';

export const DAY = 86400000;
export const SOURCE_NAME = { devpost: 'Devpost', mlh: 'MLH', bhuntr: '獎金獵人' };
export const REGION_NAME = { tw: 'Taiwan', intl: 'International' };
export const regionName = (r) => L(REGION_NAME[r] || '');
export let DATA = { items: [], sources: [], updatedAt: null };
export let COMP = {};
export let dataState = 'loading';
// Relative to this file, so it works wherever the page is
export const DATA_URL = new URL('../../data/competitions.json', import.meta.url).href.split('?')[0];
export const compOf = (id) => COMP[id] || (S.compCache || {})[id] || { id, name: 'A past competition', kind: 'Competition', source: '', tags: [] };
export const dateText = (ms) => new Date(ms).toLocaleDateString(LANG === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' });

/* A competition in the language being shown: what the LLM wrote in English or
   Chinese, or the original when there is no translation yet. */
const inLang = (c) => (c.i18n && c.i18n[LANG]) || {};
// The English page never shows Chinese: a missing translation is left out (a name is always shown)
const CJK = /[\u3400-\u9fff]/;
const fits = (text) => LANG === 'zh' || !CJK.test(text);
export function textOf(c, key) {
  const text = inLang(c)[key] || c[key] || '';
  return key === 'name' || fits(text) ? text : '';
}
export const tagsOf = (c) => ((inLang(c).tags || []).length ? inLang(c).tags : c.tags || []).filter(fits);
export const trackNameOf = (t) => (LANG === 'zh' ? t.name_zh : t.name_en) || t.name;
export const quoteOf = (t) => (LANG === 'zh' ? t.evidence_zh : t.evidence_en) || t.evidence;
// Everything a search can match, in both languages
export const searchText = (c) => [c.name, c.organizer, c.kind, ...(c.tags || []),
  ...Object.values(c.i18n || {}).flatMap((x) => [x.name, x.organizer, x.summary, ...(x.tags || [])])].join(' ').toLowerCase();

// Keep only records that meet the data contract; log the rest
function accept(list) {
  return list.filter((c) => {
    const problems = checkCompetition(c);
    if (problems.length) logError('competitions', `${c && c.id}: ${problems.join(', ')}`);
    return !problems.length;
  });
}

function use(items, extra) {
  const when = (x) => Date.parse(x.deadline || x.start || '') || Infinity;
  const open = items.filter((x) => when(x) > Date.now()).sort((a, b) => when(a) - when(b));
  DATA = { sources: SOURCE_CREDITS, ...extra, items: open };
  COMP = Object.fromEntries(open.map((c) => [c.id, c]));
  dataState = 'ready';
}

const SOURCE_CREDITS = [
  { id: 'devpost', name: 'Devpost', url: 'https://devpost.com/hackathons' },
  { id: 'mlh', name: 'MLH', url: 'https://www.mlh.com' },
  { id: 'bhuntr', name: '獎金獵人', url: 'https://bhuntr.com/tw/competitions' },
];
const COLUMNS = 'id,source,region,kind,category,i18n,name,organizer,url,start_at,end_at,deadline_at,location,tags,prize,summary,eligibility,updated_at,'
  + 'competition_team_rules(track,min_members,max_members,individual_allowed,mentors_max,evidence,track_en,track_zh,evidence_en,evidence_zh)';

// The daily list file, used when the database cannot be reached
function loadFile(onDone) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `${DATA_URL}?d=${new Date().toISOString().slice(0, 10)}`);
  xhr.onload = () => {
    try {
      if (xhr.status !== 200) throw new Error(`competitions.json: HTTP ${xhr.status}`);
      const raw = JSON.parse(xhr.responseText);
      use(accept(raw.items || []), { updatedAt: raw.updatedAt, sources: raw.sources });
    } catch (err) {
      logError('competitions', err);
      dataState = 'error';
    }
    onDone();
  };
  xhr.onerror = () => { logError('competitions', 'network error'); dataState = 'error'; onDone(); };
  xhr.send();
}

// Load competitions from the database (only listed ones are readable there);
// fall back to the daily file if that fails. Bad records are dropped and logged.
export async function loadComps(onDone) {
  try {
    const rows = await rest(`competitions?select=${COLUMNS}&listed=eq.true`);
    const items = accept(rows.map(competitionFromRow));
    const updatedAt = rows.reduce((a, r) => (r.updated_at > a ? r.updated_at : a), '');
    use(items, { updatedAt, from: 'database' });
    onDone();
  } catch (err) {
    logError('competitions', `database: ${err.message}; using the daily file`);
    loadFile(onDone);
  }
}

export function whenText(c) {
  if (c.deadline) {
    const days = Math.ceil((Date.parse(c.deadline) - Date.now()) / DAY);
    return `${L`Closes ${dateText(Date.parse(c.deadline))}`} · ${days <= 1 ? L`last day` : L`${days} days left`}`;
  }
  if (c.start) return L`Starts ${dateText(Date.parse(c.start))}`;
  return L`Dates on the official page`;
}
