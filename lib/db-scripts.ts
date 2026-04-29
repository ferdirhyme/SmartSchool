
export const assessmentSqlScript = `
-- This script will completely erase all data in the student_assessments table.
-- Please back up your data before running this script if you need to preserve it.

-- Drop the existing table
DROP TABLE IF EXISTS public.student_assessments;

-- Recreate the table with the correct schema
CREATE TABLE public.student_assessments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    school_id uuid NOT NULL DEFAULT public.get_my_school_id() REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    term text NOT NULL,
    year integer NOT NULL,
    class_exercises numeric,
    class_tests numeric,
    project_work numeric,
    observation_attitude numeric,
    continuous_assessment_score numeric,
    exam_score numeric,
    total_score numeric,
    remarks text,
    CONSTRAINT student_assessments_pkey PRIMARY KEY (id),
    CONSTRAINT student_assessments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT student_assessments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    CONSTRAINT student_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT student_assessments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
    CONSTRAINT student_assessments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL,
    CONSTRAINT student_assessments_unique_entry UNIQUE (student_id, class_id, subject_id, term, year)
);

-- Enable Row Level Security
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;

-- Add policies for data access
-- Headteachers get full access
CREATE POLICY "Allow headteacher full access" ON public.student_assessments
FOR ALL USING (
  (public.get_auth_role() = 'Headteacher' AND school_id = public.get_my_school_id()) OR
  public.get_auth_role() = 'Admin'
);

-- Teachers can manage assessments for students in their assigned subjects (any class) or any subject in their homeroom class
CREATE POLICY "Allow teachers to manage assessments for their subjects and homeroom" ON public.student_assessments
FOR ALL USING (
  (
    public.get_auth_role() = 'Teacher' AND
    school_id = public.get_my_school_id() AND
    (
      -- Teacher is assigned to this subject
      EXISTS (
        SELECT 1 FROM public.teacher_subjects ts
        WHERE ts.teacher_id = (SELECT id FROM public.teachers WHERE email = (auth.jwt() ->> 'email')) 
        AND ts.subject_id = student_assessments.subject_id
      )
      OR
      -- Teacher is the homeroom teacher for this class
      EXISTS (
        SELECT 1 FROM public.teacher_classes tc
        WHERE tc.teacher_id = (SELECT id FROM public.teachers WHERE email = (auth.jwt() ->> 'email')) 
        AND tc.class_id = student_assessments.class_id
        AND tc.is_homeroom = TRUE
      )
    )
  ) OR public.get_auth_role() = 'Admin'
);

-- Students can view their own assessments by matching admission number
CREATE POLICY "Allow students to view their own assessments" ON public.student_assessments
FOR SELECT USING (
  (
    public.get_auth_role() = 'Student' AND
    school_id = public.get_my_school_id() AND
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_assessments.student_id AND
      s.admission_number = ANY(COALESCE((SELECT admission_numbers FROM public.profiles WHERE id = auth.uid()), ARRAY[]::text[]))
    )
  ) OR public.get_auth_role() = 'Admin'
);

-- Parents can view assessments of their linked children
CREATE POLICY "Allow parents to view their wards' assessments" ON public.student_assessments
FOR SELECT USING (
  (
    public.get_auth_role() = 'Parent' AND
    school_id = public.get_my_school_id() AND
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_assessments.student_id AND
      s.admission_number = ANY(COALESCE((SELECT admission_numbers FROM public.profiles WHERE id = auth.uid()), ARRAY[]::text[]))
    )
  ) OR public.get_auth_role() = 'Admin'
);

-- Grant necessary permissions to roles
GRANT ALL ON TABLE public.student_assessments TO authenticated, service_role;
`.trim();

