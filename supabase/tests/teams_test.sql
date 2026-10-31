-- Tests for 0004_teams_and_chats.sql, run by tools/test_db.sh on a throwaway PostgreSQL.
-- Each check raises an error when it fails, which stops the run.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- People A..G, one competition with a listed row
insert into auth.users (id) select ('00000000-0000-0000-0000-00000000000' || x)::uuid from unnest(array['a','b','c','d','e','f','9']) x;
insert into profiles (id, alias, field) select id, 'User ' || right(id::text, 1), 'Design' from auth.users;
insert into profile_sealed (id, real_name) select id, 'Real ' || right(id::text, 1) from auth.users;
insert into competitions (id, source, region, kind, name, url, status, listed) values ('dp-1', 'devpost', 'intl', 'Hackathon', 'Test Hack', 'https://example.com', 'published', true);

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || u, false);
  perform set_config('role', 'authenticated', false);
end $$;
create function pg_temp.expect_error(stmt text, contains text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(contains in sqlerrm) = 0 and contains <> '' then
      raise exception 'expected an error with "%", got "%"', contains, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected an error with "%" from: %', contains, stmt;
end $$;

-- 1. Cards: your own only; everyone signed in can read them; anon cannot
select pg_temp.as_user('a');
insert into cards (user_id, competition_id, roles, goal, hours, availability) values (auth.uid(), 'dp-1', '{Design}', 'win', 6, '{weekend}');
select pg_temp.expect_error($$insert into cards (user_id, competition_id, roles) values ('00000000-0000-0000-0000-00000000000b', 'dp-1', '{Backend}')$$, 'row-level security');
select pg_temp.expect_error($$insert into cards (user_id, competition_id, roles, availability) values (auth.uid(), 'dp-1', '{X}', '{midnight}')$$, '');
reset role;
insert into cards (user_id, competition_id, roles) select id, 'dp-1', array[r] from (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'Backend'), ('00000000-0000-0000-0000-00000000000c'::uuid, 'Frontend'),
  ('00000000-0000-0000-0000-00000000000d'::uuid, 'Data'), ('00000000-0000-0000-0000-00000000000e'::uuid, 'Pitch'),
  ('00000000-0000-0000-0000-00000000000f'::uuid, 'Writing')) v(id, r);
select pg_temp.as_user('c');
do $$ begin assert (select count(*) from cards) = 6, 'signed-in users read every card'; end $$;
reset role;
set role anon;
do $$ begin assert (select count(*) from cards) = 0, 'anon reads no cards'; end $$;
select pg_temp.expect_error($$select start_chat('dp-1', 'person', '00000000-0000-0000-0000-00000000000b', 'hi')$$, 'permission denied');
reset role;

-- 2. A says hi to B. Only A and B see the chat; C cannot read or write in it
select pg_temp.as_user('a');
select start_chat('dp-1', 'person', '00000000-0000-0000-0000-00000000000b', 'Hi, I design. Want to team up?') as ab \gset
do $$ begin assert (select count(*) from messages where chat_id = (select id from chats limit 1)) = 1, 'A sees the first message'; end $$;
select pg_temp.expect_error($$select start_chat('dp-1', 'person', '00000000-0000-0000-0000-000000000009', 'hi')$$, 'not in this competition');
reset role;
select pg_temp.as_user('b');
do $$ begin assert (select start_chat('dp-1', 'person', '00000000-0000-0000-0000-00000000000a', 'hi back')) = (select id from chats limit 1), 'saying hi back reuses the same chat'; end $$;
reset role;
select pg_temp.as_user('c');
do $$ begin assert (select count(*) from chats) = 0 and (select count(*) from messages) = 0, 'C sees nothing of the A-B chat'; end $$;
select pg_temp.expect_error(format($$insert into messages (chat_id, text) values (%L, 'sneaky')$$, :'ab'), 'row-level security');
reset role;

-- 3. A message's time is the server's: a backdated message gets "now"
select pg_temp.as_user('b');
insert into messages (chat_id, text, at) values (:'ab', 'Backend here.', now() - interval '1 hour');
do $$ begin assert (select max(at) from messages where text = 'Backend here.') > now() - interval '1 minute', 'messages cannot be backdated'; end $$;
select pg_temp.expect_error(format($$insert into messages (chat_id, user_id, text) values (%L, null, 'fake note')$$, :'ab'), 'row-level security');
-- Too early to team up
select pg_temp.expect_error(format($$select vote_team_up(%L)$$, :'ab'), 'half sugar');
reset role;

