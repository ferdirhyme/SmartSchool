-- Create a helper function to check if the current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Admin Policies for Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
CREATE POLICY "Admins can delete all profiles" ON public.profiles
    FOR DELETE USING (public.is_admin());

-- 2. Policies for Schools
DROP POLICY IF EXISTS "Anyone can view schools" ON public.schools;
CREATE POLICY "Anyone can view schools" ON public.schools
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert schools" ON public.schools;
CREATE POLICY "Admins can insert schools" ON public.schools
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update schools" ON public.schools;
CREATE POLICY "Admins can update schools" ON public.schools
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete schools" ON public.schools;
CREATE POLICY "Admins can delete schools" ON public.schools
    FOR DELETE USING (public.is_admin());

-- 3. Admin Policies for Teachers
DROP POLICY IF EXISTS "Admins can view all teachers" ON public.teachers;
CREATE POLICY "Admins can view all teachers" ON public.teachers
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all teachers" ON public.teachers;
CREATE POLICY "Admins can update all teachers" ON public.teachers
    FOR UPDATE USING (public.is_admin());
