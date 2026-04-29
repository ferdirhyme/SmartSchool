
-- ==========================================
-- FINAL RPC & LOGIC FIX V4 (Ultra-Stable)
-- ==========================================

-- 1. RE-ESTABLISH THE RPC WITH SIMPLEST POSSIBLE SYNTAX
-- This avoids variables and "INTO" keyword which can confuse some parsers/environments
CREATE OR REPLACE FUNCTION public.get_teacher_id_by_auth_email()
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT id 
        FROM public.teachers 
        WHERE email = (auth.jwt() ->> 'email')
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. ENSURE PROFILES TABLE HAS EMAIL (Handy for lookups)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. UPDATE PROFILES WITH EMAIL FROM AUTH.USERS IF POSIBLE
-- Using a safe block
DO $$ 
BEGIN
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND p.email IS NULL;
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- 4. FIX RLS FOR TEACHER ATTENDANCE (Common issue)
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own attendance" ON public.teacher_attendance;
CREATE POLICY "Users can view own attendance" ON public.teacher_attendance
    FOR SELECT USING (
        teacher_id IN (
            SELECT id FROM public.teachers WHERE email = (auth.jwt() ->> 'email')
        ) OR public.is_admin()
    );

-- 5. ENSURE UNIQUE CONSTRAINT FOR TEACHERS
-- This is critical for onboarding upserts to work
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_email_key') THEN
        ALTER TABLE public.teachers ADD CONSTRAINT teachers_email_key UNIQUE (email);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
