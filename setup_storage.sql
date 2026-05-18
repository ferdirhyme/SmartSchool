-- Run this script in your Supabase SQL Editor to configure the storage bucket

-- 1. Create the 'attachments' bucket and make it public
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Drop existing policies to avoid conflicts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Authenticated users can update" on storage.objects;
drop policy if exists "Authenticated users can delete" on storage.objects;

-- 2. Allow public read access to uploaded files
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'attachments' );

-- 3. Allow authenticated users to upload files
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'attachments' );

-- 4. Allow authenticated users to update files
create policy "Authenticated users can update"
on storage.objects for update
to authenticated
with check ( bucket_id = 'attachments' );

-- 5. Allow authenticated users to delete files
create policy "Authenticated users can delete"
on storage.objects for delete
to authenticated
using ( bucket_id = 'attachments' );
