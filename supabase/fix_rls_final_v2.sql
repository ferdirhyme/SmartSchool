
-- ==========================================================
-- FINAL DATABASE FIX V2: FIXING HEADTEACHER AUTHORIZATION
-- ==========================================================
-- This script fixes the issue where Headteachers cannot authorize teachers
-- because RLS prevents them from seeing/updating records with NULL school_id.

-- 1. RE-ESTABLISH RECURSION-FREE HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid AS $$
BEGIN
    RETURN (SELECT school_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_headteacher()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Headteacher'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. FIX PROFILES TABLE POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Profiles: Users manage own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Viewable" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Manageable" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "School members can view each other" ON public.profiles;
DROP POLICY IF EXISTS "Headteachers can manage school staff" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their school" ON public.profiles;
DROP POLICY IF EXISTS "Headteachers can update profiles in their school" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: School members view each other" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Headteachers manage school" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Users can manage own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Admins manage all" ON public.profiles;

-- Users can always see and edit their own record
CREATE POLICY "Profiles: Users manage own" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Selection: School members view each other, OR headteachers view unassigned profiles
CREATE POLICY "Profiles: Viewable" ON public.profiles
    FOR SELECT USING (
        school_id = public.get_my_school_id() OR
        (public.is_headteacher() AND school_id IS NULL) OR
        public.is_admin()
    );

-- Update: Headteachers can authorize unassigned teachers OR manage their own
CREATE POLICY "Profiles: Manageable" ON public.profiles
    FOR UPDATE USING (
        (public.is_headteacher() AND (school_id = public.get_my_school_id() OR school_id IS NULL)) OR
        public.is_admin()
    )
    WITH CHECK (
        (public.is_headteacher() AND school_id = public.get_my_school_id()) OR
        public.is_admin()
    );

-- 3. FIX TEACHERS TABLE POLICIES
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Drop all possible existing policies for teachers
DROP POLICY IF EXISTS "Headteachers manage school data" ON public.teachers;
DROP POLICY IF EXISTS "Teachers view school data" ON public.teachers;
DROP POLICY IF EXISTS "Users view school data" ON public.teachers;
DROP POLICY IF EXISTS "Users view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers view own record" ON public.teachers;
DROP POLICY IF EXISTS "Teachers update own profile" ON public.teachers;
DROP POLICY IF EXISTS "Headteachers manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins can view all teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins can update all teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers: Viewable" ON public.teachers;
DROP POLICY IF EXISTS "Teachers: Manageable" ON public.teachers;

-- View: Everyone matching school, or headteachers viewing unassigned
CREATE POLICY "Teachers: Viewable" ON public.teachers
    FOR SELECT USING (
        school_id = public.get_my_school_id() OR
        (public.is_headteacher() AND school_id IS NULL) OR
        public.is_admin()
    );

-- Manage: Headteachers can claim unassigned teachers or manage their own
CREATE POLICY "Teachers: Manageable" ON public.teachers
    FOR ALL USING (
        (public.is_headteacher() AND (school_id = public.get_my_school_id() OR school_id IS NULL)) OR
        public.is_admin()
    )
    WITH CHECK (
        (public.is_headteacher() AND school_id = public.get_my_school_id()) OR
        public.is_admin()
    );

-- 4. ENSURE UNIQUE CONSTRAINT FOR UPSERTS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_email_key') THEN
        ALTER TABLE public.teachers ADD CONSTRAINT teachers_email_key UNIQUE (email);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.profiles TO authenticated, service_role;
GRANT ALL ON TABLE public.teachers TO authenticated, service_role;
