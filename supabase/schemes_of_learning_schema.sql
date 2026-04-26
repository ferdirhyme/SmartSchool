
-- Schemes of Learning Table
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

-- Enable RLS
ALTER TABLE schemes_of_learning ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Teachers can manage own schemes" ON schemes_of_learning;
CREATE POLICY "Teachers can manage own schemes" ON schemes_of_learning
    FOR ALL USING (teacher_id = auth.uid());

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

DROP POLICY IF EXISTS "Admins can view all schemes" ON schemes_of_learning;
CREATE POLICY "Admins can view all schemes" ON schemes_of_learning
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );
