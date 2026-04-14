
-- ===============================================================
-- FIX STORAGE BUCKETS AND POLICIES
-- ===============================================================
-- This script creates the necessary storage buckets and sets up
-- Row Level Security (RLS) policies for them.
-- Run this in your Supabase SQL Editor.

-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Set up RLS Policies for the 'avatars' bucket

-- Allow public access to view files (required for logos and profile pics)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
);

-- Allow users to update their own files (or any file if they are Admin)
DROP POLICY IF EXISTS "User Update Access" ON storage.objects;
CREATE POLICY "User Update Access" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'avatars' AND 
    (auth.uid() = owner OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    ))
);

-- Allow users to delete their own files (or any file if they are Admin)
DROP POLICY IF EXISTS "User Delete Access" ON storage.objects;
CREATE POLICY "User Delete Access" ON storage.objects
FOR DELETE USING (
    bucket_id = 'avatars' AND 
    (auth.uid() = owner OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    ))
);
