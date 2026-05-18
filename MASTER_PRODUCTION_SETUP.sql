-- ===============================================================
-- SMART SCHOOL SAAS - MASTER PRODUCTION SETUP (ULTIMATE SCHEMA)
-- ===============================================================
-- This script sets up the entire database for a new production project.
-- It combines core schema, GES Ghanaian optimizations, and multi-tenancy RLS.
-- Run this in the Supabase SQL Editor.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('Admin', 'Headteacher', 'Teacher', 'Student', 'Parent');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');
    END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Core Tables
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    plan_id TEXT DEFAULT 'standard',
    status public.subscription_status DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    logo_url TEXT,
    currency TEXT DEFAULT 'GHS'
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role public.user_role NOT NULL,
    school_id UUID REFERENCES public.schools(id),
    admission_numbers TEXT[],
    credit_balance DECIMAL(12,2) DEFAULT 0.00,
    is_onboarded BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
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
    current_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
    current_term TEXT,
    term_start_date DATE,
    term_end_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Academic Structure
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    form_teacher_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    admission_number TEXT NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    date_of_birth DATE,
    image_url TEXT,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    nhis_number TEXT,
    guardian_name TEXT,
    guardian_contact TEXT,
    gps_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, admission_number)
);

CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth DATE,
    rank TEXT,
    phone_number TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, staff_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_classes (
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    is_homeroom BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.teacher_subjects (
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- 5. Timetable & Attendance
CREATE TABLE IF NOT EXISTS public.time_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_break BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    time_slot_id UUID REFERENCES public.time_slots(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    UNIQUE(class_id, day_of_week, time_slot_id)
);

CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by UUID REFERENCES public.profiles(id),
    UNIQUE(school_id, student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    check_in_time TIME NOT NULL,
    check_out_time TIME,
    status TEXT CHECK (status IN ('Present', 'Late', 'Absent', 'Half Day')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, teacher_id, attendance_date)
);

-- 6. Financials
CREATE TABLE IF NOT EXISTS public.fee_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12,2) NOT NULL,
    receipt_number TEXT NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Other', 'online')),
    payment_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.profiles(id),
    transaction_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Academic Performance (GES Ghanaian GES Standard)
CREATE TABLE IF NOT EXISTS public.student_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    class_exercises DECIMAL(5,2),
    class_tests DECIMAL(5,2),
    project_work DECIMAL(5,2),
    observation_attitude DECIMAL(5,2),
    continuous_assessment_score DECIMAL(5,2),
    exam_score DECIMAL(5,2),
    total_score DECIMAL(5,2),
    remarks TEXT,
    UNIQUE(school_id, student_id, class_id, subject_id, term, year)
);

CREATE TABLE IF NOT EXISTS public.student_term_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    attitude TEXT,
    conduct TEXT,
    interest TEXT,
    class_teacher_remarks TEXT,
    headteacher_remarks TEXT,
    attendance_present INTEGER,
    attendance_total INTEGER,
    promoted_to_class_id UUID REFERENCES public.classes(id),
    status TEXT CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
    total_score DECIMAL(7,2),
    average_score DECIMAL(5,2),
    position INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_id, class_id, term, year)
);

CREATE TABLE IF NOT EXISTS public.mock_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    mock_type TEXT NOT NULL, 
    score DECIMAL(5,2),
    grade TEXT,
    term TEXT,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, subject_id, mock_type, term, year)
);

-- 8. Advanced Features
CREATE TABLE IF NOT EXISTS public.lesson_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_ending DATE NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    strand TEXT,
    sub_strand TEXT,
    reference TEXT,
    rpk TEXT,
    core_competencies TEXT[],
    learning_indicators TEXT,
    tlms TEXT[],
    introduction TEXT,
    presentation_steps JSONB NOT NULL DEFAULT '[]',
    conclusion TEXT,
    evaluation TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    headteacher_remarks TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    days TEXT,
    duration TEXT,
    file_url TEXT,
    key_words TEXT[],
    methodology TEXT,
    equipment TEXT[],
    topic TEXT,
    extra_details JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.schemes_of_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    strand TEXT,
    sub_strand TEXT,
    learning_indicators TEXT,
    resources TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 9. System & UI
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT NOT NULL,
    expiry_date DATE,
    created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'reviewed', 'resolved')) DEFAULT 'pending',
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================================
-- FUNCTIONS & TRIGGERS
-- ===============================================================