export const ghanaianOptimizationSqlScript = `
-- Feature Set: Ghanaian School Optimization (v3 - Final Robust Fix)
-- Fixes position logic, mock analytics, and GES report dependencies.

-- 1. GES Report Columns
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS conduct TEXT;
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS interest TEXT;
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS attitude TEXT;
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS headteacher_remarks TEXT;
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS promotion_status TEXT;

-- 2. Mock Results Table (for BECE/WASSCE/Internal Mocks)
CREATE TABLE IF NOT EXISTS public.mock_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    mock_type TEXT NOT NULL, -- 'BECE Mock 1', 'WASSCE Mock 1', etc.
    score DECIMAL(5,2),
    grade TEXT,
    term TEXT,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, mock_type, term, year)
);

ALTER TABLE public.mock_assessments ENABLE ROW LEVEL SECURITY;

-- 3. Automatic Positions Function
CREATE OR REPLACE FUNCTION public.calculate_student_positions(p_class_id UUID, p_term TEXT, p_year INTEGER)
RETURNS VOID AS $$
BEGIN
    WITH StudentTotals AS (
        SELECT 
            student_id,
            SUM(total_score) as grand_total,
            RANK() OVER (ORDER BY SUM(total_score) DESC) as pos
        FROM public.student_assessments
        WHERE class_id = p_class_id AND term = p_term AND year = p_year
        GROUP BY student_id
    )
    UPDATE public.student_term_reports str
    SET position = st.pos
    FROM StudentTotals st
    WHERE str.student_id = st.student_id 
    AND str.class_id = p_class_id 
    AND str.term = p_term 
    AND str.year = p_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-enabling RLS on critical tables
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_term_reports ENABLE ROW LEVEL SECURITY;

-- 5. Fix for ON CONFLICT error: Ensure school_id is in the composite unique key
DO $$ 
BEGIN
    -- For Assessments
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_unique_entry;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_assessments_school_unique') THEN
        ALTER TABLE public.student_assessments ADD CONSTRAINT student_assessments_school_unique UNIQUE (school_id, student_id, class_id, subject_id, term, year);
    END IF;

    -- For Term Reports
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_term_reports_school_unique') THEN
        ALTER TABLE public.student_term_reports ADD CONSTRAINT student_term_reports_school_unique UNIQUE (school_id, student_id, class_id, term, year);
    END IF;
END $$;

-- Policies for Mock Assessments (Headteachers & Teachers can manage)
DROP POLICY IF EXISTS "Headteachers manage mock data" ON public.mock_assessments;
CREATE POLICY "Headteachers manage mock data" ON public.mock_assessments
FOR ALL USING (
    (public.get_auth_role() = 'Headteacher' AND school_id = public.get_my_school_id()) OR
    public.get_auth_role() = 'Admin'
);

DROP POLICY IF EXISTS "Teachers manage mock data" ON public.mock_assessments;
CREATE POLICY "Teachers manage mock data" ON public.mock_assessments
FOR ALL USING (
    (public.get_auth_role() = 'Teacher' AND school_id = public.get_my_school_id()) OR
    public.get_auth_role() = 'Admin'
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
`.trim();

