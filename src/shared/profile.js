/* The one profile, shared by Half Sugar and team mode.
   It lives in Half Sugar's saved data, so signing up in either app signs you
   up in both. When accounts move to a server, only this file changes. */

export const PROFILE_KEY = 'meetup.v1';

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

// Save the profile into Half Sugar's data without touching anything else there
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
}