-- Helper function to check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get school ID
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();
    
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id 
        FROM public.teachers 
        WHERE email = (auth.jwt() ->> 'email')
        LIMIT 1;
    END IF;
    
    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role, 'Student');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Auth Trigger for Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
BEGIN
  IF new.email IN ('ferdagbatey@gmail.com', 'ferditgh@gmail.com') THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'Teacher');
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, is_onboarded)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.email,
    assigned_role::public.user_role, 
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF assigned_role IN ('Teacher', 'Headteacher') THEN
    INSERT INTO public.teachers (school_id, full_name, email, staff_id)
    VALUES (
      (new.raw_user_meta_data->>'school_id')::uuid,
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
      new.email,
      'STAFF-' || substr(md5(new.id::text), 1, 8)
    )
    ON CONFLICT (school_id, staff_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Automatic Positions Function
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

-- ===============================================================
-- RLS POLICIES (MULTI-TENANCY)
-- ===============================================================

-- Enable RLS on all tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Drop existing policies
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Master Loop for School-based Data
DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'classes', 'subjects', 'students', 'teachers', 
        'student_attendance', 'student_assessments', 'student_term_reports',
        'announcements', 'fee_types', 'fee_payments', 'expenses',
        'time_slots', 'timetable', 'teacher_classes', 'teacher_subjects',
        'teacher_attendance', 'lesson_notes', 'mock_assessments',
        'ptm_meetings', 'feedback', 'schemes_of_learning', 'school_settings'
    ];
    col_exists_id boolean;
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        -- Check if 'id' column exists for the specific table
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = t 
            AND column_name = 'id'
        ) INTO col_exists_id;

        IF col_exists_id AND t = 'school_settings' THEN
            -- Case for school_settings where id IS the school_id
            EXECUTE format('
                CREATE POLICY "Headteachers manage school data" ON public.%I
                FOR ALL USING (
                    (public.get_auth_role() = ''Headteacher'' AND id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                );
                CREATE POLICY "Teachers manage school data" ON public.%I
                FOR ALL USING (
                    (public.get_auth_role() = ''Teacher'' AND id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                );
                CREATE POLICY "Users view school data" ON public.%I
                FOR SELECT USING (
                    id = public.get_my_school_id() OR
                    public.get_auth_role() = ''Admin''
                );
            ', t, t, t);
        ELSE
            -- Standard case: filter by school_id
            EXECUTE format('
                CREATE POLICY "Headteachers manage school data" ON public.%I
                FOR ALL USING (
                    (public.get_auth_role() = ''Headteacher'' AND school_id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                );
                CREATE POLICY "Teachers manage school data" ON public.%I
                FOR ALL USING (
                    (public.get_auth_role() = ''Teacher'' AND school_id = public.get_my_school_id()) OR
                    public.get_auth_role() = ''Admin''
                );
                CREATE POLICY "Users view school data" ON public.%I
                FOR SELECT USING (
                    school_id = public.get_my_school_id() OR
                    public.get_auth_role() = ''Admin''
                );
            ', t, t, t);
        END IF;
    END LOOP;
END $$;

-- Profiles
CREATE POLICY "Own profile access" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "School profile view" ON public.profiles FOR SELECT USING (school_id = public.get_my_school_id() OR is_admin());

-- Storage (Standard bucket)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-notes', 'lesson-notes', true) ON CONFLICT (id) DO NOTHING;

-- Policies for storage
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';
