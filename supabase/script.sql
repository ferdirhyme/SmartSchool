
-- ===============================================================
-- SMART SCHOOL - AI LESSON PLANNING & SCHEMES OF LEARNING SCHEMA
-- ===============================================================

-- 1. Update Lesson Notes Table
ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE lesson_notes ADD COLUMN IF NOT EXISTS term TEXT;

-- 2. Create Schemes of Learning Table
CREATE TABLE IF NOT EXISTS schemes_of_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    scheme JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update Lesson Notes Table (if already exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_notes' AND column_name='topic') THEN
        ALTER TABLE lesson_notes RENAME COLUMN topic TO strand;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_notes' AND column_name='sub_topic') THEN
        ALTER TABLE lesson_notes RENAME COLUMN sub_topic TO sub_strand;
    END IF;
END $$;

-- 3. Enable RLS for Schemes of Learning
ALTER TABLE schemes_of_learning ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Schemes of Learning

-- Teachers can manage their own schemes
DROP POLICY IF EXISTS "Teachers can manage own schemes" ON schemes_of_learning;
CREATE POLICY "Teachers can manage own schemes" ON schemes_of_learning
    FOR ALL USING (teacher_id = auth.uid());

-- Headteachers can view schemes in their school
DROP POLICY IF EXISTS "Headteachers can view school schemes" ON schemes_of_learning;
CREATE POLICY "Headteachers can view school schemes" ON schemes_of_learning
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Headteacher'
            AND profiles.school_id = schemes_of_learning.school_id
        )
    );

-- Admins can view all schemes
DROP POLICY IF EXISTS "Admins can view all schemes" ON schemes_of_learning;
CREATE POLICY "Admins can view all schemes" ON schemes_of_learning
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );

-- ===============================================================
-- END OF SCHEMA SCRIPT
-- ===============================================================
