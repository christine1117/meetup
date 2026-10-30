/* What the crawler already looked up, so each daily run only fetches pages
   that are new or changed. Saved as crawler/cache.json and committed with
   the data, so the daily job on GitHub can reuse it.

   Each entry: { at: when it was checked, mod: the page's last-modified date
   if known, value: what we learned (a record, or { skip: reason }) }. */

import { readFile, writeFile } from 'node:fs/promises';

const DAY = 86400000;

export async function openCache(path) {
  let data = {};
  try { data = JSON.parse(await readFile(path, 'utf8')); } catch { /* first run */ }
  const used = new Set();
  return {
    // A saved answer, if it is still fresh (same last-modified date, or younger than maxAgeDays)
    get(key, { mod = null, maxAgeDays = 7 } = {}) {
      const e = data[key];
      if (!e) return null;
      const fresh = mod ? e.mod === mod : Date.now() - e.at < maxAgeDays * DAY;
      if (!fresh) return null;
      used.add(key);
      return e.value;
    },
    set(key, value, mod = null) {
      data[key] = { at: Date.now(), mod, value };
      used.add(key);
    },
    // Forget anything not seen this run, so the file does not grow forever
    async save() {
      const kept = Object.fromEntries(Object.entries(data).filter(([k]) => used.has(k)));
      await writeFile(path, `${JSON.stringify(kept)}\n`);
      return Object.keys(kept).length;
    },
  };
}
