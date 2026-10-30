#!/usr/bin/env node
/* Collect open competitions and hackathons into teams/data/competitions.json.

   Sources (all public, and allowed by each site's robots.txt):
   - Devpost: the public hackathon list the site itself uses (open and upcoming)
   - MLH: the season events page (student hackathons)
   - 獎金獵人 bhuntr.com: the contest sitemap, then each contest page's public
     schema.org data (the same data search engines read)

   We only keep a short listing (name, organizer, dates, place, tags, a short
   summary) and always link back to the original page. Requests go one at a
   time with a pause in between. If a source fails, its last good data is kept.

   Run: node scripts/fetch-competitions.mjs */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'teams', 'data', 'competitions.json');
const UA = 'HalfSugarBot/1.0 (+https://christine1117.com/meetup/teams/)';
const NOW = Date.now();
const DAY = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s = '') => String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

async function get(url, type = 'text') {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : 'text/html,*/*' }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return type === 'json' ? res.json() : res.text();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(2000 * attempt);
    }
  }
}

/* ---------- Devpost ---------- */
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// "Oct 01 - Nov 12, 2026", "Dec 15, 2025 - Jan 20, 2026", "Nov 01 - 02, 2026"
function devpostDates(text = '') {
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

async function devpost() {
  const items = [];
  for (let page = 1; page <= 40; page += 1) {
    const data = await get(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${page}`, 'json');
    const list = data.hackathons || [];
    for (const h of list) {
      if (h.invite_only) continue;
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
        tags: (h.themes || []).map((t) => t.name).slice(0, 5),
        prize: clean(h.prize_amount || '').replace(/\s+/g, ''),
        summary: '',
        signups: h.registrations_count || 0,
      });
    }
    if (list.length === 0 || page * (data.meta?.per_page || 9) >= (data.meta?.total_count || 0)) break;
    await sleep(800);
  }
  return items;
}

/* ---------- MLH ---------- */
async function mlh() {
  const now = new Date();
  const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const html = await get(`https://www.mlh.com/seasons/${season}/events`);
  const raw = (html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/) || [])[1];
  if (!raw) throw new Error('MLH: page data not found');
  const events = [];
  (function walk(o) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (o.name && o.startsAt && (o.websiteUrl || o.url)) events.push(o);
      else Object.values(o).forEach(walk);
    }
  }(JSON.parse(raw)));
  const seen = new Set();
  return events
    .filter((e) => Date.parse(e.startsAt) > NOW && !seen.has(e.id) && seen.add(e.id))
    .map((e) => ({
      id: `mlh-${e.slug || e.id}`,
      source: 'mlh',
      region: 'intl',
      kind: 'Hackathon',
      name: clean(e.name),
      organizer: 'MLH member event',
      url: e.websiteUrl || `https://www.mlh.com${e.url}`,
      start: e.startsAt,
      end: e.endsAt || null,
      deadline: null,
      where: e.formatType === 'digital' ? 'Online' : clean([e.location, e.formatType === 'hybrid' ? '(hybrid)' : ''].join(' ')),
      tags: ['Student hackathon'],
      prize: '',
      summary: '',
    }));
}

/* ---------- 獎金獵人 bhuntr ---------- */
// Words every bhuntr page carries; they say nothing about the contest
const BH_GENERIC = new Set(['獎金獵人', '比賽', '競賽', '徵件', '報名系統', '投票系統', '線上報名', '線上投票', '網路投票', '報名平台', '活動報名系統', '活動廣告', '活動宣傳', '活動網站架設', '參賽行事曆', '歷屆比賽', '國內', '國外', '學生', '學生競賽', '其他']);
function bhKind(words) {
  const all = words.join(' ');
  if (/黑客松|hackathon/i.test(all)) return 'Hackathon';
  if (/創業|新創|商業|提案|企劃|行銷/.test(all)) return 'Startup & business';
  if (/程式|AI|人工智慧|資料|數據|科技|資訊|工程|機器人/.test(all)) return 'Tech';
  if (/設計|建築|產品/.test(all)) return 'Design';
  if (/影片|影像|攝影|動畫|微電影/.test(all)) return 'Film & photo';
  if (/寫作|文學|徵文|劇本/.test(all)) return 'Writing';
  if (/繪畫|插畫|美術|藝術|漫畫/.test(all)) return 'Art';
  if (/音樂|歌唱|舞蹈|表演/.test(all)) return 'Music & stage';
  return 'Competition';
}
// Drop a leading heading like "一、活動簡介" or "前言" so the summary starts with the point
const BH_HEADING = /^([一二三四五六七八九十]+[、.．]\s*)?(活動|比賽|競賽|計畫)?(簡介|介紹|前言|緣起|宗旨|說明|目的|背景)\s*[:：]?\s*/;
const bhSummary = (desc) => cut(clean(desc).replace(BH_HEADING, ''), 120);

