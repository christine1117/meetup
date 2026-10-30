#!/usr/bin/env node
/* The daily crawl: collect open team competitions into data/competitions.json.

   Sources (all public, and allowed by each site's robots.txt):
   - Devpost (sources/devpost.js), MLH (sources/mlh.js), 獎金獵人 (sources/bhuntr.js)

   Only competitions where 2 or more people can enter together are kept.
   We save a short listing and always link back to the original page.
   Every record is checked against the data contract (src/shared/contract.js);
   a bad record is dropped and logged. If one source fails, its items from the
   last good run are kept. The run log (printed, and kept by GitHub Actions)
   says what was found and what was skipped and why.

   Run: npm run crawl */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCompetition } from '../src/shared/contract.js';
import { openCache } from './lib/cache.js';
import * as devpost from './sources/devpost.js';
import * as mlh from './sources/mlh.js';
import * as bhuntr from './sources/bhuntr.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'competitions.json');
const CACHE = join(ROOT, 'crawler', 'cache.json');

const SOURCES = [
  { id: 'devpost', name: 'Devpost', url: 'https://devpost.com/hackathons', mod: devpost },
  { id: 'mlh', name: 'MLH', url: 'https://www.mlh.com', mod: mlh },
  { id: 'bhuntr', name: '獎金獵人', url: 'https://bhuntr.com/tw/competitions', mod: bhuntr },
];

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function main() {
  let previous = { items: [] };
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  const cache = await openCache(CACHE);

  const items = [];
  const sources = [];
  let failed = 0;
  for (const s of SOURCES) {
    const started = Date.now();
    let got;
    try {
      got = await s.mod.collect({ cache, progress: (msg) => log(`  ${s.name}: ${msg}`) });
      log(`${s.name}: kept ${got.items.length}, skipped ${JSON.stringify(got.skipped)}${got.notes ? `, notes ${JSON.stringify(got.notes)}` : ''} (${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (err) {
      failed += 1;
      // Keep last run's items, but only ones that still meet the contract
      got = { items: previous.items.filter((x) => x.source === s.id), skipped: {} };
      log(`${s.name} FAILED (${err.message}); kept ${got.items.length} from the last run`);
    }
    const good = got.items.filter((x) => {
      const problems = checkCompetition(x);
      if (problems.length) log(`  dropped ${x && x.id}: breaks the contract (${problems.join(', ')})`);
      return !problems.length;
    });
    items.push(...good);
    sources.push({ id: s.id, name: s.name, url: s.url, count: good.length });
  }

  // Drop anything already over, then sort by what closes (or starts) first
  const when = (x) => Date.parse(x.deadline || x.start || '') || Infinity;
  const open = items.filter((x) => when(x) > Date.now()).sort((a, b) => when(a) - when(b));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify({ updatedAt: new Date().toISOString(), sources, items: open })}\n`);
  const cached = await cache.save();
  log(`Saved ${open.length} competitions to data/competitions.json (${cached} pages remembered in crawler/cache.json)`);
  if (failed === SOURCES.length) {
    log('Every source failed. Check the network or the source pages.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log('Crawl crashed:', err);
  process.exitCode = 1;
});
