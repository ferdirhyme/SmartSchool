
-- Migration to fix RLS for announcements table
-- This ensures teachers and other users can view announcements for their school.

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Headteachers manage school data" ON public.announcements;
DROP POLICY IF EXISTS "Teachers manage school data" ON public.announcements;
DROP POLICY IF EXISTS "Users view school data" ON public.announcements;

-- Policy: Headteachers have full access to their school's announcements
CREATE POLICY "Headteachers manage school data" ON public.announcements
FOR ALL USING (
    public.get_auth_role() = 'Headteacher' AND
    school_id = public.get_my_school_id()
);

-- Policy: Teachers can view and manage announcements (if they have permission, but at least view)
CREATE POLICY "Teachers manage school data" ON public.announcements
FOR ALL USING (
    public.get_auth_role() = 'Teacher' AND
    school_id = public.get_my_school_id()
);

-- Policy: Students/Parents can view their school's announcements
CREATE POLICY "Users view school data" ON public.announcements
FOR SELECT USING (
    school_id = public.get_my_school_id()
);

-- Grant permissions
GRANT ALL ON TABLE public.announcements TO authenticated, service_role;