export const helperFunctionsSqlScript = `
-- This script bundles several helper functions and schema updates to resolve common permission and lookup issues.
-- It is safe to run this script multiple times.

-- === Helper Function: Get Teacher ID by Authenticated Email ===
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

-- === Schema Update: Ensure Schools and School Settings tables exist ===
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('Admin', 'Headteacher', 'Teacher', 'Student', 'Parent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role public.user_role NOT NULL,
    school_id UUID,
    admission_numbers TEXT[],
    credit_balance DECIMAL(12,2) DEFAULT 0.00,
    is_onboarded BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure is_suspended column exists on existing installations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- Attempt to link profiles to auth.users if missing
DO $$ 
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), email, (COALESCE(raw_user_meta_data->>'role', 'Teacher'))::public.user_role
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        -- If we don't have permission to read auth.users, just skip
        NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    plan_id TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
    school_name TEXT NOT NULL,
    logo_url TEXT,
    theme TEXT DEFAULT 'light',
    motto TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    school_latitude DECIMAL(10,8),
    school_longitude DECIMAL(11,8),
    paystack_public_key TEXT,
    paystack_secret_key TEXT,
    currency TEXT DEFAULT 'GHS',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS current_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW());
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS current_term TEXT;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS term_start_date DATE;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS term_end_date DATE;

-- === Helper Function: Get user role without recursion ===
CREATE OR REPLACE FUNCTION public.execute_admin_sql(sql_script text)
RETURNS void AS $$
BEGIN
  IF public.get_auth_role() != 'Admin' THEN
    RAISE EXCEPTION 'Only Admins can execute system scripts.';
  END IF;
  EXECUTE sql_script;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role, 'Student');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- === Helper Function: Get user school_id with Parent/Admin fallback ===
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();
    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- === Schema Update: Multi-Tenancy Optimizations ===

-- Fix: Ensure student_assessments column type is correct
ALTER TABLE public.student_assessments ALTER COLUMN continuous_assessment_score TYPE decimal(5,2);
ALTER TABLE public.student_assessments ALTER COLUMN exam_score TYPE decimal(5,2);
ALTER TABLE public.student_assessments ALTER COLUMN total_score TYPE decimal(5,2);

-- Fix: Ensure student_term_reports has school_id
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Ensure school_id exists and is correctly typed on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;

-- === Profiles Table Constraints Fix ===
-- Ensure profiles unique constraint is correct
-- Note: id is already PRIMARY KEY, which is unique.

-- === Classes Table Constraints Fix ===
-- Ensure classes are unique per school, not globally
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_school_id_name_key') THEN
        ALTER TABLE public.classes ADD CONSTRAINT classes_school_id_name_key UNIQUE (school_id, name);
    END IF;
END $$;

-- === Link Tables Security Fix ===
-- Add school_id to link tables if missing to allow RLS
ALTER TABLE public.teacher_classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Populate school_id for existing rows from teachers table
UPDATE public.teacher_classes tc
SET school_id = t.school_id
FROM public.teachers t
WHERE tc.teacher_id = t.id AND tc.school_id IS NULL;

UPDATE public.teacher_subjects ts
SET school_id = t.school_id
FROM public.teachers t
WHERE ts.teacher_id = t.id AND ts.school_id IS NULL;

-- Populate school_id for student related tables
UPDATE public.student_attendance sa
SET school_id = s.school_id
FROM public.students s
WHERE sa.student_id = s.id AND sa.school_id IS NULL;

UPDATE public.student_assessments sa
SET school_id = s.school_id
FROM public.students s
WHERE sa.student_id = s.id AND sa.school_id IS NULL;

UPDATE public.student_term_reports str
SET school_id = s.school_id
FROM public.students s
WHERE str.student_id = s.id AND str.school_id IS NULL;

-- Ensure unique constraints include school_id for multi-tenancy upserts
-- These are wrapped to avoid "already exists" errors when running the script multiple times.
DO $$ 
BEGIN
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_student_id_class_id_subject_id_term_year_key;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_assessments_composite_key') THEN
        ALTER TABLE public.student_assessments ADD CONSTRAINT student_assessments_composite_key UNIQUE(school_id, student_id, class_id, subject_id, term, year);
    END IF;
    
    ALTER TABLE public.student_term_reports DROP CONSTRAINT IF EXISTS student_term_reports_student_id_term_year_key;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_term_reports_composite_key') THEN
        ALTER TABLE public.student_term_reports ADD CONSTRAINT student_term_reports_composite_key UNIQUE(school_id, student_id, class_id, term, year);
    END IF;

    ALTER TABLE public.student_attendance DROP CONSTRAINT IF EXISTS student_attendance_student_id_attendance_date_key;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_composite_key') THEN
        ALTER TABLE public.student_attendance ADD CONSTRAINT student_attendance_composite_key UNIQUE(school_id, student_id, attendance_date);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint error: %', SQLERRM;
END $$;
`.trim();

