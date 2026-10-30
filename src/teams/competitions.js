/* Competition data. Loads data/competitions.json (made once a day by
   the crawler), drops any record that breaks the data contract
   (../shared/contract.js), and formats dates. Each listing links back to
   its official page. Once you join one, a copy is kept so your team still
   works after it drops off the list. */

import { logError } from '../shared/log.js?v=20261030f';
import { checkCompetition } from '../shared/contract.js?v=20261030f';
import { S } from './state.js?v=20261030f';

export const DAY = 86400000;
export const SOURCE_NAME = { devpost: 'Devpost', mlh: 'MLH', bhuntr: '獎金獵人' };
export const REGION_NAME = { tw: 'Taiwan', intl: 'International' };
export let DATA = { items: [], sources: [], updatedAt: null };
export let COMP = {};
export let dataState = 'loading';
export const DATA_URL = '../data/competitions.json';
export const compOf = (id) => COMP[id] || (S.compCache || {})[id] || { id, name: 'A past competition', kind: 'Competition', source: '', tags: [] };
export const dateText = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Load the daily list. Records that break the data contract are dropped and logged.
export function loadComps(onDone) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `${DATA_URL}?d=${new Date().toISOString().slice(0, 10)}`);
  xhr.onload = () => {
    try {
      if (xhr.status !== 200) throw new Error(`competitions.json: HTTP ${xhr.status}`);
      const raw = JSON.parse(xhr.responseText);
      const items = (raw.items || []).filter((c) => {
        const problems = checkCompetition(c);
        if (problems.length) logError('competitions', `${c && c.id}: ${problems.join(', ')}`);
        return !problems.length;
      });
      DATA = { ...raw, items };
      COMP = Object.fromEntries(items.map((c) => [c.id, c]));
      dataState = 'ready';
    } catch (err) {
      logError('competitions', err);
      dataState = 'error';
    }
    onDone();
  };
  xhr.onerror = () => { logError('competitions', 'network error'); dataState = 'error'; onDone(); };
  xhr.send();
}

export function whenText(c) {
  if (c.deadline) {
    const days = Math.ceil((Date.parse(c.deadline) - Date.now()) / DAY);
    return `Closes ${dateText(Date.parse(c.deadline))} · ${days <= 1 ? 'last day' : `${days} days left`}`;
  }
  if (c.start) return `Starts ${dateText(Date.parse(c.start))}`;
  return 'Dates on the official page';
}
