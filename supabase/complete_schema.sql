
-- SmartSchool SaaS Complete Database Schema Migration Script
-- This script ensures all tables, columns, enums, and policies exist.

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
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admission_numbers TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT FALSE;

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 7. Subjects
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

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
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

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
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

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
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 17. Student Assessments
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
ALTER TABLE student_assessments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 18. Student Term Reports
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
ALTER TABLE student_term_reports ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 19. Audit Logs
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

-- 20. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')),
    gateway TEXT
);

-- 21. Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    message TEXT NOT NULL,
    expiry_date DATE,
    created_by UUID REFERENCES profiles(id)
);

-- 22. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    participant_ids UUID[] NOT NULL
);

-- 23. Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL
);

-- 24. Auth Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
BEGIN
  -- 1. Determine Role Securely (Using text to avoid enum caching issues in persistent connections)
  IF new.email = 'ferditgh@gmail.com' THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'Teacher');
  END IF;

  -- 2. Create Profile (If this fails, the whole signup rolls back)
  INSERT INTO public.profiles (id, full_name, email, role, is_onboarded)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.email,
    assigned_role, 
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- 3. Auto-populate teachers table if applicable
  IF assigned_role IN ('Teacher', 'Headteacher') THEN
    INSERT INTO public.teachers (full_name, email, staff_id)
    VALUES (
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
      new.email,
      CASE 
        WHEN new.raw_user_meta_data->>'staff_id' IS NULL OR new.raw_user_meta_data->>'staff_id' = '' 
        THEN 'STAFF-' || substr(md5(new.id::text), 1, 8)
        ELSE new.raw_user_meta_data->>'staff_id'
      END
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

-- 25. RLS Policies
-- Enable RLS on all tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public') LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Helper function to get school ID without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Recreate Policies
CREATE POLICY "Users can view data from their school" ON classes
    FOR SELECT USING (school_id = get_my_school_id() OR public.is_admin());

CREATE POLICY "Users can view data from their school" ON subjects
    FOR SELECT USING (school_id = get_my_school_id() OR public.is_admin());

CREATE POLICY "Users can view data from their school" ON students
    FOR SELECT USING (school_id = get_my_school_id() OR public.is_admin());

CREATE POLICY "Users can view data from their school" ON teachers
    FOR SELECT USING (school_id = get_my_school_id() OR public.is_admin());

CREATE POLICY "Admins can update all teachers" ON teachers
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Users can view own profile" ON profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their school" ON profiles
    FOR SELECT USING (school_id = get_my_school_id());

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete all profiles" ON profiles
    FOR DELETE USING (public.is_admin());

CREATE POLICY "Anyone can view schools" ON schools
    FOR SELECT USING (true);

CREATE POLICY "Admins can insert schools" ON schools
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update schools" ON schools
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete schools" ON schools
    FOR DELETE USING (public.is_admin());

CREATE POLICY "Users can view their conversations" ON conversations
    FOR SELECT USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));

CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND auth.uid() = ANY(c.participant_ids)
        )
    );

CREATE POLICY "Users can send messages in their conversations" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND auth.uid() = ANY(c.participant_ids)
        )
    );

-- 25. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
CREATE POLICY "Users can create notifications" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

GRANT ALL ON TABLE notifications TO authenticated, service_role;

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

-- RLS for Platform Settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can read platform settings" ON platform_settings FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Only super admins can update platform settings" ON platform_settings FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
            AND profiles.school_id IS NULL
        )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Only super admins can insert platform settings" ON platform_settings FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
            AND profiles.school_id IS NULL
        )
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- End of Script

