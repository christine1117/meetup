/* Competition data. Reads the database (Supabase, filled once a day by the
   crawler), or data/competitions.json when the database cannot be reached.
   Drops any record that breaks the data contract
   (../shared/contract.js), and formats dates. Each listing links back to
   its official page. Once you join one, a copy is kept so your team still
   works after it drops off the list. */

import { logError } from '../shared/log.js?v=20261030g';
import { checkCompetition, competitionFromRow } from '../shared/contract.js?v=20261030g';
import { rest } from '../shared/supabase.js?v=20261030g';
import { S } from './state.js?v=20261030g';

export const DAY = 86400000;
export const SOURCE_NAME = { devpost: 'Devpost', mlh: 'MLH', bhuntr: '獎金獵人' };
export const REGION_NAME = { tw: 'Taiwan', intl: 'International' };
export let DATA = { items: [], sources: [], updatedAt: null };
export let COMP = {};
export let dataState = 'loading';
export const DATA_URL = '../data/competitions.json';
export const compOf = (id) => COMP[id] || (S.compCache || {})[id] || { id, name: 'A past competition', kind: 'Competition', source: '', tags: [] };
export const dateText = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
const COLUMNS = 'id,source,region,kind,name,organizer,url,start_at,end_at,deadline_at,location,tags,prize,summary,eligibility,updated_at,'
  + 'competition_team_rules(track,min_members,max_members,individual_allowed,mentors_max,evidence)';

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
    return `Closes ${dateText(Date.parse(c.deadline))} · ${days <= 1 ? 'last day' : `${days} days left`}`;
  }
  if (c.start) return `Starts ${dateText(Date.parse(c.start))}`;
  return 'Dates on the official page';
}
