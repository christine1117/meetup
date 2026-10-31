-- Cards, teams and chats live on the server now, so the people you meet are real.
--
-- Reading goes through row-level security:
--   cards, teams, team_members   any signed-in user (needed for recommendations)
--   team_invites                 only the team's members
--   chats, chat_members, votes   only the chat's members
--   messages                     only the members of that chat or team
-- Anything with rules (start a chat, vote, form or join a team, end a chat)
-- goes through the functions below, which check the rules in the database.
-- Run after 0001-0003. Safe to run again.

-- ---------- Tables ----------

-- What you bring to one competition (one card per person per competition)
create table if not exists cards (
  user_id        uuid not null references profiles(id) on delete cascade,
  competition_id text not null references competitions(id) on delete cascade,
  roles          text[] not null check (cardinality(roles) between 1 and 2 and length(array_to_string(roles, '')) <= 80),
  topic          text not null default '' check (length(topic) <= 160),
  goal           text not null default 'win' check (goal in ('win', 'learn', 'fun')),
  hours          int  not null default 6 check (hours between 1 and 60),
  availability   text[] not null default '{}' check (availability <@ array['weekday_day', 'weekday_evening', 'weekend']),
  updated_at     timestamptz not null default now(),
  primary key (user_id, competition_id)
);