async function bhuntr() {
  const xml = await get('https://bhuntr.com/sitemap_v2_contest_latest.xml');
  // Each <url> block holds the page link, then images and language links, then <lastmod>
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map(([, block]) => ({
      id: ((block.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '').split('/').pop(),
      mod: Date.parse((block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || ''),
    }))
    .filter((e) => e.id && !(NOW - e.mod > 150 * DAY));
  const items = [];
  for (const e of entries) {
    await sleep(700);
    let html;
    try { html = await get(`https://bhuntr.com/tw/competitions/${e.id}`); } catch { continue; }
    const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
    let ev;
    try { ev = (JSON.parse(ld)['@graph'] || []).find((x) => x['@type'] === 'Event'); } catch { continue; }
    if (!ev || !ev.name) continue;
    const end = Date.parse(ev.endDate);
    // A closed contest shows "now" as its end date, so keep only ones that end later
    if (!end || end - NOW < 2 * 3600000) continue;
    const words = String(ev.keywords || '').split(',').map((w) => w.trim()).filter(Boolean);
    const desc = (html.match(/<meta id="description" name="description" content="([^"]*)"/) || [])[1] || '';
    const mode = String(ev.eventAttendanceMode || '');
    items.push({
      id: `bh-${e.id}`,
      source: 'bhuntr',
      region: words.some((w) => /國外|國際/.test(w)) ? 'intl' : 'tw',
      kind: bhKind(words),
      name: clean(ev.name),
      organizer: clean(ev.organizer?.name || ''),
      url: `https://bhuntr.com/tw/competitions/${e.id}`,
      start: ev.startDate ? new Date(ev.startDate).toISOString() : null,
      deadline: new Date(end).toISOString(),
      // Nearly every bhuntr page says "mixed", which tells us nothing, so only clear answers are kept
      where: /Online/.test(mode) ? 'Online' : /Offline/.test(mode) ? 'In person' : '',
      tags: words.filter((w) => !BH_GENERIC.has(w)).slice(0, 5),
      prize: '',
      summary: bhSummary(desc),
    });
  }
  return items;
}

/* ---------- Put it together ---------- */
const SOURCES = [
  { id: 'devpost', name: 'Devpost', home: 'https://devpost.com/hackathons', run: devpost },
  { id: 'mlh', name: 'MLH', home: 'https://www.mlh.com', run: mlh },
  { id: 'bhuntr', name: '獎金獵人', home: 'https://bhuntr.com/tw/competitions', run: bhuntr },
];

let previous = { items: [] };
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }

const items = [];
const sources = [];
for (const s of SOURCES) {
  let got;
  try {
    got = await s.run();
    console.log(`${s.name}: ${got.length}`);
  } catch (err) {
    got = previous.items.filter((x) => x.source === s.id);
    console.warn(`${s.name} failed (${err.message}); kept ${got.length} from last time`);
  }
  items.push(...got);
  sources.push({ id: s.id, name: s.name, url: s.home, count: got.length });
}

// Drop anything already over, then sort by what closes (or starts) first
const when = (x) => Date.parse(x.deadline || x.start || '') || Infinity;
const open = items.filter((x) => when(x) > NOW).sort((a, b) => when(a) - when(b));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify({ updatedAt: new Date().toISOString(), sources, items: open }, null, 0)}\n`);
console.log(`Saved ${open.length} competitions to ${OUT}`);
