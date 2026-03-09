-- Fore Skins Golf · Supabase Schema
-- Run this in the Supabase SQL editor (supabase.com → project → SQL editor)

-- ── courses ───────────────────────────────────────────────────────────────────
create table courses (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  tees jsonb not null,
  holes jsonb not null,
  hidden boolean not null default false,
  created_at timestamptz default now()
);
alter table courses enable row level security;
create policy "own data" on courses using (auth.uid() = user_id);
create index on courses (user_id, name);

-- ── players ───────────────────────────────────────────────────────────────────
create table players (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  handicap_index float not null,
  tee text not null,
  ghin_number text,
  venmo_username text,
  created_at timestamptz default now()
);
alter table players enable row level security;
create policy "own data" on players using (auth.uid() = user_id);
create index on players (user_id, name);

-- ── rounds ────────────────────────────────────────────────────────────────────
create table rounds (
  id text primary key,
  user_id uuid references auth.users not null,
  course_id text not null,
  date timestamptz not null,
  status text not null,
  current_hole int not null default 1,
  course_snapshot jsonb,
  game jsonb,
  treasurer_player_id text,
  players jsonb
);
alter table rounds enable row level security;
create policy "own data" on rounds using (auth.uid() = user_id);
create index on rounds (user_id, status);

-- ── round_players ─────────────────────────────────────────────────────────────
create table round_players (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  player_id text not null,
  tee_played text not null,
  course_handicap float,
  playing_handicap float
);
alter table round_players enable row level security;
create policy "own data" on round_players using (auth.uid() = user_id);
create index on round_players (round_id);

-- ── hole_scores ───────────────────────────────────────────────────────────────
create table hole_scores (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  player_id text not null,
  hole_number int not null,
  gross_score int not null
);
alter table hole_scores enable row level security;
create policy "own data" on hole_scores using (auth.uid() = user_id);
create index on hole_scores (round_id);

-- ── buy_ins ───────────────────────────────────────────────────────────────────
create table buy_ins (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  player_id text not null,
  amount_cents int not null,
  method text,
  status text not null,
  paid_at timestamptz
);
alter table buy_ins enable row level security;
create policy "own data" on buy_ins using (auth.uid() = user_id);
create index on buy_ins (round_id);

-- ── bbb_points ────────────────────────────────────────────────────────────────
create table bbb_points (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  hole_number int not null,
  bingo text,
  bango text,
  bongo text
);
alter table bbb_points enable row level security;
create policy "own data" on bbb_points using (auth.uid() = user_id);
create index on bbb_points (round_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 1 Migration (run in Supabase SQL Editor if tables already exist)
-- ══════════════════════════════════════════════════════════════════════════════

-- GHIN number required
-- ALTER TABLE players ALTER COLUMN ghin_number SET NOT NULL;
-- ALTER TABLE players ALTER COLUMN ghin_number SET DEFAULT '';

-- Payment method columns
-- ALTER TABLE players ADD COLUMN zelle_identifier text;
-- ALTER TABLE players ADD COLUMN cashapp_username text;
-- ALTER TABLE players ADD COLUMN paypal_email text;

-- Re-enable RLS (if disabled during development)
-- ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE round_players ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hole_scores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE buy_ins ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bbb_points ENABLE ROW LEVEL SECURITY;
