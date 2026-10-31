-- Accounts (draft for sign-up). Supabase Auth owns auth.users; these tables
-- hold the profile, split in two:
--   profiles         visible from the start (any signed-in user can read)
--   profile_sealed   real name, title, school, company, contact
--                    readable only by the owner, or by someone the owner
--                    popped the seal with, AND who popped it back (both sides)
-- The check happens in the database, so the website cannot leak it.

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  alias      text not null check (length(alias) between 1 and 40),
  field      text not null,
  field2     text,
  city       text not null default '',
  meet       text not null default 'both' check (meet in ('online', 'inperson', 'both')),
  curious    text[] not null default '{}',
  fun        text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists profile_sealed (
  id           uuid primary key references profiles(id) on delete cascade,
  real_name    text not null default '',
  job_title    text not null default '',
  school       text not null default '',
  company      text not null default '',
  contact_type text not null default 'instagram' check (contact_type in ('instagram', 'linkedin', 'other')),
  contact      text not null default ''
);

-- "I pop the seal for you". Sealed details open only when both rows exist.
create table if not exists seal_pops (
  from_user  uuid not null references profiles(id) on delete cascade,
  to_user    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  check (from_user <> to_user)
);

alter table profiles enable row level security;
alter table profile_sealed enable row level security;
alter table seal_pops enable row level security;

drop policy if exists "signed-in users read profiles" on profiles;
create policy "signed-in users read profiles" on profiles for select to authenticated using (true);
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own sealed details" on profile_sealed;
create policy "own sealed details" on profile_sealed for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "sealed details after both pop" on profile_sealed;
create policy "sealed details after both pop" on profile_sealed for select to authenticated using (
  exists (select 1 from seal_pops a join seal_pops b on b.from_user = a.to_user and b.to_user = a.from_user
          where a.from_user = auth.uid() and a.to_user = profile_sealed.id)
);

drop policy if exists "pop the seal yourself" on seal_pops;
create policy "pop the seal yourself" on seal_pops for insert to authenticated with check (from_user = auth.uid());
drop policy if exists "see pops that involve you" on seal_pops;
create policy "see pops that involve you" on seal_pops for select to authenticated using (auth.uid() in (from_user, to_user));
-- TODO with chats on the server: only allow a pop once the chat has reached half sugar.
