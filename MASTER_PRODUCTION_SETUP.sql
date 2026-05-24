-- ===============================================================
-- SMART SCHOOL SAAS - MASTER PRODUCTION SETUP (ULTIMATE SCHEMA)
-- ===============================================================
-- Ultimate schema synchronization script.
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
    email TEXT UNIQUE,
    role public.user_role NOT NULL,
    school_id UUID REFERENCES public.schools(id),
    admission_numbers TEXT[],
    credit_balance NUMERIC(12,2) DEFAULT 0.00,
    is_onboarded BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_settings (
    id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    school_name TEXT NOT NULL,
    logo_url TEXT,
    theme TEXT DEFAULT 'light',
    motto TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    school_latitude NUMERIC(9,6),
    school_longitude NUMERIC(9,6),
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
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7), 
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
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
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
    amount NUMERIC(12,2) NOT NULL,
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
    amount_paid NUMERIC(12,2) NOT NULL,
    receipt_number TEXT NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Other')),
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
    amount NUMERIC(12,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scholarships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    awarded_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Academic Performance
CREATE TABLE IF NOT EXISTS public.student_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    continuous_assessment_score NUMERIC(5,2),
    exam_score NUMERIC(5,2),
    total_score NUMERIC(5,2),
    remarks TEXT,
    assessment_type TEXT,
    mock_tag TEXT DEFAULT 'N/A',
    UNIQUE(school_id, student_id, class_id, subject_id, term, year, assessment_type, mock_tag)
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
    status TEXT CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
    promotion_status TEXT,
    total_score NUMERIC(7,2),
    average_score NUMERIC(5,2),
    position INTEGER,
    UNIQUE(school_id, student_id, class_id, term, year)
);

CREATE TABLE IF NOT EXISTS public.mock_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    mock_type TEXT NOT NULL, 
    score NUMERIC(5,2),
    grade TEXT,
    term TEXT,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Advanced Features
CREATE TABLE IF NOT EXISTS public.lesson_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_ending DATE NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL,
    strand TEXT,
    sub_strand TEXT,
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
    file_url TEXT
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

CREATE TABLE IF NOT EXISTS public.ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    image_url TEXT,
    content_url TEXT,
    target_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id INT PRIMARY KEY DEFAULT 1,
    platform_logo_url TEXT,
    platform_name TEXT DEFAULT 'FerdIT School Software',
    contact_phone TEXT DEFAULT '+233247823410',
    contact_email TEXT DEFAULT 'ferditgh@gmail.com',
    contact_country TEXT DEFAULT 'Ghana',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
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
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

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

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12,2),
    status TEXT CHECK (status IN ('pending', 'success', 'failed')),
    reference TEXT UNIQUE,
    gateway TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================================
-- FUNCTIONS & TRIGGERS
-- ===============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  ) OR (
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('ferdagbatey@gmail.com', 'ferditgh@gmail.com')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
DECLARE
    v_role text;
    v_email text;
BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_email IN ('ferdagbatey@gmail.com', 'ferditgh@gmail.com') THEN
        RETURN 'Admin';
    END IF;

    SELECT role::text INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN coalesce(v_role, 'Student');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS UUID AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();
    IF v_school_id IS NULL THEN
        SELECT school_id INTO v_school_id 
        FROM public.teachers 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        LIMIT 1;
    END IF;
    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_headteacher()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'Headteacher'
    );
END;
$function$;

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
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = EXCLUDED.role;

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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_transaction_success()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
        UPDATE public.profiles
        SET credit_balance = COALESCE(credit_balance, 0) + NEW.amount
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_transaction_success ON public.transactions;
CREATE TRIGGER on_transaction_success AFTER INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_success();

CREATE OR REPLACE FUNCTION public.execute_admin_sql(sql_script text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.get_auth_role() != 'Admin' THEN
    RAISE EXCEPTION 'Only Admins can execute system scripts.';
  END IF;
  EXECUTE sql_script;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_production_schema()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    schema_data JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tables', (
            SELECT jsonb_agg(jsonb_build_object(
                'table_name', t.table_name,
                'columns', (
                    SELECT jsonb_agg(jsonb_build_object(
                        'column_name', c.column_name,
                        'data_type', c.data_type,
                        'is_nullable', c.is_nullable,
                        'column_default', c.column_default
                    ))
                    FROM information_schema.columns c
                    WHERE c.table_name = t.table_name AND c.table_schema = 'public'
                )
            ))
            FROM information_schema.tables t
            WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ),
        'policies', (
            SELECT jsonb_agg(jsonb_build_object(
                'tablename', p.tablename,
                'policyname', p.policyname,
                'roles', p.roles,
                'cmd', p.cmd,
                'qual', p.qual,
                'with_check', p.with_check
            ))
            FROM pg_policies p
            WHERE p.schemaname = 'public'
        )
    ) INTO schema_data;
    RETURN schema_data;
