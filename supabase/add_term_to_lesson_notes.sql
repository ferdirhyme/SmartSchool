
-- Add term column to lesson_notes table
ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS term TEXT;
