-- Phase 8: Game master, pinned friends, avatar storage
-- Run this migration against your Supabase project

-- Game master on rounds
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS game_master_id text;

-- Pinned friends
CREATE TABLE IF NOT EXISTS pinned_friends (
  user_id uuid REFERENCES auth.users NOT NULL,
  friend_user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id)
);
ALTER TABLE pinned_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pins" ON pinned_friends FOR ALL USING (auth.uid() = user_id);

-- Avatar storage bucket (public read, owner write)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT DO NOTHING;
CREATE POLICY "avatar_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatar_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatar_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
