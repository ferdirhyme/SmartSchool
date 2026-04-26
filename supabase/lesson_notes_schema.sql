-- Lesson Notes Table
CREATE TABLE IF NOT EXISTS lesson_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    week_ending DATE NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    strand TEXT NOT NULL,
    sub_strand TEXT,
    reference TEXT,
    rpk TEXT,
    core_competencies TEXT[],
    learning_indicators TEXT NOT NULL,
    tlms TEXT[],
    introduction TEXT,
    presentation_steps JSONB NOT NULL DEFAULT '[]',
    conclusion TEXT,
    evaluation TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    headteacher_remarks TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Teachers can manage own lesson notes" ON lesson_notes;
CREATE POLICY "Teachers can manage own lesson notes" ON lesson_notes
    FOR ALL USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Headteachers can view and update school lesson notes" ON lesson_notes;
CREATE POLICY "Headteachers can view and update school lesson notes" ON lesson_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Headteacher'
            AND profiles.school_id = lesson_notes.school_id
        )
    );

DROP POLICY IF EXISTS "Admins can view all lesson notes" ON lesson_notes;
CREATE POLICY "Admins can view all lesson notes" ON lesson_notes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );
