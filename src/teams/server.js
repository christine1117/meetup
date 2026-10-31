/* Your participation cards on the server (Supabase), one per competition
   (spec.md §4). The database checks who may write what
   (supabase/migrations/0004_participations.sql). */

import { db } from '../shared/supabase.js?v=20261101g';
import { S, U } from './state.js?v=20261101g';

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

// ---------- Invitations (spec §10): the ones you sent or received ----------

const RPC = async (fn, args) => {
  const c = await client();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data;
};

export async function loadRequests() {
  const c = await client();
  const { data, error } = await c.from('match_requests')
    .select('*, sender:profiles!match_requests_sender_id_fkey(alias, field), receiver:profiles!match_requests_receiver_id_fkey(alias, field), competitions(name, i18n)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  S.requests = (data || []).map((r) => {
    const mine = r.sender_id === U.user.id;
    const other = (mine ? r.receiver : r.sender) || {};
    return { id: r.id, comp: r.competition_id, status: r.status, note: r.note, mine, other: mine ? r.receiver_id : r.sender_id,
      alias: other.alias || '…', field: other.field || 'Other', at: Date.parse(r.updated_at),
      // The competition's name, for when it is no longer in the open list
      competition: r.competitions ? { id: r.competition_id, name: r.competitions.name, i18n: r.competitions.i18n || {} } : null };
  });
}
export const sendInvite = (cid, uid, note) => RPC('send_invite', { comp: cid, receiver: uid, invite_note: note });
export const answerInvite = (id, accept) => RPC('answer_invite', { request: id, accept });
export const withdrawInvite = (id) => RPC('withdraw_invite', { request: id });

// What the database said about an invitation, in plain words
export function inviteProblem(err) {
  const m = String((err && err.message) || err || '');
  if (/already a request/.test(m)) return 'There is already an invitation between you two.';
  if (/declined before/.test(m)) return 'They declined before, so you cannot invite them again.';
  if (/too many/.test(m)) return 'You have sent 20 invitations today. Try again tomorrow.';
  if (/not in this competition/.test(m)) return 'They are no longer in this competition.';
  if (/join the competition first/.test(m)) return 'Fill in your card for this competition first.';
  if (/not waiting|cannot be withdrawn/.test(m)) return 'This invitation has already been answered.';
  return 'Something went wrong. Please try again.';
}