export const rlsPoliciesSqlScript = `
-- === Comprehensive RLS Policies for All Tables ===
-- This section ensures Headteachers and Teachers can manage their school's data.

-- 2. Define a list of tables that follow the school_id ownership pattern
DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'classes', 'subjects', 'students', 'teachers', 
        'student_attendance', 'student_assessments', 
        'announcements', 'fee_types', 'fee_payments',
        'time_slots', 'timetable', 'teacher_classes', 'teacher_subjects',
        'student_term_reports', 'teacher_attendance', 'expenses', 'scholarships'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Headteachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers view school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users view school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers manage their assigned assessments" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users view teachers" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers view own record" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers update own profile" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Headteachers manage teachers" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers can view colleagues and manage own profile" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers select school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers insert school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers update school data" ON public.%I', t);
        
        -- Policy: Headteachers have full access to their school's data
        -- Includes hardening: Ensure school_id cannot be spoofed on INSERT or modified on UPDATE
        EXECUTE format('
            CREATE POLICY "Headteachers manage school data" ON public.%I
            FOR ALL USING (
                (public.get_auth_role() = ''Headteacher'' AND school_id = public.get_my_school_id()) OR
                public.get_auth_role() = ''Admin''
            )
            WITH CHECK (
                (public.get_auth_role() = ''Headteacher'' AND school_id = public.get_my_school_id()) OR
                public.get_auth_role() = ''Admin''
            )
        ', t);

        -- Policy: Teachers manage school data
        -- Special handling for student_assessments and teachers
        IF t = 'student_assessments' THEN
            EXECUTE format('
                CREATE POLICY "Teachers manage their assigned assessments" ON public.student_assessments
                FOR ALL USING (
                    (
                        public.get_auth_role() = ''Teacher'' AND
                        school_id = public.get_my_school_id() AND
                        (
                            -- Teacher is assigned to this subject
                            EXISTS (
                                SELECT 1 FROM public.teacher_subjects ts
                                JOIN public.teachers tech ON tech.id = ts.teacher_id
                                WHERE tech.email = (auth.jwt() ->> ''email'')
                                AND ts.subject_id = student_assessments.subject_id
                            )
                            OR
                            -- Teacher is the homeroom teacher for this class (can manage all subjects)
                            EXISTS (
                                SELECT 1 FROM public.teacher_classes tc
                                JOIN public.teachers tech ON tech.id = tc.teacher_id
                                WHERE tech.email = (auth.jwt() ->> ''email'')
                                AND tc.class_id = student_assessments.class_id
                                AND tc.is_homeroom = TRUE
                            )
                        )
                    ) OR public.get_auth_role() = ''Admin''
                )
                WITH CHECK (
                    (
                        public.get_auth_role() = ''Teacher'' AND
                        school_id = public.get_my_school_id() AND
                        (
                            -- Teacher is assigned to this subject
                            EXISTS (
                                SELECT 1 FROM public.teacher_subjects ts
                                JOIN public.teachers tech ON tech.id = ts.teacher_id
                                WHERE tech.email = (auth.jwt() ->> ''email'')
                                AND ts.subject_id = student_assessments.subject_id
                            )
                            OR
                            -- Teacher is the homeroom teacher for this class
                            EXISTS (
                                SELECT 1 FROM public.teacher_classes tc
                                JOIN public.teachers tech ON tech.id = tc.teacher_id
                                WHERE tech.email = (auth.jwt() ->> ''email'')
                                AND tc.class_id = student_assessments.class_id
                                AND tc.is_homeroom = TRUE
                            )
                        )
                    ) OR public.get_auth_role() = ''Admin''
                )
            ');
        ELSIF t = 'teachers' THEN
            -- Teachers can view all colleagues in their school
            EXECUTE format('
                CREATE POLICY "Users view teachers" ON public.teachers
                FOR SELECT USING (
                    school_id = public.get_my_school_id() OR
                    public.get_auth_role() = ''Admin''
                )
            ');
            -- Teachers can view their own record by email
            EXECUTE format('
                CREATE POLICY "Teachers view own record" ON public.teachers
                FOR SELECT USING (
                    lower(email) = lower(auth.jwt() ->> ''email'')
                )
            ');
            -- Teachers can only update their own profile
            EXECUTE format('
                CREATE POLICY "Teachers update own profile" ON public.teachers
                FOR UPDATE USING (
                    (public.get_auth_role() = ''Teacher'' AND email = (auth.jwt() ->> ''email'')) OR
                    public.get_auth_role() IN (''Headteacher'', ''Admin'')
                )
                WITH CHECK (
                    (public.get_auth_role() = ''Teacher'' AND email = (auth.jwt() ->> ''email'')) OR
                    public.get_auth_role() IN (''Headteacher'', ''Admin'')
                )
            ');
            -- Headteachers and Admins can manage all teachers in the school
            EXECUTE format('
                CREATE POLICY "Headteachers manage teachers" ON public.teachers
                FOR ALL USING (
                    (public.get_auth_role() = ''Headteacher'' AND school_id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                )
                WITH CHECK (
                    (public.get_auth_role() = ''Headteacher'' AND school_id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                )
            ');
        ELSE
            -- Default school-wide policy for teachers
            IF t IN ('fee_payments', 'expenses', 'transactions', 'student_term_reports') THEN
                -- Restricted: No DELETE for regular teachers on financial/official reports
                EXECUTE format('
                    CREATE POLICY "Teachers select school data" ON public.%I
                    FOR SELECT USING (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    );
                    CREATE POLICY "Teachers insert school data" ON public.%I
                    FOR INSERT WITH CHECK (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    );
                    CREATE POLICY "Teachers update school data" ON public.%I
                    FOR UPDATE USING (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    )
                    WITH CHECK (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    );
                ', t, t, t);
            ELSE
                EXECUTE format('
                    CREATE POLICY "Teachers manage school data" ON public.%I
                    FOR ALL USING (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    )
                    WITH CHECK (
                        (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                        public.get_auth_role() = ''Admin''
                    )
                ', t);
            END IF;
        END IF;

        -- Policy: Students/Parents can view their school's data
        EXECUTE format('
            CREATE POLICY "Users view school data" ON public.%I
            FOR SELECT USING (
                school_id = public.get_my_school_id() OR
                public.get_auth_role() = ''Admin''
            )
        ', t);

        -- Grant permissions
        EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated, service_role', t);
    END LOOP;
END $$;
`.trim();

