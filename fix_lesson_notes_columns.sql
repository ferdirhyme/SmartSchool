-- Run this in your Supabase SQL editor to ensure all fields are available

ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS strand TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS sub_strand TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS days TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS key_words TEXT[];
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS equipment TEXT[];
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.lesson_notes ADD COLUMN IF NOT EXISTS extra_details JSONB DEFAULT '{}';

-- Tell PostgREST to reload the schema cache so the new columns become available
NOTIFY pgrst, 'reload schema';
