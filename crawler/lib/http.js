/* Polite HTTP: one request at a time per call, a clear User-Agent, a timeout,
   two retries with a growing pause, and a delay helper between requests. */

export const USER_AGENT = 'HalfSugarBot/1.0 (+https://christine1117.com/meetup/teams/)';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function get(url, { type = 'text', timeout = 20000, tries = 3 } = {}) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const res = await fetch(url, {
        // Some sites refuse an explicit "Accept: text/html" from a bot, so pages use the default
        headers: type === 'json' ? { 'User-Agent': USER_AGENT, Accept: 'application/json' } : { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return type === 'json' ? await res.json() : await res.text();
    } catch (err) {
      last = err;
      if (attempt < tries) await sleep(1500 * attempt);
    }
  }
  throw last;
}
