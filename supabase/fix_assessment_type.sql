
-- Fix for missing assessment_type and mock_tag columns
-- This script adds the columns and updates the unique constraint

-- 1. Add columns if they don't exist
ALTER TABLE public.student_assessments ADD COLUMN IF NOT EXISTS assessment_type TEXT DEFAULT 'Regular';
ALTER TABLE public.student_assessments ADD COLUMN IF NOT EXISTS mock_tag TEXT DEFAULT 'N/A';

-- 2. Update existing rows to have default values (if any were null)
UPDATE public.student_assessments SET assessment_type = 'Regular' WHERE assessment_type IS NULL;
UPDATE public.student_assessments SET mock_tag = 'N/A' WHERE mock_tag IS NULL;

-- 3. Correct the unique constraint to include these new columns
-- This is critical for UPSERT operations used in the Assessment page
DO $$ 
BEGIN
    -- Drop old constraints if they exist
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_unique_entry;
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_school_unique;
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_composite_key;

    -- Add the new comprehensive unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_assessments_full_composite_key') THEN
        ALTER TABLE public.student_assessments 
        ADD CONSTRAINT student_assessments_full_composite_key 
        UNIQUE (school_id, student_id, class_id, subject_id, term, year, assessment_type, mock_tag);
    END IF;
END $$;

-- 4. Ensure RLS is updated (just in case)
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;
