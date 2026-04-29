
-- ==========================================
-- FINAL RPC & LOGIC FIX
-- ==========================================

-- 1. RE-ESTABLISH THE RPC WITH SECURITY DEFINER AND ERROR HANDLING
CREATE OR REPLACE FUNCTION public.get_teacher_id_by_auth_email()
RETURNS uuid AS $$
DECLARE
    v_teacher_id uuid;
    v_email text;
BEGIN
    -- Get the email of the currently authenticated user from JWT
    v_email := (auth.jwt() ->> 'email');
    
    IF v_email IS NULL OR v_email = '' THEN
        RETURN NULL;
    END IF;
    
    -- Find the teacher with this email in the public.teachers table
    -- Use SECURITY DEFINER to bypass RLS if necessary for this lookup
    SELECT id INTO v_teacher_id 
    FROM public.teachers 
    WHERE email = v_email
    LIMIT 1;
    
    RETURN v_teacher_id;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. ENSURE PROFILES TABLE HAS EMAIL (Handy for lookups)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. UPDATE PROFILES WITH EMAIL FROM AUTH.USERS IF POSIBLE
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
