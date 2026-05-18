-- Definitive Fix for Teacher Attendance Logic and Security

-- 1. Improved get_my_school_id to handle cases where profile.school_id is not yet set
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
BEGIN
    -- Try direct profile lookup
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();
    
    -- Fallback for teachers: check teachers table by email
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id 
        FROM public.teachers 
        WHERE email = (auth.jwt() ->> 'email')
        LIMIT 1;
    END IF;
    
    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Ensure composite unique key for upserts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_attendance_teacher_date_unique') THEN
        ALTER TABLE public.teacher_attendance ADD CONSTRAINT teacher_attendance_teacher_date_unique UNIQUE (teacher_id, attendance_date);
    END IF;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- 3. Drop all previous attendance policies and cleanup
DROP POLICY IF EXISTS "School data access" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teacher check in access" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers manage school data" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teacher attendance select" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teacher attendance insert" ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teacher attendance update" ON public.teacher_attendance;

-- 4. Create Identity-based rules (Email Handshake)
-- SELECT policy: Users can see their own attendance or headteachers/admins can see school attendance
CREATE POLICY "Teacher attendance select" ON public.teacher_attendance
    FOR SELECT USING (
        teacher_id IN (SELECT id FROM public.teachers WHERE email = auth.jwt()->>'email')
        OR school_id = public.get_my_school_id()
        OR public.is_admin()
    );

-- INSERT policy: Teachers can record arrival
CREATE POLICY "Teacher attendance insert" ON public.teacher_attendance
    FOR INSERT WITH CHECK (
        teacher_id IN (SELECT id FROM public.teachers WHERE email = auth.jwt()->>'email')
    );

-- UPDATE policy: Teachers can record departure
CREATE POLICY "Teacher attendance update" ON public.teacher_attendance
    FOR UPDATE USING (
        teacher_id IN (SELECT id FROM public.teachers WHERE email = auth.jwt()->>'email')
    );

-- 5. Self-Healing Link: Update profiles.school_id if it's missing but we know it from the teachers table
UPDATE public.profiles p
SET school_id = t.school_id
FROM public.teachers t
WHERE p.email = t.email AND p.school_id IS NULL;