-- 4. Ten minutes of talk (written by the server here), then half sugar is announced once
insert into messages (chat_id, user_id, text, at)
select :'ab', case when i % 2 = 0 then '00000000-0000-0000-0000-00000000000a'::uuid else '00000000-0000-0000-0000-00000000000b'::uuid end,
       'msg ' || i, now() - interval '30 minutes' + (i * interval '2 minutes')
from generate_series(1, 7) i;
do $$ begin
  assert chat_sugar((select id from chats limit 1)) >= 50, 'ten minutes of talk is half sugar';
  assert (select count(*) from messages where text = 'Half sugar! You can team up now.') = 1, 'half sugar is said once';
end $$;

-- 5. Both say yes: a team forms, names unlock between teammates only
select pg_temp.as_user('a');
do $$ begin assert vote_team_up((select id from chats limit 1)) is null, 'one yes is not enough'; end $$;
reset role;
select pg_temp.as_user('b');
select vote_team_up(:'ab') as team \gset
do $$ begin
  assert (select status from chats limit 1) = 'teamed', 'the chat is marked teamed';
  assert (select count(*) from team_members) = 2, 'A and B are a team';
  assert (select real_name from profile_sealed where id = '00000000-0000-0000-0000-00000000000a') = 'Real a', 'B sees A''s real name';
end $$;
reset role;
select pg_temp.as_user('c');
do $$ begin assert (select count(*) from profile_sealed where id <> auth.uid()) = 0, 'C sees no one''s sealed details'; end $$;
reset role;

-- 6. One team per competition
select pg_temp.as_user('a');
select pg_temp.expect_error($$select create_team('dp-1', 'Second', '', '{}', 4, '{}')$$, 'already in a team');
-- Team chat: members write and read; others do not
insert into messages (team_id, text) values (:'team', 'Welcome!');
select update_team(:'team', 'Clear Air', 'Air quality near schools', '{Frontend,Data}', 3, '{weekend}');
select code from team_invites \gset
reset role;
select pg_temp.as_user('d');
do $$ begin
  assert (select count(*) from messages where team_id is not null) = 0, 'D cannot read the team chat';
  assert (select count(*) from team_invites) = 0, 'D cannot read the invite code';
end $$;
select pg_temp.expect_error(format($$insert into messages (team_id, text) values (%L, 'hi')$$, :'team'), 'row-level security');
select pg_temp.expect_error(format($$select update_team(%L, 'Mine now', null, null, null, null)$$, :'team'), 'not a member');
reset role;

-- 7. C talks to the team, then joins with the invite link instead; the team (max 3) is full
select pg_temp.as_user('e');
select start_chat('dp-1', 'team', :'team', 'I can pitch!') as et \gset
reset role;
select pg_temp.as_user('c');
select join_team(:'code');
do $$ begin
  assert (select count(*) from team_members) = 3, 'C joined';
  assert (select needs from teams) = '{Data}', 'Frontend is no longer needed';
end $$;
reset role;
do $$ begin
  assert (select status from chats where kind = 'team') = 'closed', 'a full team ends its open chats';
end $$;
select pg_temp.as_user('d');
select pg_temp.expect_error(format($$select join_team(%L)$$, :'code'), 'full');
select pg_temp.expect_error(format($$select start_chat('dp-1', 'team', %L, 'hi')$$, :'team'), 'full');
reset role;

-- 8. Not a fit: D and F chat, F ends it politely; nobody can write after that
select pg_temp.as_user('d');
select start_chat('dp-1', 'person', '00000000-0000-0000-0000-00000000000f', 'Hello!') as df \gset
reset role;
select pg_temp.as_user('f');
select end_chat(:'df', 'Thanks for chatting!');
do $$ begin
  assert (select status from chats where kind = 'person' and with_user = auth.uid()) = 'closed', 'the chat is closed';
end $$;
select pg_temp.expect_error(format($$insert into messages (chat_id, text) values (%L, 'one more')$$, :'df'), 'row-level security');
reset role;

-- 9. A chat goes cold after 3 days without a reply
select pg_temp.as_user('e');
select start_chat('dp-1', 'person', '00000000-0000-0000-0000-00000000000d', 'Need a pitch person?') as ed \gset
reset role;
update chats set last_at = now() - interval '4 days' where id = :'ed';
select pg_temp.as_user('d');
select pg_temp.expect_error(format($$insert into messages (chat_id, text) values (%L, 'sorry, late')$$, :'ed'), 'row-level security');
reset role;

-- 10. Everyone sees only the chats they are in
select pg_temp.as_user('a');
do $$ begin assert (select count(*) from chats) = 2, 'A sees the A-B chat and E''s chat with the team, not D-F'; end $$;
reset role;

\echo 'All database tests passed.'
