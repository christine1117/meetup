/* The connection to the database (Supabase).

   The URL and the publishable key are public by design: they are meant to be
   in the website. What anyone may read or write is decided by the database's
   row-level security rules (supabase/migrations), not by hiding these.
   The secret key never appears here; only the crawler has it. */

import { logError } from './log.js?v=20261031g';

export const SUPABASE_URL = 'https://vegdozzfxzhityjyejxy.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_SAkUJR7BS7kY1q1C5f-jow_1GNeh9wy';

// supabase-js, pinned to one version so an update can never break the site
const LIBRARY = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

let client = null;

// The library loads only when it is needed (accounts). If it cannot load,
// db() returns null and the app keeps working in this browser.
export function db() {
  if (!client) {
    client = import(LIBRARY)
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
        // The storage key stays as it was, so nobody is logged out
        // PKCE: Google / Apple / LinkedIn and email links come back with ?code=..., not in the #, so the #/ routes are untouched
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'halfsugar.auth', flowType: 'pkce' },
      }))
      .catch((err) => {
        logError('supabase', err);
        client = null;
        return null;
      });
  }
  return client;
}

// A plain read for public data (competitions), without loading the library
export async function rest(path, { timeout = 10000 } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
