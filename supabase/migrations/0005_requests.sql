-- Invitations to chat (spec.md §10, §17 "MatchRequest"). Step 3: one person
-- invites another in a competition; the other accepts (they can chat) or
-- declines; the sender can withdraw while it waits. Teams come in a later step
-- (receiver_team_id is there for them).
--
-- You see only the requests you sent or received. Every change goes through
-- the functions below, which check the rules:
--   both of you have a card in the competition
--   one open request (pending or chatting) between two people per competition
--   no new invitation to someone who declined yours there
--   at most 20 invitations sent a day
-- Run after 0001-0004. Safe to run again.

create table if not exists match_requests (
  id               uuid primary key default gen_random_uuid(),
  competition_id   text not null references competitions(id) on delete cascade,
  kind             text not null default 'solo_to_solo' check (kind in ('solo_to_solo', 'solo_to_team', 'team_to_solo')),
  sender_id        uuid not null references profiles(id) on delete cascade,
  receiver_id      uuid references profiles(id) on delete cascade,
  receiver_team_id uuid,
  note             text not null default '' check (length(note) <= 200),
  status           text not null default 'pending'
                   check (status in ('pending', 'chatting', 'joined', 'declined', 'withdrawn', 'cancelled', 'expired')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (sender_id <> receiver_id),
  check ((receiver_id is null) <> (receiver_team_id is null))
);
create index if not exists match_requests_sender on match_requests (sender_id);
create index if not exists match_requests_receiver on match_requests (receiver_id);
-- One open request between the same two people in a competition, whoever sent it
create unique index if not exists match_requests_one_open on match_requests
  (competition_id, least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status in ('pending', 'chatting') and receiver_id is not null;

alter table match_requests enable row level security;
drop policy if exists "see your own requests" on match_requests;
create policy "see your own requests" on match_requests for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));

-- ---------- The actions ----------

-- Invite someone to chat. Returns the request's id.
create or replace function send_invite(comp text, receiver uuid, invite_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if receiver = me then raise exception 'that is you'; end if;
  if not exists (select 1 from participations where competition_id = comp and user_id = me) then raise exception 'join the competition first'; end if;
  if not exists (select 1 from participations where competition_id = comp and user_id = receiver) then raise exception 'they are not in this competition'; end if;
  if exists (select 1 from match_requests where competition_id = comp and status in ('pending', 'chatting')
             and least(sender_id, receiver_id) = least(me, receiver) and greatest(sender_id, receiver_id) = greatest(me, receiver)) then
    raise exception 'there is already a request between you';
  end if;
  if exists (select 1 from match_requests where competition_id = comp and sender_id = me and receiver_id = receiver and status = 'declined') then
    raise exception 'they declined before';
  end if;
  if (select count(*) from match_requests where sender_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many invitations today';
  end if;
  insert into match_requests (competition_id, kind, sender_id, receiver_id, note)
  values (comp, 'solo_to_solo', me, receiver, left(coalesce(invite_note, ''), 200)) returning id into r;
  return r;
end $$;

-- The receiver accepts (you can chat) or declines
create or replace function answer_invite(request uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s text;
begin
  update match_requests set status = case when accept then 'chatting' else 'declined' end, updated_at = now()
  where id = request and receiver_id = me and status = 'pending' returning status into s;
  if s is null then raise exception 'this invitation is not waiting for your answer'; end if;
  return s;
end $$;

-- The sender takes it back while it is still waiting
create or replace function withdraw_invite(request uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update match_requests set status = 'withdrawn', updated_at = now()
  where id = request and sender_id = auth.uid() and status = 'pending';
  if not found then raise exception 'this invitation cannot be withdrawn'; end if;
end $$;

revoke execute on function send_invite(text, uuid, text), answer_invite(uuid, boolean), withdraw_invite(uuid) from public, anon;
grant execute on function send_invite(text, uuid, text), answer_invite(uuid, boolean), withdraw_invite(uuid) to authenticated;
