-- Categories, and every listing in English and Chinese (written by the LLM).
--   competitions.category   one of the categories below
--   competitions.i18n       {"en": {name, organizer, summary, eligibility, tags}, "zh": {...}}
--   team rules              the track name and the quote, translated

alter table competitions add column if not exists category text not null default 'other'
  check (category in ('hackathon', 'tech', 'startup', 'design', 'film_photo', 'writing', 'art', 'performance',
                      'science', 'social_impact', 'sports', 'other'));
alter table competitions add column if not exists i18n jsonb not null default '{}'::jsonb;
create index if not exists competitions_category on competitions (category) where listed;

alter table competition_team_rules add column if not exists track_en text;
alter table competition_team_rules add column if not exists track_zh text;
alter table competition_team_rules add column if not exists evidence_en text;
alter table competition_team_rules add column if not exists evidence_zh text;
alter table competition_team_rules add column if not exists unlimited boolean not null default false;

-- Make the new columns visible to the website right away
notify pgrst, 'reload schema';
