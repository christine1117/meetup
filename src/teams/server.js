/* Your participation cards on the server (Supabase), one per competition
   (spec.md §4). The database checks who may write what
   (supabase/migrations/0004_participations.sql). */

import { db } from '../shared/supabase.js?v=20261031y';
import { S, U } from './state.js?v=20261031y';

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
