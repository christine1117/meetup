/* Accounts: sign up, log in, log out, and the profile in the database.

   The profile is saved in two tables (supabase/migrations/0002_profiles.sql):
   - profiles        what everyone signed in can see
   - profile_sealed  real name, title, school, company, contact: readable only
                     by you, and by someone you both popped the seal with.
                     The database checks this, not the website.
   A copy of the profile also stays in this browser (shared/profile.js), so the
   apps keep working the same way they always have. */

import { db, SUPABASE_KEY, SUPABASE_URL } from './supabase.js?v=20261031c';
import { writeProfile } from './profile.js?v=20261031c';
import { logError } from './log.js?v=20261031c';

const PENDING = 'halfsugar.pendingProfile';

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
  if (/invalid login credentials/i.test(m)) return 'Email or password is not right.';
  if (/already registered|already been registered|exists/i.test(m)) return 'This email already has an account. Log in instead.';
  if (/password should be at least|weak password/i.test(m)) return 'Use a password with at least 8 characters.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first. Check your inbox.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return 'That email does not look right.';
  if (/not authorized|error sending|smtp|confirmation email/i.test(m)) return 'We could not send the confirmation email. Please try again later.';
  if (/fetch|network|load failed/i.test(m)) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

/* Sign in with another account. Each one shows up only once it is switched on
   in Supabase (Authentication > Sign In / Providers), so nothing breaks before. */
export const PROVIDERS = [['google', 'Google', 'ph-google-logo'], ['apple', 'Apple', 'ph-apple-logo'], ['linkedin_oidc', 'LinkedIn', 'ph-linkedin-logo']];

export async function enabledProviders() {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(8000) });
    const external = (await res.json()).external || {};
    return PROVIDERS.filter(([id]) => external[id]);
  } catch (err) {
    logError('providers', err);
    return [];
  }
}

// Leaves this page for the provider, which sends people back here signed in
export async function signInWith(provider) {
  const c = await db();
  if (!c) throw new Error('network: the account server could not load');
  const { error } = await c.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}${location.pathname}` } });
  if (error) throw error;
}

// Coming back from a sign-in link or another account (?code=... in the address)
export const returningFromSignIn = () => new URLSearchParams(location.search).has('code');

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

/* Sign up with the profile filled in. If the project asks people to confirm
   their email first, the profile waits in this browser and is saved at the
   first log-in. Returns { me, confirm } where confirm means "check your email". */
export async function signUp(email, password, me) {
  const c = await db();
  if (!c) throw new Error('network: the account server could not load');
  const { data, error } = await c.auth.signUp({
    email, password, options: { emailRedirectTo: `${location.origin}${location.pathname}` },
  });
  if (error) throw error;
  if (!data.session) {
    try { localStorage.setItem(PENDING, JSON.stringify(me)); } catch { /* storage is off */ }
    return { me, confirm: true };
  }
  await saveProfile(me);
  return { me, confirm: false };
}

// Log in and bring back the saved profile (or save the one waiting from sign-up)
export async function logIn(email, password) {
  const c = await db();
  if (!c) throw new Error('network: the account server could not load');
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  let me = await loadProfile();
  if (!me) {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING)); } catch { /* none */ }
    if (pending) {
      await saveProfile(pending);
      me = pending;
    }
  }
  try { localStorage.removeItem(PENDING); } catch { /* fine */ }
  if (me) writeProfile(me);
  return me;
}

export async function logOut() {
  try {
    const c = await db();
    if (c) await c.auth.signOut();
  } catch (err) {
    logError('logout', err);
  }
}
