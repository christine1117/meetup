/* 獎金獵人 bhuntr.com: competitions in Taiwan.
   Reads the public contest sitemap, then each contest page's schema.org data
   and description (the same data search engines read). A page is only
   fetched again when its last-modified date changes.

   Only team competitions are kept: the description has to mention teams
   (組隊, 每隊, 團隊…) or a team size. Individual-only contests are skipped. */

import { get, sleep } from '../lib/http.js';
import { clean, cut, meta, jsonLd } from '../lib/text.js';
import { parseTeamSize, teamPolicy } from '../lib/team-size.js';

const MAX_FAILS_IN_ROW = 5;

// Words every bhuntr page carries; they say nothing about the contest
const GENERIC = new Set(['獎金獵人', '比賽', '競賽', '徵件', '報名系統', '投票系統', '線上報名', '線上投票', '網路投票', '報名平台', '活動報名系統', '活動廣告', '活動宣傳', '活動網站架設', '參賽行事曆', '歷屆比賽', '國內', '國外', '學生', '學生競賽', '其他']);

export function kindOf(words) {
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
const HEADING = /^([一二三四五六七八九十]+[、.．]\s*)?(活動|比賽|競賽|計畫)?(簡介|介紹|前言|緣起|宗旨|說明|目的|背景)\s*[:：]?\s*/;

async function readContest(id, mod, cache) {
  const key = `bhuntr:${id}`;
  const saved = cache.get(key, { mod });
  if (saved) return saved;
  const html = await get(`https://bhuntr.com/tw/competitions/${id}`);
  await sleep(700);
  const ev = ((jsonLd(html) || {})['@graph'] || []).find((x) => x['@type'] === 'Event');
  let value;
  const end = ev && Date.parse(ev.endDate);
  // A closed contest shows "now" as its end date, so keep only ones that end later
  if (!ev || !ev.name) value = { skip: 'no contest data' };
  else if (!end || end - Date.now() < 2 * 3600000) value = { skip: 'closed' };
  else {
    const desc = clean(meta(html, 'description'));
    const policy = teamPolicy(parseTeamSize(`${ev.name} ${desc}`));
    if (!policy.keep) value = { skip: policy.reason };
    else {
      const words = String(ev.keywords || '').split(',').map((w) => w.trim()).filter(Boolean);
      const mode = String(ev.eventAttendanceMode || '');
      value = {
        record: {
          id: `bh-${id}`,
          source: 'bhuntr',
          region: words.some((w) => /國外|國際/.test(w)) ? 'intl' : 'tw',
          kind: kindOf(words),
          name: cut(clean(ev.name), 200),
          organizer: cut(clean(ev.organizer?.name || ''), 200),
          url: `https://bhuntr.com/tw/competitions/${id}`,
          start: ev.startDate ? new Date(ev.startDate).toISOString() : null,
          deadline: new Date(end).toISOString(),
          // Nearly every page says "mixed", which tells us nothing, so only clear answers are kept
          where: /Online/.test(mode) ? 'Online' : /Offline/.test(mode) ? 'In person' : '',
          tags: words.filter((w) => !GENERIC.has(w)).slice(0, 5).map((w) => cut(w, 60)),
          prize: '',
          summary: cut(desc.replace(HEADING, ''), 120),
          team: policy.team,
        },
      };
    }
  }
  cache.set(key, value, mod);
  return value;
}

export async function collect({ cache, progress = () => {} }) {
  const xml = await get('https://bhuntr.com/sitemap_v2_contest_latest.xml');
  // Each <url> block holds the page link, then images and language links, then <lastmod>
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
    id: ((block.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '').split('/').pop(),
    mod: (block.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || null,
  })).filter((e) => e.id);
  const items = [];
  const skipped = {};
  let failsInRow = 0;
  for (const [i, e] of entries.entries()) {
    if (i && i % 50 === 0) progress(`${i} of ${entries.length} checked`);
    let got;
    try {
      got = await readContest(e.id, e.mod, cache);
      failsInRow = 0;
    } catch (err) {
      skipped['page failed'] = (skipped['page failed'] || 0) + 1;
      // Several failures in a row usually means the network or the site is down: stop and fall back
      failsInRow += 1;
      if (failsInRow >= MAX_FAILS_IN_ROW) throw new Error(`${failsInRow} pages failed in a row (${err.message})`);
      continue;
    }
    if (got.record) items.push(got.record);
    else skipped[got.skip] = (skipped[got.skip] || 0) + 1;
  }
  return { items, skipped };
}
