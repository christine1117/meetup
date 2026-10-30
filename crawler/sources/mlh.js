/* MLH: student hackathons around the world.
   Read from the season's events page, which carries its data as JSON.
   MLH events are team hackathons; each event sets its own team size on its
   own website, so the size is left as "on the official page". */

import { get } from '../lib/http.js';
import { clean } from '../lib/text.js';

export async function collect() {
  const now = new Date();
  const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const html = await get(`https://www.mlh.com/seasons/${season}/events`);
  const raw = (html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/) || [])[1];
  if (!raw) throw new Error('MLH: page data not found (the page layout may have changed)');
  const events = [];
  (function walk(o) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (o.name && o.startsAt && (o.websiteUrl || o.url)) events.push(o);
      else Object.values(o).forEach(walk);
    }
  }(JSON.parse(raw)));
  const seen = new Set();
  const items = events
    .filter((e) => Date.parse(e.startsAt) > Date.now() && !seen.has(e.id) && seen.add(e.id))
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
      team: { min: null, max: null },
    }));
  return { items, skipped: {} };
}
