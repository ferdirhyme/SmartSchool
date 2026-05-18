
-- ===============================================================
-- FIX STORAGE BUCKETS AND POLICIES
-- ===============================================================
-- This script creates the necessary storage buckets and sets up
-- Row Level Security (RLS) policies for them.
-- Run this in your Supabase SQL Editor.

-- 1. Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

-- 2. Set up RLS Policies

-- Allow public access to view files
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id IN ('avatars', 'attachments'));

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id IN ('avatars', 'attachments') AND 
    auth.role() = 'authenticated'
);

-- Allow users to update their own files
DROP POLICY IF EXISTS "User Update Access" ON storage.objects;
CREATE POLICY "User Update Access" ON storage.objects
FOR UPDATE USING (
    bucket_id IN ('avatars', 'attachments') AND 
    (auth.uid() = owner OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    ))
);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "User Delete Access" ON storage.objects;
CREATE POLICY "User Delete Access" ON storage.objects
FOR DELETE USING (
    bucket_id IN ('avatars', 'attachments') AND 
    (auth.uid() = owner OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    ))
);
