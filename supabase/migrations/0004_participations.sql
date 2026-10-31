-- Participation cards (spec.md §4, §17 "Participation"): what you bring to one
-- competition. One card per person per competition; the profile is shared.
-- You see the cards of a competition only once you have a card there yourself
-- (they are what recommendations show); only you can write yours.
-- Run after 0001-0003. Safe to run again.

create table if not exists participations (
  competition_id    text not null references competitions(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade default auth.uid(),
  offered_roles     text[] not null check (cardinality(offered_roles) between 1 and 2 and length(array_to_string(offered_roles, '')) <= 80),
  desired_roles     text[] not null default '{}' check (cardinality(desired_roles) <= 3 and length(array_to_string(desired_roles, '')) <= 120),
  goal              text not null check (goal in ('win', 'learn', 'experience')),
  weekly_hours      int  not null check (weekly_hours between 1 and 60),
  idea              text not null default '' check (length(idea) <= 300),  -- your idea for this competition
  built             text not null default '' check (length(built) <= 200), -- something you have built or done
  -- when you usually work: day_part, e.g. mon_eve, sat_am (mon..sun x am / pm / eve)
  availability      text[] not null default '{}' check (availability <@ array['mon_am', 'mon_pm', 'mon_eve', 'tue_am', 'tue_pm', 'tue_eve', 'wed_am', 'wed_pm', 'wed_eve', 'thu_am', 'thu_pm', 'thu_eve', 'fri_am', 'fri_pm', 'fri_eve', 'sat_am', 'sat_pm', 'sat_eve', 'sun_am', 'sun_pm', 'sun_eve']),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (competition_id, user_id)
);
create index if not exists participations_user on participations (user_id);

-- Do you have a card in this competition? (Reads past row-level security, so the policy does not loop.)
create or replace function has_card(comp text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from participations where competition_id = comp and user_id = auth.uid())
$$;
revoke execute on function has_card(text) from public, anon;
grant execute on function has_card(text) to authenticated;

alter table participations enable row level security;
drop policy if exists "signed-in users read participations" on participations;
drop policy if exists "people in the same competition read cards" on participations;
create policy "people in the same competition read cards" on participations for select to authenticated using (has_card(competition_id));
drop policy if exists "own participations" on participations;
create policy "own participations" on participations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- updated_at follows every change
create or replace function participations_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists participations_touch on participations;
create trigger participations_touch before update on participations for each row execute function participations_touch();