export const securityCleanupSqlScript = `
-- Emergency Script: Security Audit & Role Cleanup
-- This script ensures no unauthorized users have "Admin" role.
-- ONLY whitelist specific emails.

DO $$
BEGIN
    -- Update all Admin profiles to Teacher, EXCEPT for whitelisted ones
    UPDATE public.profiles
    SET role = 'Teacher'
    WHERE role = 'Admin' 
    AND email NOT IN ('ferditgh@gmail.com', 'ferdagbatey@gmail.com');
    
    RAISE NOTICE 'Security cleanup complete. Unauthorized admins demoted to Teacher.';
END $$;
`.trim();

export const messagingSqlScript = `
-- Messaging System Setup
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    participant_ids UUID[] NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT
);

-- Defensive check: Ensure columns exist if table was created earlier
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='is_group') THEN
        ALTER TABLE public.conversations ADD COLUMN is_group BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='group_name') THEN
        ALTER TABLE public.conversations ADD COLUMN group_name TEXT;
    END IF;
END $$;

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for Conversations
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations" ON public.conversations
FOR SELECT USING (auth.uid() = ANY(participant_ids));

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations
FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));

DROP POLICY IF EXISTS "Users can delete their conversations" ON public.conversations;
CREATE POLICY "Users can delete their conversations" ON public.conversations
FOR DELETE USING (auth.uid() = ANY(participant_ids));

-- Policies for Messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND auth.uid() = ANY(c.participant_ids)
    )
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations" ON public.messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
        AND auth.uid() = ANY(c.participant_ids)
    )
);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE USING (sender_id = auth.uid());

-- Grant Permissions
GRANT ALL ON TABLE public.conversations TO authenticated, service_role;
GRANT ALL ON TABLE public.messages TO authenticated, service_role;

-- Ensure users can see each other to start conversations
DROP POLICY IF EXISTS "Users can view profiles in their school" ON public.profiles;
CREATE POLICY "Users can view profiles in their school" ON public.profiles 
FOR SELECT USING (
  school_id = public.get_my_school_id() OR id = auth.uid()
);
`.trim();

