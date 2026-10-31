#!/usr/bin/env node
/* Stamp one version on every file link, so after a deploy browsers fetch
   the new files instead of mixing old and new ones.
   It rewrites ?v=... on: <script>/<link> in the HTML entry pages, and every
   relative import inside src/. Run before each release: npm run version */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const version = process.argv[2] || new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const pages = ['index.html'];

async function jsFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await jsFiles(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of [...pages, ...await jsFiles('src')]) {
  const text = await readFile(file, 'utf8');
  const next = file.endsWith('.html')
    ? text.replace(/((?:src|href)="(?!https?:)[^"]+\.(?:js|css))(?:\?v=[^"]*)?"/g, `$1?v=${version}"`)
    : text.replace(/((?:from|import)\s+'\.{1,2}\/[^'?]+\.js)(?:\?v=[^']*)?'/g, `$1?v=${version}'`);
  if (next !== text) { await writeFile(file, next); changed += 1; }
}
console.log(`Version ${version} stamped on ${changed} files`);
