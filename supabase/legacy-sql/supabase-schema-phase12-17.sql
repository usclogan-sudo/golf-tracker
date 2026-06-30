-- ═══════════════════════════════════════════════════════════════════════════════
-- Fore Skins — Phase 12–17 Schema Additions
-- Run against your Supabase project after supabase-schema.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- Phase 12: Dark Mode — No DB changes (localStorage only)

-- Phase 13: Handicap Chart — No DB changes (computed client-side)

-- Phase 14: Promote API Course Search — No DB changes (UI restructure only)

-- ─── Phase 15: Notifications ──────────────────────────────────────────────────

create table if not exists notifications (
  id text primary key,
  user_id uuid references auth.users not null,
  type text not null,        -- 'unsettled_round' | 'score_update' | 'round_invite' | 'round_complete'
  title text not null,
  body text,
  round_id text,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

create policy "Users can manage own notifications"
  on notifications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Phase 16: Side Bets ─────────────────────────────────────────────────────

create table if not exists side_bets (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  hole_number int not null,
  description text not null,
  amount_cents int not null,
  participants jsonb not null,       -- ["playerId1", "playerId2"]
  winner_player_id text,
  status text not null default 'open', -- 'open' | 'resolved' | 'cancelled'
  created_at timestamptz default now()
);

alter table side_bets enable row level security;

create policy "Users can manage own side bets"
  on side_bets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Phase 17: Tournaments ───────────────────────────────────────────────────

create table if not exists tournaments (
  id text primary key,
  user_id uuid references auth.users not null,
  name text not null,
  format text not null,            -- 'match_play_single' | 'match_play_double' | 'stroke_play'
  status text not null default 'setup',
  course_id text,
  course_snapshot jsonb,
  player_ids jsonb not null,
  config jsonb,                    -- handicap mode, rounds count, buy-in
  created_at timestamptz default now()
);

alter table tournaments enable row level security;

create policy "Users can manage own tournaments"
  on tournaments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists tournament_rounds (
  id text primary key,
  user_id uuid references auth.users not null,
  tournament_id text not null,
  round_id text,                   -- links to existing rounds table
  round_number int not null,
  bracket_round int,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table tournament_rounds enable row level security;

create policy "Users can manage own tournament rounds"
  on tournament_rounds
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists tournament_matchups (
  id text primary key,
  user_id uuid references auth.users not null,
  tournament_id text not null,
  tournament_round_id text,
  bracket_round int not null,
  match_number int not null,
  player_a_id text,
  player_b_id text,
  winner_id text,
  loser_bracket boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table tournament_matchups enable row level security;

create policy "Users can manage own tournament matchups"
  on tournament_matchups
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Enable Realtime for new tables ──────────────────────────────────────────

alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table side_bets;
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table tournament_rounds;
alter publication supabase_realtime add table tournament_matchups;
