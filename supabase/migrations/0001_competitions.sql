-- Competitions, their team-size rules, and the review list.
-- Written by the daily crawler (with the service role key, which bypasses
-- row-level security). The website can only read what is listed.

create table if not exists competitions (
  id                   text primary key check (id ~ '^[a-z]+-[A-Za-z0-9_-]+$'),
  source               text not null check (source in ('devpost', 'mlh', 'bhuntr')),
  region               text not null check (region in ('tw', 'intl')),
  kind                 text not null,
  name                 text not null check (length(name) between 1 and 200),
  organizer            text not null default '',
  url                  text not null check (url ~* '^https?://'),
  start_at             timestamptz,
  end_at               timestamptz,
  deadline_at          timestamptz,
  location             text not null default '',
  tags                 text[] not null default '{}',
  prize                text not null default '',
  summary              text not null default '',
  eligibility          text,
  eligibility_evidence text,
  status               text not null check (status in ('published', 'review', 'excluded', 'pending')),
  listed               boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- One row per track (組別). Sizes count participants only; mentors are separate.
create table if not exists competition_team_rules (
  id                 bigint generated always as identity primary key,
  competition_id     text not null references competitions(id) on delete cascade,
  track              text,
  min_members        int check (min_members between 1 and 100),
  max_members        int check (max_members between 1 and 100),
  individual_allowed boolean,
  mentors_max        int check (mentors_max between 0 and 20),
  evidence           text not null check (length(evidence) >= 2),   -- exact quote from the page
  check (min_members is null or max_members is null or min_members <= max_members)
);
create index if not exists competition_team_rules_competition on competition_team_rules (competition_id);

-- What a person should check: conflicts, missing quotes, unsure answers
create table if not exists extraction_reviews (
  id             bigint generated always as identity primary key,
  competition_id text not null references competitions(id) on delete cascade,
  issue          text not null,
  detail         text not null default '',
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references auth.users(id)
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists competitions_touch on competitions;
create trigger competitions_touch before update on competitions for each row execute function touch_updated_at();

-- Row-level security: anyone may read listed competitions and their rules; nothing else
alter table competitions enable row level security;
alter table competition_team_rules enable row level security;
alter table extraction_reviews enable row level security;

drop policy if exists "read listed competitions" on competitions;
create policy "read listed competitions" on competitions for select using (listed);

drop policy if exists "read rules of listed competitions" on competition_team_rules;
create policy "read rules of listed competitions" on competition_team_rules for select
  using (exists (select 1 from competitions c where c.id = competition_id and c.listed));
-- extraction_reviews has no policy: only the crawler (service role) and admins see it
