-- Tests for 0004_participations.sql, run by tools/test_db.sh on a throwaway PostgreSQL.
-- Each check raises an error when it fails, which stops the run.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

insert into auth.users (id) select ('00000000-0000-0000-0000-00000000000' || x)::uuid from unnest(array['a', 'b']) x;
insert into profiles (id, alias, field) select id, 'User ' || right(id::text, 1), 'Design' from auth.users;
insert into competitions (id, source, region, kind, name, url, status, listed) values
  ('dp-1', 'devpost', 'intl', 'Hackathon', 'Test Hack', 'https://example.com', 'published', true),
  ('dp-2', 'devpost', 'intl', 'Hackathon', 'Other Hack', 'https://example.com', 'published', true);

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

-- A writes a card; the user id comes from the sign-in, not from the page
select pg_temp.as_user('a');
insert into participations (competition_id, offered_roles, desired_roles, goal, weekly_hours, idea, built, availability)
values ('dp-1', '{Design}', '{Frontend,Backend}', 'win', 6, 'Air quality alerts near schools', 'A bus app used by 2,000 riders', '{mon_eve,sat_am,sat_pm}');
do $$ begin
  assert (select user_id from participations) = auth.uid(), 'the card is A''s';
end $$;

-- One card per competition; a second competition is a second card
select pg_temp.expect_error($$insert into participations (competition_id, offered_roles, goal, weekly_hours) values ('dp-1', '{Data}', 'learn', 3)$$, 'duplicate key');
insert into participations (competition_id, offered_roles, goal, weekly_hours) values ('dp-2', '{Data}', 'learn', 3);

-- The rules of a card
select pg_temp.expect_error($$insert into participations (competition_id, user_id, offered_roles, goal, weekly_hours) values ('dp-1', '00000000-0000-0000-0000-00000000000b', '{Backend}', 'win', 6)$$, 'row-level security');
select pg_temp.expect_error($$update participations set offered_roles = '{A,B,C}' where competition_id = 'dp-1'$$, 'check');
select pg_temp.expect_error($$update participations set goal = 'fame' where competition_id = 'dp-1'$$, 'check');
select pg_temp.expect_error($$update participations set availability = '{midnight}' where competition_id = 'dp-1'$$, 'check');
select pg_temp.expect_error($$update participations set availability = '{weekend}' where competition_id = 'dp-1'$$, 'check');
select pg_temp.expect_error($$update participations set built = repeat('x', 201) where competition_id = 'dp-1'$$, 'check');
select pg_temp.expect_error($$update participations set idea = repeat('x', 301) where competition_id = 'dp-1'$$, 'check');

-- Edit
update participations set built = 'A bus app used by 2,000 riders, and a booking site' where competition_id = 'dp-1';
do $$ begin
  assert (select updated_at > created_at from participations where competition_id = 'dp-1'), 'updated_at moves on an edit';
end $$;
reset role;

-- B sees no cards before having one; with a card in dp-1, B sees dp-1's cards only
select pg_temp.as_user('b');
do $$ begin assert (select count(*) from participations) = 0, 'no card, no cards to see'; end $$;
insert into participations (competition_id, offered_roles, goal, weekly_hours) values ('dp-1', '{Backend}', 'win', 6);
do $$ begin
  assert (select count(*) from participations) = 2, 'B sees A''s and own card in dp-1';
  assert (select count(*) from participations where competition_id = 'dp-2') = 0, 'not A''s card in dp-2';
end $$;
-- B cannot change or delete A's card
update participations set built = 'hacked' where user_id <> auth.uid();
delete from participations where user_id <> auth.uid();
reset role;
do $$ begin
  assert (select count(*) from participations where built = 'hacked') = 0, 'B cannot edit A''s card';
  assert (select count(*) from participations where user_id = '00000000-0000-0000-0000-00000000000a') = 2, 'B cannot delete A''s cards';
end $$;
set role anon;
do $$ begin assert (select count(*) from participations) = 0, 'anon reads no cards'; end $$;
reset role;

\echo 'Participation tests passed.'
