-- Phase 3: Admin, Onboarding, Shared Players, Play Again
-- Run this migration in Supabase SQL Editor after Phase 2 is deployed.

-- ─── 1a. user_profiles ──────────────────────────────────────────────────────────

create table user_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  is_admin boolean not null default false,
  onboarding_complete boolean not null default false,
  created_at timestamptz default now()
);
alter table user_profiles enable row level security;
create policy "own profile read" on user_profiles for select using (auth.uid() = user_id);
create policy "own profile update" on user_profiles for update using (auth.uid() = user_id);
create policy "own profile insert" on user_profiles for insert with check (auth.uid() = user_id);

-- ─── 1b. shared_courses ─────────────────────────────────────────────────────────

create table shared_courses (
  id text primary key,
  created_by uuid references auth.users not null,
  name text not null,
  tees jsonb not null,
  holes jsonb not null,
  created_at timestamptz default now()
);
alter table shared_courses enable row level security;
create policy "all read" on shared_courses for select using (auth.uid() is not null);
create policy "admin insert" on shared_courses for insert
  with check (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));
create policy "admin update" on shared_courses for update
  using (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));
create policy "admin delete" on shared_courses for delete
  using (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));

-- ─── 1c. game_presets ────────────────────────────────────────────────────────────

create table game_presets (
  id text primary key,
  created_by uuid references auth.users not null,
  name text not null,
  game_type text not null,
  buy_in_cents int not null,
  stakes_mode text not null default 'standard',
  config jsonb not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);
alter table game_presets enable row level security;
create policy "all read" on game_presets for select using (auth.uid() is not null);
create policy "admin insert" on game_presets for insert
  with check (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));
create policy "admin update" on game_presets for update
  using (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));
create policy "admin delete" on game_presets for delete
  using (exists (select 1 from user_profiles where user_id = auth.uid() and is_admin));

-- ─── 1d. Alter players — add is_public, split RLS ──────────────────────────────

alter table players add column is_public boolean not null default false;
drop policy "own data" on players;
create policy "own or public select" on players for select using (auth.uid() = user_id or is_public = true);
create policy "own insert" on players for insert with check (auth.uid() = user_id);
create policy "own update" on players for update using (auth.uid() = user_id);
create policy "own delete" on players for delete using (auth.uid() = user_id);

-- ─── Admin user setup (run manually) ────────────────────────────────────────────
-- insert into user_profiles (user_id, is_admin) values ('<your-uuid>', true);