create table if not exists teams (
  id             uuid primary key default gen_random_uuid(),
  competition_id text not null references competitions(id) on delete cascade,
  name           text not null check (length(name) between 1 and 60),
  pitch          text not null default '' check (length(pitch) <= 300),
  needs          text[] not null default '{}' check (cardinality(needs) <= 12),
  max_members    int  not null default 5 check (max_members between 2 and 50),
  availability   text[] not null default '{}' check (availability <@ array['weekday_day', 'weekday_evening', 'weekend']),
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- One team per person per competition
create table if not exists team_members (
  team_id        uuid not null references teams(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  competition_id text not null references competitions(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  primary key (team_id, user_id),
  unique (competition_id, user_id)
);

-- The invite link's code: only members can read it
create table if not exists team_invites (
  team_id uuid primary key references teams(id) on delete cascade,
  code    text not null unique default replace(gen_random_uuid()::text, '-', '')
);

create table if not exists chats (
  id             uuid primary key default gen_random_uuid(),
  competition_id text not null references competitions(id) on delete cascade,
  kind           text not null check (kind in ('person', 'team')),
  started_by     uuid not null references profiles(id) on delete cascade,
  with_user      uuid references profiles(id) on delete cascade,
  with_team      uuid references teams(id) on delete cascade,
  status         text not null default 'open' check (status in ('open', 'closed', 'teamed')),
  team_id        uuid references teams(id) on delete set null, -- the team it ended in
  created_at     timestamptz not null default now(),
  last_at        timestamptz not null default now(),          -- last message from a person
  check ((kind = 'person') = (with_user is not null) and (kind = 'team') = (with_team is not null))
);

create table if not exists chat_members (
  chat_id uuid not null references chats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (chat_id, user_id)
);

create table if not exists chat_votes (
  chat_id uuid not null references chats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  at      timestamptz not null default now(),
  primary key (chat_id, user_id)
);

-- Messages of a chat or of a team's own chat. user_id null: a note from Half Sugar,
-- saved in English with {0}, {1} filled from vars, and shown in each reader's language.
create table if not exists messages (
  id      bigint generated always as identity primary key,
  chat_id uuid references chats(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null default auth.uid(),
  text    text not null check (length(text) between 1 and 2000),
  vars    jsonb not null default '[]',
  at      timestamptz not null default now(),
  check ((chat_id is null) <> (team_id is null))
);
create index if not exists messages_chat on messages (chat_id, at);
create index if not exists messages_team on messages (team_id, at);
create index if not exists team_members_user on team_members (user_id);
create index if not exists chat_members_user on chat_members (user_id);
create index if not exists cards_competition on cards (competition_id);

-- ---------- Small helpers (they read past row-level security, so policies do not loop) ----------

create or replace function is_chat_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_members where chat_id = c and user_id = auth.uid())
$$;

create or replace function is_team_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members where team_id = t and user_id = auth.uid())
$$;

create or replace function shares_team(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members a join team_members b on b.team_id = a.team_id
                 where a.user_id = auth.uid() and b.user_id = other)
$$;

-- Sugar: every minute two people talk adds 5%; a pause counts at most 3 minutes;
-- nothing until two different people have written. The same rule as shared/sugar.js.
create or replace function chat_sugar(c uuid) returns int
language sql stable security definer set search_path = public as $$
  with m as (
    select at, lag(at) over (order by at, id) as prev
    from messages where chat_id = c and user_id is not null
  )
  select case
    when (select count(distinct user_id) from messages where chat_id = c and user_id is not null) < 2 then 0
    else least(100, floor(coalesce(sum(least(extract(epoch from (at - prev)), 180)), 0) / 60.0 * 5))::int
  end from m
$$;

-- A chat goes cold after 3 days without a message from a person
create or replace function chat_is_live(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chats where id = c and status = 'open' and last_at > now() - interval '3 days')
$$;

create or replace function alias_of(u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select alias from profiles where id = u), '')
$$;

create or replace function team_size(t uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from team_members where team_id = t
$$;

create or replace function team_of(u uuid, comp text) returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from team_members where user_id = u and competition_id = comp
$$;

-- ---------- Row-level security ----------

alter table cards enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table chats enable row level security;
alter table chat_members enable row level security;
alter table chat_votes enable row level security;
alter table messages enable row level security;

drop policy if exists "signed-in users read cards" on cards;
create policy "signed-in users read cards" on cards for select to authenticated using (true);
drop policy if exists "own cards" on cards;
create policy "own cards" on cards for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "signed-in users read teams" on teams;
create policy "signed-in users read teams" on teams for select to authenticated using (true);
drop policy if exists "signed-in users read team members" on team_members;
create policy "signed-in users read team members" on team_members for select to authenticated using (true);
drop policy if exists "members read the invite code" on team_invites;
create policy "members read the invite code" on team_invites for select to authenticated using (is_team_member(team_id));

drop policy if exists "members read their chats" on chats;
create policy "members read their chats" on chats for select to authenticated using (is_chat_member(id));
drop policy if exists "members read who is in a chat" on chat_members;
create policy "members read who is in a chat" on chat_members for select to authenticated using (is_chat_member(chat_id));
drop policy if exists "members read the votes" on chat_votes;
create policy "members read the votes" on chat_votes for select to authenticated using (is_chat_member(chat_id));

drop policy if exists "members read messages" on messages;
create policy "members read messages" on messages for select to authenticated using (
  (chat_id is not null and is_chat_member(chat_id)) or (team_id is not null and is_team_member(team_id))
);
drop policy if exists "members write in a live chat or their team" on messages;
create policy "members write in a live chat or their team" on messages for insert to authenticated with check (
  user_id = auth.uid() and vars = '[]'::jsonb and (
    (chat_id is not null and is_chat_member(chat_id) and chat_is_live(chat_id))
    or (team_id is not null and is_team_member(team_id))
  )
);

-- Teammates see each other's sealed details (real name, school, contact)
drop policy if exists "sealed details for teammates" on profile_sealed;
create policy "sealed details for teammates" on profile_sealed for select to authenticated using (shares_team(id));

-- ---------- After a message: keep the chat's clock, and say "half sugar" once ----------

create or replace function after_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.chat_id is null or new.user_id is null then return new; end if;
  update chats set last_at = new.at where id = new.chat_id;
  -- The first time the chat reaches half sugar
  if chat_sugar(new.chat_id) >= 50
     and not exists (select 1 from messages where chat_id = new.chat_id and user_id is null and text = 'Half sugar! You can team up now.') then
    insert into messages (chat_id, user_id, text) values (new.chat_id, null, 'Half sugar! You can team up now.');
  end if;
  return new;
end $$;

create or replace function message_time() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then new.at := now(); end if;
  return new;
end $$;

drop trigger if exists messages_time on messages;
create trigger messages_time before insert on messages for each row execute function message_time();
drop trigger if exists messages_after on messages;
create trigger messages_after after insert on messages for each row execute function after_message();

-- ---------- Actions with rules ----------

-- Close a chat with an optional message from the person closing it
create or replace function close_chat(c uuid, who uuid, note text, sys text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if note is not null then insert into messages (chat_id, user_id, text) values (c, who, note); end if;
  if sys is not null then insert into messages (chat_id, user_id, text) values (c, null, sys); end if;
  insert into messages (chat_id, user_id, text) values (c, null, 'Chat ended.');
  update chats set status = 'closed' where id = c and status = 'open';
end $$;

-- After people join a team, their other open chats in that competition:
--   with another team, or someone else recruiting them: ended politely
--   their own chats with a person they were recruiting: the new teammates join in
-- Then, if the team is full, every open chat involving the team ends.
create or replace function settle_chats(comp text, joiners uuid[], t uuid, keep uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select distinct ch.id, ch.kind, ch.with_user, m.user_id as who from chats ch join chat_members m on m.chat_id = ch.id
           where ch.competition_id = comp and ch.status = 'open' and m.user_id = any(joiners) and ch.id is distinct from keep loop
    if c.kind = 'team' or c.with_user = c.who then
      if exists (select 1 from chats where id = c.id and status = 'open') then
        perform close_chat(c.id, c.who, 'I just joined a team. Thanks for chatting, and good luck!', null);
      end if;
    elsif exists (select 1 from team_members tm where tm.team_id = t
                  and not exists (select 1 from chat_members x where x.chat_id = c.id and x.user_id = tm.user_id)) then
      insert into chat_members (chat_id, user_id)
        select c.id, tm.user_id from team_members tm where tm.team_id = t on conflict do nothing;
      insert into messages (chat_id, user_id, text) values (c.id, null, 'You are in a team now, so your teammates are in this chat too.');
    end if;
  end loop;
  if team_size(t) >= (select max_members from teams where id = t) then
    for c in select distinct ch.id from chats ch join chat_members m on m.chat_id = ch.id
             join team_members tm on tm.user_id = m.user_id and tm.team_id = t
             where ch.competition_id = comp and ch.status = 'open' and ch.id is distinct from keep loop
      perform close_chat(c.id, null, null, 'The team is full now, so this chat ended.');
    end loop;
  end if;
end $$;

-- A role the team asked for is no longer needed once someone with it joins
create or replace function drop_needs(t uuid, newcomer uuid) returns void
language sql security definer set search_path = public as $$
  update teams set needs = array(select n from unnest(needs) n
    where n <> all (coalesce((select roles from cards where user_id = newcomer and competition_id = teams.competition_id), '{}')))
  where id = t
$$;

create or replace function create_team(comp text, team_name text, team_pitch text, team_needs text[], team_max int, team_availability text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if team_of(me, comp) is not null then raise exception 'already in a team for this competition'; end if;
  insert into teams (competition_id, name, pitch, needs, max_members, availability, created_by)
  values (comp, team_name, coalesce(team_pitch, ''), coalesce(team_needs, '{}'), team_max, coalesce(team_availability, '{}'), me)
  returning id into t;
  insert into team_members (team_id, user_id, competition_id) values (t, me, comp);
  insert into team_invites (team_id) values (t);
  insert into messages (team_id, user_id, text) values (t, null, 'Team created. Invite friends with the link, or find the rest in the competition.');
  return t;
end $$;

create or replace function update_team(t uuid, team_name text, team_pitch text, team_needs text[], team_max int, team_availability text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_team_member(t) then raise exception 'not a member of this team'; end if;
  update teams set name = coalesce(nullif(team_name, ''), name), pitch = coalesce(team_pitch, pitch),
                   needs = coalesce(team_needs, needs), availability = coalesce(team_availability, availability),
                   max_members = greatest(coalesce(team_max, max_members), team_size(t))
  where id = t;
end $$;

-- Join with an invite link: straight in, no chat needed
create or replace function join_team(invite text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t record;
begin
  if me is null then raise exception 'not signed in'; end if;
  select teams.* into t from teams join team_invites i on i.team_id = teams.id where i.code = invite;
  if t.id is null then raise exception 'invite not found'; end if;
  if is_team_member(t.id) then return t.id; end if;
  if team_of(me, t.competition_id) is not null then raise exception 'already in a team for this competition'; end if;
  if team_size(t.id) >= t.max_members then raise exception 'the team is full'; end if;
  insert into team_members (team_id, user_id, competition_id) values (t.id, me, t.competition_id);
  perform drop_needs(t.id, me);
  insert into messages (team_id, user_id, text, vars) values (t.id, null, '{0} joined with your invite link.', jsonb_build_array(alias_of(me)));
  perform settle_chats(t.competition_id, array[me], t.id, null);
  return t.id;
end $$;

-- Say hi: with a person (your whole team joins the chat) or with a team (all of it joins)
create or replace function start_chat(comp text, chat_kind text, ref uuid, first_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine uuid; theirs uuid; c uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from cards where user_id = me and competition_id = comp) then raise exception 'join the competition first'; end if;
  if length(coalesce(first_text, '')) not between 1 and 2000 then raise exception 'say something first'; end if;
  mine := team_of(me, comp);
  if chat_kind = 'person' then
    if ref = me then raise exception 'that is you'; end if;
    if not exists (select 1 from cards where user_id = ref and competition_id = comp) then raise exception 'they are not in this competition'; end if;
    if team_of(ref, comp) is not null then raise exception 'they are already in a team'; end if;
    if mine is not null and team_size(mine) >= (select max_members from teams where id = mine) then raise exception 'your team is full'; end if;
    -- Either of you may have said hi first
    select ch.id into c from chats ch
      where ch.competition_id = comp and ch.kind = 'person'
        and exists (select 1 from chat_members m where m.chat_id = ch.id and m.user_id = me)
        and exists (select 1 from chat_members m where m.chat_id = ch.id and m.user_id = ref) limit 1;
  elsif chat_kind = 'team' then
    if mine is not null then raise exception 'already in a team for this competition'; end if;
    select id into theirs from teams where id = ref and competition_id = comp;
    if theirs is null then raise exception 'team not found'; end if;
    if team_size(theirs) >= (select max_members from teams where id = theirs) then raise exception 'the team is full'; end if;
    select ch.id into c from chats ch join chat_members m on m.chat_id = ch.id
      where ch.competition_id = comp and ch.kind = 'team' and ch.with_team = theirs and m.user_id = me limit 1;
  else
    raise exception 'unknown kind';
  end if;
  if c is not null then return c; end if; -- you already have this chat

  insert into chats (competition_id, kind, started_by, with_user, with_team)
  values (comp, chat_kind, me, case when chat_kind = 'person' then ref end, theirs) returning id into c;
  if chat_kind = 'person' then
    insert into chat_members (chat_id, user_id)
      select c, user_id from team_members where team_id = mine
      union select c, me union select c, ref;
    if mine is not null and team_size(mine) > 1 then
      insert into messages (chat_id, user_id, text) values (c, null, 'Your whole team is in this chat. Everyone uses nicknames until you team up.');
    end if;
  else
    insert into chat_members (chat_id, user_id) select c, user_id from team_members where team_id = theirs union select c, me;
    insert into messages (chat_id, user_id, text) values (c, null, 'Everyone on the team is in this chat. Everyone uses nicknames until you team up.');
  end if;
  insert into messages (chat_id, user_id, text) values (c, me, first_text);
  return c;
end $$;

-- Say yes to teaming up. When everyone in the chat has said yes, the team forms.
-- Returns the team's id once it is formed, otherwise null.
create or replace function vote_team_up(c uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ch record; t uuid; newcomer uuid; members int; fresh boolean := false; joiners uuid[];
begin
  if me is null then raise exception 'not signed in'; end if;
  if not is_chat_member(c) then raise exception 'not in this chat'; end if;
  select * into ch from chats where id = c;
  if not chat_is_live(c) then raise exception 'this chat is not open'; end if;
  if chat_sugar(c) < 50 then raise exception 'talk until half sugar first'; end if;
  select count(*) into members from chat_members where chat_id = c;
  -- The team this would make must fit
  t := coalesce(ch.with_team, (select team_of(user_id, ch.competition_id) from chat_members
                                where chat_id = c and user_id <> ch.with_user and team_of(user_id, ch.competition_id) is not null limit 1));
  if t is not null and members > (select max_members from teams where id = t) then raise exception 'the team is full'; end if;

  insert into chat_votes (chat_id, user_id) values (c, me) on conflict do nothing;
  if found then
    insert into messages (chat_id, user_id, text, vars) values (c, null, '{0} said yes to teaming up.', jsonb_build_array(alias_of(me)));
  end if;
  if (select count(*) from chat_votes where chat_id = c) < members then return null; end if;

  -- Everyone said yes: make (or grow) the team
  if ch.kind = 'team' then
    newcomer := ch.started_by;
  else
    newcomer := ch.with_user;
  end if;
  if t is null then
    insert into teams (competition_id, name, max_members, created_by)
    values (ch.competition_id, left(alias_of(ch.started_by) || ' & ' || alias_of(ch.with_user), 60), 5, ch.started_by) returning id into t;
    insert into team_invites (team_id) values (t);
    insert into team_members (team_id, user_id, competition_id)
      select t, user_id, ch.competition_id from chat_members where chat_id = c;
    fresh := true;
  else
    insert into team_members (team_id, user_id, competition_id)
      select t, user_id, ch.competition_id from chat_members m
      where m.chat_id = c and not exists (select 1 from team_members x where x.team_id = t and x.user_id = m.user_id);
  end if;
  perform drop_needs(t, newcomer);
  update chats set status = 'teamed', team_id = t where id = c;
  insert into messages (chat_id, user_id, text) values (c, null, 'You teamed up! Names are unlocked.');
  if fresh then
    insert into messages (team_id, user_id, text) values (t, null, 'Team formed. Names are now visible to everyone in the team.');
    joiners := array(select user_id from chat_members where chat_id = c);
  else
    insert into messages (team_id, user_id, text, vars) values (t, null, '{0} joined the team after chatting to half sugar.', jsonb_build_array(alias_of(newcomer)));
    joiners := array[newcomer];
  end if;
  perform settle_chats(ch.competition_id, joiners, t, c);
  return t;
end $$;

-- Not a fit: end the chat politely; you are not shown to each other again in this competition
create or replace function end_chat(c uuid, note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_chat_member(c) then raise exception 'not in this chat'; end if;
  if not exists (select 1 from chats where id = c and status = 'open') then return; end if;
  perform close_chat(c, auth.uid(), nullif(left(coalesce(note, ''), 2000), ''), null);
end $$;

-- Who may call what. The inner steps only run inside the actions; the checks used by the
-- policies need signed-in users; the actions are for signed-in users only.
revoke execute on function close_chat(uuid, uuid, text, text), settle_chats(text, uuid[], uuid, uuid), drop_needs(uuid, uuid),
  alias_of(uuid), team_size(uuid), team_of(uuid, text), after_message() from public, anon, authenticated;
revoke execute on function is_chat_member(uuid), is_team_member(uuid), shares_team(uuid), chat_is_live(uuid), chat_sugar(uuid) from public, anon;
grant execute on function is_chat_member(uuid), is_team_member(uuid), shares_team(uuid), chat_is_live(uuid) to authenticated;
revoke execute on function create_team(text, text, text, text[], int, text[]), update_team(uuid, text, text, text[], int, text[]),
  join_team(text), start_chat(text, text, uuid, text), vote_team_up(uuid), end_chat(uuid, text) from public, anon;
grant execute on function create_team(text, text, text, text[], int, text[]), update_team(uuid, text, text, text[], int, text[]),
  join_team(text), start_chat(text, text, uuid, text), vote_team_up(uuid), end_chat(uuid, text), chat_sugar(uuid) to authenticated;

-- ---------- Live updates (Supabase Realtime) for chats and teams ----------
do $$
declare t text;
begin
  foreach t in array array['messages', 'chats', 'chat_votes', 'team_members', 'teams'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end $$;
