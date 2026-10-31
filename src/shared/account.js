/* Accounts: sign in with Google or LinkedIn, log out, and the profile in the database.
   There are no passwords: Supabase Auth talks to Google / LinkedIn and sends
   people back here signed in (?code=... in the address).

   The profile is saved in two tables (supabase/migrations/0002_profiles.sql):
   - profiles        what everyone signed in can see
   - profile_sealed  real name, title, school, company, contact: readable only
                     by you, and by someone you both popped the seal with.
                     The database checks this, not the website.
   A copy of the profile also stays in this browser (shared/profile.js), so the
   apps keep working the same way they always have. */

import { db, SUPABASE_KEY, SUPABASE_URL } from './supabase.js?v=20261031e';
import { writeProfile } from './profile.js?v=20261031e';
import { logError } from './log.js?v=20261031e';

// App shape -> database rows
export function toRows(userId, me) {
  return {
    profile: {
      id: userId,
      alias: String(me.alias || '').slice(0, 40),
      field: me.field || 'Other',
      field2: me.field2 || null,
      city: me.city || '',
      meet: ['online', 'inperson', 'both'].includes(me.meet) ? me.meet : 'both',
      curious: (me.curious || []).slice(0, 8),
      fun: me.fun || '',
    },
    sealed: {
      id: userId,
      real_name: me.name || '',
      job_title: me.title || '',
      school: me.school || '',
      company: me.company || '',
      contact_type: ['instagram', 'linkedin', 'other'].includes(me.contactType) ? me.contactType : 'instagram',
      contact: me.contact || '',
    },
  };
}

// Database rows -> app shape
export function fromRows(profile, sealed = {}) {
  if (!profile) return null;
  return {
    alias: profile.alias, field: profile.field, field2: profile.field2 || '', city: profile.city,
    meet: profile.meet, curious: profile.curious || [], fun: profile.fun,
    name: sealed.real_name || '', title: sealed.job_title || '', school: sealed.school || '',
    company: sealed.company || '', contactType: sealed.contact_type || 'instagram', contact: sealed.contact || '',
  };
}

// Plain-English messages for what Supabase Auth says
export function authMessage(err) {
  const m = String((err && err.message) || err || '');
  if (/not enabled|unsupported provider/i.test(m)) return 'This sign-in is not ready yet. Please try again later.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/fetch|network|load failed/i.test(m)) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

/* The ways to sign in. Each is switched on in Supabase (Authentication >
   Sign In / Providers) with the keys from Google Cloud / LinkedIn Developers. */
export const PROVIDERS = [['google', 'Google', 'ph-google-logo'], ['linkedin_oidc', 'LinkedIn', 'ph-linkedin-logo']];

// Ids of the ones switched on, or null if that could not be checked
export async function enabledProviders() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(8000) });
    const external = (await res.json()).external || {};
    return PROVIDERS.filter(([id]) => external[id]).map(([id]) => id);
  } catch (err) {
    logError('providers', err);
    return null;
  }
}

// Leaves this page for the provider, which sends people back here signed in
export async function signInWith(provider) {
  const c = await db();
  if (!c) throw new Error('network: the account server could not load');
  const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw error;
}

// Coming back from Google / LinkedIn: ?code=... when it worked, ?error=... when it did not
export const returningFromSignIn = () => new URLSearchParams(location.search).has('code');
export const signInFailed = () => new URLSearchParams(location.search).has('error');

export async function currentUser() {
  const c = await db();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? data.session.user : null;
}

export async function saveProfile(me) {
  const c = await db();
  const user = c && (await c.auth.getUser()).data.user;
  if (!user) throw new Error('Not signed in');
  const rows = toRows(user.id, me);
  const a = await c.from('profiles').upsert(rows.profile);
  if (a.error) throw a.error;
  const b = await c.from('profile_sealed').upsert(rows.sealed);
  if (b.error) throw b.error;
  writeProfile(me);
}

export async function loadProfile() {
  const c = await db();
  const user = c && (await c.auth.getUser()).data.user;
  if (!user) return null;
  const [p, s] = await Promise.all([
    c.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    c.from('profile_sealed').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (p.error) throw p.error;
  return fromRows(p.data, s.data || {});
}

export async function logOut() {
  try {
    const c = await db();
    if (c) await c.auth.signOut();
  } catch (err) {
    logError('logout', err);
  }
}