export const reportsAndAttendanceSqlScript = `
-- === Reports & Attendance Schema Setup ===

-- 1. Student Attendance Table
CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by UUID REFERENCES public.profiles(id),
    UNIQUE(student_id, attendance_date)
);
ALTER TABLE public.student_attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. Student Assessments Table
CREATE TABLE IF NOT EXISTS public.student_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    continuous_assessment_score DECIMAL(5,2),
    exam_score DECIMAL(5,2),
    total_score DECIMAL(5,2),
    remarks TEXT,
    UNIQUE(student_id, class_id, subject_id, term, year)
);
ALTER TABLE public.student_assessments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 3. Student Term Reports Table
CREATE TABLE IF NOT EXISTS public.student_term_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    total_score DECIMAL(7,2),
    average_score DECIMAL(5,2),
    position INTEGER,
    promoted_to_class_id UUID REFERENCES public.classes(id),
    status TEXT CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, term, year)
);
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_term_reports ENABLE ROW LEVEL SECURITY;

-- Apply Generic School Policies via Helper Loop (Teachers/Headteachers)
GRANT ALL ON TABLE public.student_attendance TO authenticated, service_role;
GRANT ALL ON TABLE public.student_assessments TO authenticated, service_role;
GRANT ALL ON TABLE public.student_term_reports TO authenticated, service_role;
`.trim();

export const notificationsSqlScript = `
-- Real-time Notifications Setup
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'success', 'warning', 'error', 'message')) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Users can view their notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- System can create notifications for any user (defensive)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT WITH CHECK (TRUE);

-- Grant Permissions
GRANT ALL ON TABLE public.notifications TO authenticated, service_role;
`.trim();

export const feesSqlScript = `
-- Fees and Billing System
CREATE TABLE IF NOT EXISTS public.fee_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    is_compulsory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12,2) NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'bank_transfer', 'momo', 'online'
    transaction_reference TEXT,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Apply generic school policies using a secure loop
-- Note: fee_types and fee_payments are now handled in the main helper functions loop
-- No separate script needed here to avoid redundancy and potential policy conflicts
`.trim();

export const feedbackSqlScript = `
-- Feedback System Setup
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT CHECK (category IN ('Technical', 'Feature Request', 'Bug Report', 'General', 'Compliment')),
    status TEXT CHECK (status IN ('Pending', 'Reviewing', 'Resolved', 'Dismissed')) DEFAULT 'Pending',
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
CREATE POLICY "Users can insert feedback" ON public.feedback
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback" ON public.feedback
FOR SELECT USING (auth.uid() = user_id);

-- Admins can view and manage all feedback in the school
DROP POLICY IF EXISTS "Admins manage feedback" ON public.feedback;
CREATE POLICY "Admins manage feedback" ON public.feedback
FOR ALL USING (
    (public.get_auth_role() = 'Headteacher' AND school_id = public.get_my_school_id()) OR
    public.get_auth_role() = 'Admin'
);

-- Grant Permissions
GRANT ALL ON TABLE public.feedback TO authenticated, service_role;
`.trim();

export const nextGenFeaturesSqlScript = `
-- === Next-Gen Features Setup ===

-- 1. Communication & Safety
CREATE TABLE IF NOT EXISTS public.ptm_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    meeting_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    meeting_link TEXT,
    status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ptm_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headteachers manage ptm data" ON public.ptm_meetings;
CREATE POLICY "Headteachers manage ptm data" ON public.ptm_meetings
FOR ALL USING (
    (public.get_auth_role() = 'Headteacher' AND school_id = public.get_my_school_id()) OR
    public.get_auth_role() = 'Admin'
);

DROP POLICY IF EXISTS "Users view ptm data" ON public.ptm_meetings;
CREATE POLICY "Users view ptm data" ON public.ptm_meetings
FOR SELECT USING (
    (public.get_auth_role() = 'Teacher' AND school_id = public.get_my_school_id()) OR
    (public.get_auth_role() = 'Parent' AND school_id = public.get_my_school_id()) OR
    (public.get_auth_role() = 'Student' AND school_id = public.get_my_school_id()) OR
    public.get_auth_role() = 'Admin'
);

GRANT ALL ON TABLE public.ptm_meetings TO authenticated, service_role;

-- 2. Financial Growth
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scholarships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    awarded_date DATE DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;

-- Note: Expenses and Scholarships RLS is now handled by the main loop

GRANT ALL ON TABLE public.expenses TO authenticated, service_role;
GRANT ALL ON TABLE public.scholarships TO authenticated, service_role;
`.trim();
