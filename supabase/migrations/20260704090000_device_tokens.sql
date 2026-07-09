-- Native push delivery: store per-device push tokens so the backend can send
-- native pushes (invites, settlement nudges, scorekeeper approvals) via FCM/APNs.
-- The device registers its token from src/lib/native.ts (initPush); the send-push
-- Edge Function reads these rows (service role) to deliver.

begin;

create table public.device_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.device_tokens enable row level security;

-- A user manages only their own device tokens; the Edge Function uses the service
-- role (bypasses RLS) to read all tokens for a target user when sending.
create policy "manage own device tokens" on public.device_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_device_tokens_user on public.device_tokens (user_id);

commit;
