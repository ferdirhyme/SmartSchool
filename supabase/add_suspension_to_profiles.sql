-- Add is_suspended column to profiles table
-- Run this in your Supabase SQL Editor
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- Ensure RLS allows admins to see and update this column
-- (This is usually covered by existing admin policies, but good to have as a reminder)
COMMENT ON COLUMN public.profiles.is_suspended IS 'Flag to indicate if a user account is suspended by a Super Admin.';
