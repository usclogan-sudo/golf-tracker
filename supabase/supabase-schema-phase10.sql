-- Fore Skins Golf · Phase 10: Settlements
-- Run this in the Supabase SQL editor

-- ── settlements ──────────────────────────────────────────────────────────────
create table settlements (
  id text primary key,
  user_id uuid references auth.users not null,
  round_id text not null,
  from_player_id text not null,
  to_player_id text not null,
  amount_cents int not null,
  reason text,
  source text not null default 'game',   -- 'game' | 'junk'
  status text not null default 'owed',   -- 'owed' | 'paid'
  paid_at timestamptz
);

alter table settlements enable row level security;
create policy "own data" on settlements using (auth.uid() = user_id);
create index on settlements (round_id);
create index on settlements (user_id);
