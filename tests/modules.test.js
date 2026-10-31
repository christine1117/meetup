import { test } from 'node:test';
import assert from 'node:assert/strict';

// Every import must find what it asks for. In Node the app stops at "document is not
// defined" (there is no page here), which only happens after all imports linked fine.
for (const entry of ['../src/teams/main.js']) {
  test(`${entry} links`, async () => {
    const err = await import(entry).then(() => null, (e) => e);
    assert.ok(!err || /document is not defined|window is not defined/.test(err.message), err && err.message);
  });
}
