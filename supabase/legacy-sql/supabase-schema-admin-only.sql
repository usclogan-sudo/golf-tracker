-- Migration: Add admin_only column to user_profiles
-- Run this in the Supabase SQL Editor

ALTER TABLE user_profiles ADD COLUMN admin_only boolean NOT NULL DEFAULT false;
