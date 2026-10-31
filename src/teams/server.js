/* Your participation cards on the server (Supabase), one per competition
   (spec.md §4). The database checks who may write what
   (supabase/migrations/0004_participations.sql). */

import { db } from '../shared/supabase.js?v=20261101d';
import { S, U } from './state.js?v=20261101d';

// A row of the participations table <-> the card the pages use
export const cardFromRow = (r) => ({
  canDo: r.offered_roles || [], wants: r.desired_roles || [], goal: r.goal, hours: r.weekly_hours,
  idea: r.idea || '', built: r.built || '', availability: r.availability || [],
});
export const rowFromCard = (cid, userId, c) => ({
  competition_id: cid, user_id: userId, offered_roles: c.canDo, desired_roles: c.wants || [], goal: c.goal,
  weekly_hours: Number(c.hours) || 6, idea: c.idea || '', built: c.built || '', availability: c.availability || [],
});

async function client() {
  const c = await db();
  if (!c || !U.user) throw new Error('not signed in');
  return c;
}

export async function loadCards() {
  const c = await client();
  const { data, error } = await c.from('participations').select('*').eq('user_id', U.user.id);
  if (error) throw error;
  S.cards = Object.fromEntries((data || []).map((r) => [r.competition_id, cardFromRow(r)]));
}

export async function saveCard(cid, card) {
  const c = await client();
  const { data, error } = await c.from('participations').upsert(rowFromCard(cid, U.user.id, card)).select().single();
  if (error) throw error;
  S.cards[cid] = cardFromRow(data);
}

// Everyone else's cards in one competition, with their public profile (for recommendations).
// The database only shows them once you have a card there yourself.
export const OTHERS = {}; // competition -> [{ id, alias, field, city, ...card }]
export async function loadOthers(cid) {
  const c = await client();
  const { data, error } = await c.from('participations').select('*, profiles(alias, field, city, curious)')
    .eq('competition_id', cid).neq('user_id', U.user.id);
  if (error) throw error;
  OTHERS[cid] = (data || []).map((r) => ({ id: r.user_id, ...(r.profiles || { alias: '…', field: 'Other', city: '', curious: [] }), ...cardFromRow(r) }));
}
