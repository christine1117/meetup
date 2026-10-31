-- The website saves a card the way PostgREST does an upsert that returns the row.
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a');
insert into profiles (id, alias, field) values ('00000000-0000-0000-0000-00000000000a', 'A', 'Design');
insert into competitions (id, source, region, kind, name, url, status, listed) values ('dp-1', 'devpost', 'intl', 'Hackathon', 'Test', 'https://example.com', 'published', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
-- first save, then an edit, both returning the row
with saved as (
  insert into participations (competition_id, user_id, offered_roles, desired_roles, goal, weekly_hours, idea, built, availability)
  select x.competition_id, x.user_id, x.offered_roles, x.desired_roles, x.goal, x.weekly_hours, x.idea, x.built, x.availability
  from json_populate_record(null::participations, '{"competition_id":"dp-1","user_id":"00000000-0000-0000-0000-00000000000a","offered_roles":["Design"],"desired_roles":[],"goal":"win","weekly_hours":6,"idea":"","built":"","availability":["mon_eve"]}') x
  on conflict (competition_id, user_id) do update set offered_roles = excluded.offered_roles, idea = excluded.idea
  returning *
) select count(*) from saved;
with saved as (
  insert into participations (competition_id, user_id, offered_roles, goal, weekly_hours, idea)
  values ('dp-1', '00000000-0000-0000-0000-00000000000a', '{Design,Pitch}', 'win', 6, 'edited')
  on conflict (competition_id, user_id) do update set offered_roles = excluded.offered_roles, idea = excluded.idea
  returning *
) select count(*) from saved;
do $$ begin assert (select idea from participations) = 'edited', 'the edit is saved'; end $$;
reset role;
\echo 'Upsert test passed.'
