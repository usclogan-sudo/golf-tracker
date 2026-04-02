-- Prop Bets schema (v1)
-- Run in Supabase SQL Editor

-- prop_bets
create table if not exists prop_bets (
  id text primary key,
  round_id text references rounds(id) on delete cascade,
  creator_id text not null references players(id),
  user_id uuid not null references auth.users(id),
  title text not null,
  description text,
  category text not null check (category in ('quick','skill','h2h')),
  wager_model text not null check (wager_model in ('challenge','pool','fixed')),
  stake_cents int not null default 500,
  outcomes jsonb not null default '[]',
  resolve_type text not null check (resolve_type in ('auto','manual')),
  auto_resolve_config jsonb,
  target_player_id text references players(id),
  status text not null default 'open' check (status in ('open','locked','resolved','voided')),
  winning_outcome_id text,
  locks_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  hole_number int
);

alter table prop_bets enable row level security;
create policy "Users manage own prop_bets" on prop_bets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- prop_wagers
create table if not exists prop_wagers (
  id text primary key,
  prop_bet_id text not null references prop_bets(id) on delete cascade,
  round_id text references rounds(id) on delete cascade,
  player_id text not null references players(id),
  user_id uuid not null references auth.users(id),
  outcome_id text not null,
  amount_cents int not null,
  created_at timestamptz not null default now()
);

alter table prop_wagers enable row level security;
create policy "Users manage own prop_wagers" on prop_wagers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