END;
$function$;

-- ===============================================================
-- RLS POLICIES (MULTI-TENANCY)
-- ===============================================================

DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'schools', 'classes', 'subjects', 'students', 'teachers', 
        'student_attendance', 'student_assessments', 'student_term_reports',
        'announcements', 'fee_types', 'fee_payments', 'expenses',
        'time_slots', 'timetable', 'teacher_classes', 'teacher_subjects',
        'teacher_attendance', 'lesson_notes', 'mock_assessments',
        'ptm_meetings', 'feedback', 'schemes_of_learning', 'school_settings',
        'notifications', 'scholarships', 'audit_logs', 'transactions',
        'ads', 'platform_settings'
    ];
    col_exists_id boolean;
    col_exists_school_id boolean;
    col_exists_user_id boolean;
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'id') INTO col_exists_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'school_id') INTO col_exists_school_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id') INTO col_exists_user_id;

        EXECUTE format('CREATE POLICY "Admin full access" ON public.%I FOR ALL USING (public.is_admin())', t);

        IF col_exists_id AND (t = 'school_settings' OR t = 'schools') THEN
            EXECUTE format('
                CREATE POLICY "Headteachers manage school data" ON public.%I FOR ALL TO public USING ((((public.get_auth_role() = ''Headteacher''::text) AND (id = public.get_my_school_id())) OR (public.get_auth_role() = ''Admin''::text)));
                CREATE POLICY "Teachers manage school data" ON public.%I FOR ALL TO public USING ((((public.get_auth_role() = ''Teacher''::text) AND (id = public.get_my_school_id())) OR (public.get_auth_role() = ''Admin''::text)));
                CREATE POLICY "Users view school data" ON public.%I FOR SELECT TO public USING (((id = public.get_my_school_id()) OR (public.get_auth_role() = ''Admin''::text)));
            ', t, t, t);
        ELSIF col_exists_school_id THEN
            EXECUTE format('
                CREATE POLICY "Headteachers manage school data" ON public.%I FOR ALL TO public USING ((((public.get_auth_role() = ''Headteacher''::text) AND (school_id = public.get_my_school_id())) OR (public.get_auth_role() = ''Admin''::text)));
                CREATE POLICY "Teachers manage school data" ON public.%I FOR ALL TO public USING ((((public.get_auth_role() = ''Teacher''::text) AND (school_id = public.get_my_school_id())) OR (public.get_auth_role() = ''Admin''::text)));
                CREATE POLICY "Users view school data" ON public.%I FOR SELECT TO public USING (((school_id = public.get_my_school_id()) OR (public.get_auth_role() = ''Admin''::text)));
            ', t, t, t);
        ELSIF col_exists_user_id THEN
            EXECUTE format('
                CREATE POLICY "Own data access" ON public.%I FOR SELECT TO public USING (auth.uid() = user_id OR public.is_admin());
            ', t);
        END IF;
    END LOOP;
END $$;

CREATE POLICY "Own profile access" ON public.profiles FOR ALL USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "School profile view" ON public.profiles FOR SELECT TO public USING (((school_id = public.get_my_school_id()) OR public.is_admin()));

-- Public global tables
CREATE POLICY "Public view access" ON public.ads FOR SELECT USING (true);
CREATE POLICY "Public platform settings view" ON public.platform_settings FOR SELECT USING (true);

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (true);
DROP POLICY IF EXISTS "User Update Access" ON storage.objects;
CREATE POLICY "User Update Access" ON storage.objects FOR UPDATE TO public USING (((bucket_id = ANY (ARRAY['avatars'::text, 'attachments'::text])) AND (auth.uid() = owner)));
DROP POLICY IF EXISTS "User Delete Access" ON storage.objects;
CREATE POLICY "User Delete Access" ON storage.objects FOR DELETE TO public USING (((bucket_id = ANY (ARRAY['avatars'::text, 'attachments'::text])) AND (auth.uid() = owner)));
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
