
-- ==========================================================
-- DEFINITIVE DATABASE FIX: RLS RECURSION & TEACHER CONSTRAINT
-- ==========================================================
-- This script fixes two critical issues:
-- 1. Infinite recursion in profiles RLS policies
-- 2. Missing UNIQUE constraint on teachers(email) for upserts

-- 1. FIX TEACHERS TABLE CONSTRAINTS
DO $$ 
BEGIN
    -- Ensure UNIQUE(email) exists on teachers table for .upsert(..., { onConflict: 'email' })
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teachers_email_key'
    ) THEN
        ALTER TABLE public.teachers ADD CONSTRAINT teachers_email_key UNIQUE (email);
    END IF;
    
    -- Optional but recommended: profiles email unique constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
END $$;

-- 2. FIX RLS RECURSION IN PROFILES
-- We MUST use SECURITY DEFINER functions to check roles to avoid recursion.

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

-- 3. RESET POLICIES FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Own profile access" ON public.profiles;
DROP POLICY IF EXISTS "School profile view" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
DROP POLICY IF EXISTS "School members can view each other" ON public.profiles;

-- NEW RECURSION-FREE POLICIES

-- Users can always see and edit their own record
CREATE POLICY "Profiles: Users can manage own" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- School members can view others in their school (using helper function)
CREATE POLICY "Profiles: School members view each other" ON public.profiles
    FOR SELECT USING (
        school_id = public.get_my_school_id()
    );

-- Headteachers can update profiles in their school (using helper function for role check)
CREATE POLICY "Profiles: Headteachers manage school" ON public.profiles
    FOR UPDATE USING (
        public.is_headteacher() AND school_id = public.get_my_school_id()
    )
    WITH CHECK (
        public.is_headteacher() AND school_id = public.get_my_school_id()
    );

-- Admins bypass everything
CREATE POLICY "Profiles: Admins manage all" ON public.profiles
    FOR ALL USING (
        public.is_admin()
    );

-- 4. GRANT PERMISSIONS
GRANT ALL ON TABLE public.profiles TO authenticated, service_role;
GRANT ALL ON TABLE public.teachers TO authenticated, service_role;

-- 5. VERIFY OTHER RECENT MESSAGING FIXES (Safety Check)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.messages TO authenticated, service_role;
GRANT ALL ON TABLE public.conversations TO authenticated, service_role;
