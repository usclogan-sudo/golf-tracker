-- Phase 4: Registered Users as Players + Profile Fields
-- Run this migration in Supabase SQL Editor after Phase 3 is deployed.

-- ─── 1. Add profile fields to user_profiles ──────────────────────────────────

ALTER TABLE user_profiles ADD COLUMN display_name text;
ALTER TABLE user_profiles ADD COLUMN handicap_index float;
ALTER TABLE user_profiles ADD COLUMN tee text NOT NULL DEFAULT 'White';

-- ─── 2. Open SELECT RLS so all authenticated users can see each other ────────

DROP POLICY "own profile read" ON user_profiles;
CREATE POLICY "public profile read" ON user_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
