-- Phase 7: Payment info + avatar on user_profiles

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS venmo_username text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zelle_identifier text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cashapp_username text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS paypal_email text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_payment text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_preset text;

-- Create avatars storage bucket (run separately in Supabase dashboard or via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
