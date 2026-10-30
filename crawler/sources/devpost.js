/* Devpost: international hackathons.
   The list comes from the public JSON the Devpost site itself uses.
   Team size is read from each hackathon's overview and rules pages (cached
   for a week). Teams are the norm on Devpost, so a hackathon stays on the
   list unless its rules say individuals only. */

import { get, sleep } from '../lib/http.js';
import { clean } from '../lib/text.js';
import { parseTeamSize, teamPolicy } from '../lib/team-size.js';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// "Oct 01 - Nov 12, 2026", "Dec 15, 2025 - Jan 20, 2026", "Nov 01 - 02, 2026"
export function devpostDates(text = '') {
  const [a = '', b = ''] = text.split(' - ').map((x) => x.trim());
  const end = b.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/) || b.match(/^(\d{1,2}), (\d{4})$/);
  if (!end) return {};
  const year = Number(end[end.length - 1]);
  const endMonth = end.length === 4 ? MONTHS[end[1]] : null;
  const endDay = Number(end.length === 4 ? end[2] : end[1]);
  const start = a.match(/^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?$/);
  const startMonth = start ? MONTHS[start[1]] : null;
  const startDate = start ? new Date(Date.UTC(start[3] ? Number(start[3]) : year, startMonth, Number(start[2]))) : null;
  const endDate = new Date(Date.UTC(year, endMonth ?? startMonth, endDay, 23, 59));
  return { start: startDate ? startDate.toISOString() : null, deadline: endDate.toISOString() };
}

async function teamInfo(url, cache) {
  const key = `devpost:${url}`;
  const saved = cache.get(key, { maxAgeDays: 7 });
  if (saved) return saved;
  const base = url.replace(/\/?$/, '/');
  const pages = await Promise.allSettled([get(base), get(`${base}rules`)]);
  const text = pages.filter((p) => p.status === 'fulfilled').map((p) => clean(p.value)).join(' ');
  await sleep(700);
  // Pages we could not read: keep the hackathon, say the size is unknown, and report it
  if (!text) return { team: { min: null, max: null }, unread: true };
  const policy = teamPolicy(parseTeamSize(text), { onPlatform: true });
  const value = policy.keep ? { team: policy.team } : { skip: policy.reason };
  cache.set(key, value);
  return value;
}

export async function collect({ cache, progress = () => {} }) {
  const items = [];
  const skipped = {};
  const notes = {};
  let seen = 0;
  let unreadInRow = 0;
  for (let page = 1; page <= 40; page += 1) {
    const data = await get(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${page}`, { type: 'json' });
    const list = data.hackathons || [];
    for (const h of list) {
      seen += 1;
      if (seen % 25 === 0) progress(`${seen} checked`);
      if (h.invite_only) { skipped['invite only'] = (skipped['invite only'] || 0) + 1; continue; }
      const info = await teamInfo(h.url, cache);
      if (info.skip) { skipped[info.skip] = (skipped[info.skip] || 0) + 1; continue; }
      if (info.unread) notes['rules page unreadable'] = (notes['rules page unreadable'] || 0) + 1;
      unreadInRow = info.unread ? unreadInRow + 1 : 0;
      // Several unreadable pages in a row usually means the network or the site is down
      if (unreadInRow >= 5) throw new Error('5 hackathon pages in a row could not be read');
      if (info.team.max || info.team.min) notes['team size found'] = (notes['team size found'] || 0) + 1;
      const d = devpostDates(h.submission_period_dates);
      items.push({
        id: `dp-${h.id}`,
        source: 'devpost',
        region: 'intl',
        kind: 'Hackathon',
        name: clean(h.title),
        organizer: clean(h.organization_name || ''),
        url: h.url,
        start: d.start || null,
        deadline: d.deadline || null,
        where: clean(h.displayed_location?.location || ''),
        tags: (h.themes || []).map((t) => clean(t.name)).slice(0, 5),
        prize: clean(h.prize_amount || '').replace(/\s+/g, ''),
        summary: '',
        team: info.team,
      });
    }
    if (list.length === 0 || page * (data.meta?.per_page || 9) >= (data.meta?.total_count || 0)) break;
    await sleep(700);
  }
  return { items, skipped, notes };
}
