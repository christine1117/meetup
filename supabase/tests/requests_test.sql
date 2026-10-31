-- Tests for 0005_requests.sql (invitations), run by tools/test_db.sh on a fresh database.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000000' || x)::uuid from unnest(array['a', 'b', 'c', 'd']) x;
insert into profiles (id, alias, field) select id, 'User ' || right(id::text, 1), 'Design' from auth.users;
insert into competitions (id, source, region, kind, name, url, status, listed) values
  ('dp-1', 'devpost', 'intl', 'Hackathon', 'Test Hack', 'https://example.com', 'published', true);
-- A, B and C have cards; D has none
insert into participations (competition_id, user_id, offered_roles, goal, weekly_hours)
select 'dp-1', ('00000000-0000-0000-0000-00000000000' || x)::uuid, '{Design}', 'win', 6 from unnest(array['a', 'b', 'c']) x;

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
    if contains <> '' and position(contains in sqlerrm) = 0 then
      raise exception 'expected an error with "%", got "%"', contains, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected an error with "%" from: %', contains, stmt;
end $$;

-- A invites B; only A and B see it
select pg_temp.as_user('a');
select send_invite('dp-1', '00000000-0000-0000-0000-00000000000b', 'I design; want to build something?') as ab \gset
do $$ begin assert (select status from match_requests) = 'pending', 'pending'; end $$;
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000b', 'again?')$$, 'already a request');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', '')$$, 'that is you');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000d', '')$$, 'not in this competition');
-- No changing requests by hand (row-level security: the update touches no rows)
update match_requests set status = 'chatting' where id = :'ab';
delete from match_requests where id = :'ab';
reset role;
do $$ begin assert (select status from match_requests) = 'pending', 'a direct update or delete did nothing'; end $$;

select pg_temp.as_user('c');
do $$ begin assert (select count(*) from match_requests) = 0, 'C sees no one else''s requests'; end $$;
reset role;

-- B cannot also invite A while A's invitation is open; A cannot answer their own invitation
select pg_temp.as_user('b');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', '')$$, 'already a request');
reset role;
select pg_temp.as_user('a');
select pg_temp.expect_error(format($$select answer_invite(%L, true)$$, :'ab'), 'not waiting for your answer');
reset role;

-- B accepts: they can chat; accepting twice does not work
select pg_temp.as_user('b');
do $$ begin assert answer_invite((select id from match_requests), true) = 'chatting', 'accepted'; end $$;
select pg_temp.expect_error(format($$select answer_invite(%L, false)$$, :'ab'), 'not waiting');
reset role;

-- A invites C, then withdraws; C invites A, A declines; C cannot invite A again
select pg_temp.as_user('a');
select send_invite('dp-1', '00000000-0000-0000-0000-00000000000c', '') as ac \gset
select withdraw_invite(:'ac');
do $$ begin assert (select status from match_requests where id = (select id from match_requests where receiver_id = '00000000-0000-0000-0000-00000000000c')) = 'withdrawn', 'withdrawn'; end $$;
reset role;
select pg_temp.as_user('c');
select pg_temp.expect_error(format($$select withdraw_invite(%L)$$, :'ac'), 'cannot be withdrawn');
select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', 'Hi!') as ca \gset
reset role;
select pg_temp.as_user('a');
do $$ begin assert answer_invite((select id from match_requests where sender_id = '00000000-0000-0000-0000-00000000000c'), false) = 'declined', 'declined'; end $$;
reset role;
select pg_temp.as_user('c');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', 'Please?')$$, 'declined before');
reset role;

-- No card, no invitations
select pg_temp.as_user('d');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', '')$$, 'join the competition first');
reset role;

-- At most 20 invitations a day
insert into match_requests (competition_id, sender_id, receiver_id, status, created_at)
select 'dp-1', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', 'withdrawn', now() from generate_series(1, 20);
select pg_temp.as_user('b');
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000c', '')$$, 'too many');
reset role;

-- Anon: nothing
set role anon;
do $$ begin assert (select count(*) from match_requests) = 0, 'anon sees nothing'; end $$;
select pg_temp.expect_error($$select send_invite('dp-1', '00000000-0000-0000-0000-00000000000a', '')$$, 'permission denied');
reset role;

\echo 'Request tests passed.'
