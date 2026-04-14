
-- ===============================================================
-- SMART SCHOOL SAAS - MASTER PRODUCTION SCHEMA
-- ===============================================================
-- This script sets up the entire database for a new production project.
-- Run this in the Supabase SQL Editor.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Headteacher', 'Teacher', 'Student', 'Parent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Schools Table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    plan_id TEXT DEFAULT 'standard',
    status subscription_status DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    logo_url TEXT,
    currency TEXT DEFAULT 'GHS'
);

-- 4. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role user_role NOT NULL,
    school_id UUID REFERENCES schools(id),
    admission_numbers TEXT[],
    credit_balance DECIMAL(12,2) DEFAULT 0.00,
    is_onboarded BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. School Settings
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
    school_name TEXT NOT NULL,
    logo_url TEXT,
    theme TEXT DEFAULT 'light',
    motto TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    school_latitude DECIMAL(9,6),
    school_longitude DECIMAL(9,6),
    paystack_public_key TEXT,
    paystack_secret_key TEXT,
    currency TEXT DEFAULT 'GHS'
);

-- 6. Classes
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    form_teacher_id UUID, -- Will reference profiles(id) later via policy or trigger if needed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Subjects
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    admission_number TEXT UNIQUE NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    date_of_birth DATE,
    image_url TEXT,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    nhis_number TEXT,
    guardian_name TEXT,
    guardian_contact TEXT,
    gps_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Teachers
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    staff_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth DATE,
    rank TEXT,
    phone_number TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Teacher-Class Link
CREATE TABLE IF NOT EXISTS teacher_classes (
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    is_homeroom BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (teacher_id, class_id)
);

-- 11. Teacher-Subject Link
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- 12. Time Slots
CREATE TABLE IF NOT EXISTS time_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_break BOOLEAN DEFAULT FALSE
);

-- 13. Timetable
CREATE TABLE IF NOT EXISTS timetable (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
    time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    UNIQUE(class_id, day_of_week, time_slot_id)
);

-- 14. Fee Types
CREATE TABLE IF NOT EXISTS fee_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    default_amount DECIMAL(12,2) DEFAULT 0.00
);

-- 15. Fee Payments
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    fee_type_id UUID REFERENCES fee_types(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12,2) NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Other')),
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Student Attendance
CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('Present', 'Absent', 'Late')),
    marked_by UUID REFERENCES profiles(id),
    UNIQUE(student_id, attendance_date)
);

-- 17. Teacher Attendance
CREATE TABLE IF NOT EXISTS teacher_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('Present', 'Late', 'Absent', 'Half Day')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Student Assessments
CREATE TABLE IF NOT EXISTS student_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
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
    UNIQUE(student_id, class_id, subject_id, term, year)
);

-- 19. Student Term Reports
CREATE TABLE IF NOT EXISTS student_term_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    year INTEGER NOT NULL,
    attitude TEXT,
    conduct TEXT,
    interest TEXT,
    class_teacher_remarks TEXT,
    headteacher_remarks TEXT,
    attendance_present INTEGER,
    attendance_total INTEGER,
    promoted_to TEXT,
    UNIQUE(student_id, term, year)
);

-- 20. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB
);

-- 21. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')),
    gateway TEXT
);

-- 22. Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT NOT NULL,
    expiry_date DATE,
    created_by UUID REFERENCES profiles(id)
);

-- 23. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    participant_ids UUID[] NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT
);

-- 24. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL
);

-- 25. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT
);

-- 26. Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
    id INT PRIMARY KEY DEFAULT 1,
    platform_logo_url TEXT,
    platform_name TEXT DEFAULT 'FerdIT School Software',
    contact_phone TEXT DEFAULT '+233247823410',
    contact_email TEXT DEFAULT 'ferditgh@gmail.com',
    contact_country TEXT DEFAULT 'Ghana',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 27. Storage Buckets
-- Note: storage.buckets and storage.objects are in the 'storage' schema
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 28. Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "User Update Access" ON storage.objects;
CREATE POLICY "User Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (auth.uid() = owner OR public.is_admin()));

DROP POLICY IF EXISTS "User Delete Access" ON storage.objects;
CREATE POLICY "User Delete Access" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND (auth.uid() = owner OR public.is_admin()));

-- 29. Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'reviewed', 'resolved')) DEFAULT 'pending',
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Ads
CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    link_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================================
-- FUNCTIONS & TRIGGERS
-- ===============================================================

-- Auth Trigger for Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
BEGIN
  IF new.email = 'ferdagbatey@gmail.com' THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'Teacher');
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, is_onboarded)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.email,
    assigned_role::user_role, 
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF assigned_role IN ('Teacher', 'Headteacher') THEN
    INSERT INTO public.teachers (full_name, email, staff_id)
    VALUES (
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
      new.email,
      'STAFF-' || substr(md5(new.id::text), 1, 8)
    )
    ON CONFLICT (staff_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Helper function to check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get school ID
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ===============================================================
-- RLS POLICIES
-- ===============================================================

-- Enable RLS on all tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public') LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Drop existing policies
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Generic School-based Policies
-- Classes, Subjects, Students, Teachers, TimeSlots, Timetable, FeeTypes, FeePayments, Attendance, Assessments, Reports, Announcements, Feedback
CREATE POLICY "School data access" ON classes FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON subjects FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON students FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON teachers FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON time_slots FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON timetable FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON fee_types FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON fee_payments FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON student_attendance FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON teacher_attendance FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON student_assessments FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON student_term_reports FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON announcements FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON feedback FOR ALL USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "School data access" ON school_settings FOR ALL USING (id = get_my_school_id() OR is_admin());

-- Profiles
CREATE POLICY "Own profile access" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "School profile view" ON profiles FOR SELECT USING (school_id = get_my_school_id() OR is_admin());
CREATE POLICY "Admin full access" ON profiles FOR ALL USING (is_admin());

-- Schools
CREATE POLICY "Public school view" ON schools FOR SELECT USING (true);
CREATE POLICY "Admin school manage" ON schools FOR ALL USING (is_admin());

-- Messaging
CREATE POLICY "Conversation access" ON conversations FOR ALL USING (auth.uid() = ANY(participant_ids) OR is_admin());
CREATE POLICY "Message access" ON messages FOR ALL USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (auth.uid() = ANY(participant_ids) OR is_admin()))
);

-- Notifications
CREATE POLICY "Own notification access" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Platform Settings
CREATE POLICY "Public platform view" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "Admin platform manage" ON platform_settings FOR ALL USING (is_admin());

-- Ads
CREATE POLICY "Public ad view" ON ads FOR SELECT USING (is_active = true);
CREATE POLICY "Admin ad manage" ON ads FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ===============================================================
-- BOOTSTRAP ADMIN
-- ===============================================================
-- Run this AFTER creating your account to ensure you have full access.
-- Replace the email if needed.
UPDATE public.profiles 
SET role = 'Admin' 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'ferdagbatey@gmail.com');
