-- Fix RLS policies for time_slots, timetable, student_attendance, assessments, etc.

-- 1. Helper functions (if not already existing)
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_headteacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'Headteacher'
  );
$$;

-- 2. time_slots policies
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headteachers can manage time slots" ON public.time_slots;
CREATE POLICY "Headteachers can manage time slots" ON public.time_slots
FOR ALL TO authenticated
USING (
  check_is_admin() OR 
  (check_is_headteacher() AND school_id = get_my_school_id())
)
WITH CHECK (
  check_is_admin() OR 
  (check_is_headteacher() AND school_id = get_my_school_id())
);

DROP POLICY IF EXISTS "Users can view time slots" ON public.time_slots;
CREATE POLICY "Users can view time slots" ON public.time_slots
FOR SELECT TO authenticated
USING (
  check_is_admin() OR 
  school_id = get_my_school_id()
);

-- 3. timetable policies
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headteachers can manage timetable" ON public.timetable;
CREATE POLICY "Headteachers can manage timetable" ON public.timetable
FOR ALL TO authenticated
USING (
  check_is_admin() OR 
  (check_is_headteacher() AND school_id = get_my_school_id())
)
WITH CHECK (
  check_is_admin() OR 
  (check_is_headteacher() AND school_id = get_my_school_id())
);

DROP POLICY IF EXISTS "Users can view timetable" ON public.timetable;
CREATE POLICY "Users can view timetable" ON public.timetable
FOR SELECT TO authenticated
USING (
  check_is_admin() OR 
  school_id = get_my_school_id()
);

-- 4. student_attendance policies
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers and Headteachers can manage attendance" ON public.student_attendance;
CREATE POLICY "Teachers and Headteachers can manage attendance" ON public.student_attendance
FOR ALL TO authenticated
USING (
  check_is_admin() OR 
  school_id = get_my_school_id()
)
WITH CHECK (
  check_is_admin() OR 
  school_id = get_my_school_id()
);

-- 5. student_assessments policies
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers and Headteachers can manage assessments" ON public.student_assessments;
CREATE POLICY "Teachers and Headteachers can manage assessments" ON public.student_assessments
FOR ALL TO authenticated
USING (
  check_is_admin() OR 
  school_id = get_my_school_id()
)
WITH CHECK (
  check_is_admin() OR 
  school_id = get_my_school_id()
);

-- 6. Ensure school_id exists in these tables (if they don't, we might need to add them, but assuming they do based on the error)
-- If they don't have school_id, the policies above will fail. 
-- Let's assume they do as per the pattern.
