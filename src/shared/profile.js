/* The profile kept in this browser. It uses the storage key the first Half
   Sugar app used, so nobody loses theirs. With an account, the profile also
   lives in the database (shared/account.js). */

export const PROFILE_KEY = 'meetup.v1';

// "Curious about" choices, in groups so a long list is easy to scan.
// Values are stored in English (older profiles keep working); they are shown in the chosen language.
export const CURIOUS_GROUPS = [
  ['Tech', ['AI products', 'Software development', 'Mobile apps', 'Data analysis', 'Cybersecurity', 'Hardware',
    'Robotics', 'Semiconductors', 'Chip packaging', 'Game development', 'Blockchain', 'Open data']],
  ['Design', ['Product design', 'UI/UX design', 'Graphic design', 'Branding', 'Architecture', 'Fashion', 'User research']],
  ['Business', ['Startups', 'Fundraising', 'Pricing', 'Sales', 'Marketing', 'E-commerce', 'Fintech', 'Investing',
    'Small business', 'Supply chains', 'AI in supply chains', 'Family business']],
  ['Science & health', ['Health tech', 'Biotech', 'Medicine', 'Psychology', 'Neuroscience', 'Space', 'Education', 'EdTech']],
  ['Society', ['Climate tech', 'Sustainability', 'Social impact', 'Policy & law', 'Urban planning', 'Community building', 'Agriculture']],
  ['Creative', ['Writing', 'Film & video', 'Photography', 'Music', 'Art & illustration', 'Content creation', 'Podcasts']],
  ['Career', ['Side projects', 'Career change', 'Job interviews', 'Hiring', 'Leadership', 'Public speaking',
    'Studying abroad', 'Working abroad']],
  ['Life', ['Travel', 'Food', 'Sports', 'Languages', 'Mental health']],
];
export const CURIOUS_OPTIONS = CURIOUS_GROUPS.flatMap(([, list]) => list);
export const MAX_CURIOUS = 6;

export const MEETS = [['online', 'Online'], ['inperson', 'In person'], ['both', 'Either is fine']];

// How to reach you once the seal is popped
export const CONTACTS = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['other', 'Other']];
export const contactName = (type) => (CONTACTS.find(([v]) => v === type) || CONTACTS[2])[1];

// [label, value] for a person's contact, or null. Older data only had LinkedIn.
export function contactOf(r) {
  if (r && r.contact) return [contactName(r.contactType), r.contact];
  if (r && r.linkedin) return ['LinkedIn', r.linkedin];
  return null;
}

// Signed-up profile, or null
export function readProfile() {
  try {
    const me = (JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}).me;
    return me && me.alias ? me : null;
  } catch {
    return null;
  }
}

// Save the profile without touching anything else stored under the same key
export function writeProfile(me) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    saved.me = { ...(saved.me || {}), ...me };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

// Forget the profile in this browser (logging out on a shared computer)
export function clearProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
    delete saved.me;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
  } catch { /* storage is off */ }
  markUnsynced(false);
}

/* "This browser has changes the account has not got yet" (saving to the account
   failed). Then the next sign-in sends this browser's profile up, instead of
   bringing the older one down over it. */
const UNSYNCED = 'halfsugar.unsynced';
export function markUnsynced(on) {
  try {
    if (on) localStorage.setItem(UNSYNCED, '1');
    else localStorage.removeItem(UNSYNCED);
  } catch { /* storage is off */ }
}
export function isUnsynced() {
  try { return localStorage.getItem(UNSYNCED) === '1'; } catch { return false; }
}
