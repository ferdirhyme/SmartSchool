
import React, { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { SchoolSettings, Profile, UserRole } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';

// --- SQL Scripts for Advanced Section ---
const assessmentSqlScript = `
-- This script will completely erase all data in the student_assessments table.
-- Please back up your data before running this script if you need to preserve it.

-- Drop the existing table
DROP TABLE IF EXISTS public.student_assessments;

-- Recreate the table with the correct schema
CREATE TABLE public.student_assessments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
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
FOR ALL USING (public.get_auth_role() = 'Headteacher');

-- Teachers can manage assessments for students in their assigned subjects (any class) or any subject in their homeroom class
CREATE POLICY "Allow teachers to manage assessments for their subjects and homeroom" ON public.student_assessments
FOR ALL USING (
  public.get_auth_role() = 'Teacher' AND
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
);

-- Students can view their own assessments by matching admission number
CREATE POLICY "Allow students to view their own assessments" ON public.student_assessments
FOR SELECT USING (
  public.get_auth_role() = 'Student' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_assessments.student_id AND
    s.admission_number IN (SELECT UNNEST(admission_numbers) FROM public.profiles WHERE id = auth.uid())
  )
);

-- Parents can view assessments of their linked children
CREATE POLICY "Allow parents to view their wards' assessments" ON public.student_assessments
FOR SELECT USING (
  public.get_auth_role() = 'Parent' AND
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_assessments.student_id AND
    s.admission_number IN (SELECT UNNEST(admission_numbers) FROM public.profiles WHERE id = auth.uid())
  )
);

-- Grant necessary permissions to roles
GRANT ALL ON TABLE public.student_assessments TO authenticated, service_role;
`.trim();

const helperFunctionsSqlScript = `
-- This script bundles several helper functions and schema updates to resolve common permission and lookup issues.
-- It is safe to run this script multiple times.

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
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure email and avatar_url columns exist if table was created earlier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Populate email for existing profiles from auth.users
-- This requires the function to have access to auth.users
DO $$
BEGIN
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND p.email IS NULL;
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
    logo_url TEXT,
    currency TEXT DEFAULT 'GHS'
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
    school_latitude NUMERIC,
    school_longitude NUMERIC,
    paystack_public_key TEXT,
    paystack_secret_key TEXT,
    currency TEXT DEFAULT 'GHS'
);

-- === Schema Update: Add Paystack columns and currency to school_settings ===
-- This ensures the application doesn't crash if these columns are missing.
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS paystack_public_key TEXT;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS paystack_secret_key TEXT;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS school_latitude NUMERIC;
ALTER TABLE public.school_settings ADD COLUMN IF NOT EXISTS school_longitude NUMERIC;

-- === Helper Function: Get user role without recursion ===
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- === Helper Function: Get user school_id with Parent/Admin fallback ===
CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid AS $$
DECLARE
  sid uuid;
BEGIN
  -- 1. Try direct profile link
  SELECT school_id INTO sid FROM public.profiles WHERE id = auth.uid();
  
  -- 2. If still null, try to find via teachers table (for teachers)
  IF sid IS NULL THEN
    SELECT school_id INTO sid FROM public.teachers 
    WHERE email = (auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;

  -- 3. If Parent, try to find via wards
  IF sid IS NULL AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'Parent' THEN
    SELECT school_id INTO sid FROM public.students 
    WHERE admission_number = ANY(SELECT UNNEST(admission_numbers) FROM public.profiles WHERE id = auth.uid())
    LIMIT 1;
  END IF;
  
  -- 3. If Admin, just return the first school for settings lookup (optional)
  IF sid IS NULL AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'Admin' THEN
    SELECT id INTO sid FROM public.schools LIMIT 1;
  END IF;
  
  RETURN sid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- === Auth Trigger: Automatically create profile on signup ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_onboarded)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.email,
    (COALESCE(new.raw_user_meta_data->>'role', 'Teacher'))::public.user_role, 
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- === Function 1: Get User ID by Email (for server-side use) ===
DROP FUNCTION IF EXISTS public.get_user_id_by_email(user_email text);
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- SECURITY DEFINER allows this function to query auth.users securely.
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(user_email TEXT) TO service_role;

-- === Function 2: Get Teacher ID from Auth Email (for client-side use) ===
DROP FUNCTION IF EXISTS public.get_teacher_id_by_auth_email();
CREATE OR REPLACE FUNCTION public.get_teacher_id_by_auth_email()
RETURNS UUID AS $$
DECLARE
  teacher_record_id UUID;
BEGIN
  -- Securely finds the teacher's profile ID using the email of the logged-in user.
  SELECT id INTO teacher_record_id
  FROM public.teachers
  WHERE email = (auth.jwt() ->> 'email');
  
  RETURN teacher_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_teacher_id_by_auth_email() TO authenticated;

-- === Function 3: Admin Script Executor (for settings page) ===
DROP FUNCTION IF EXISTS public.execute_admin_sql(sql_script text);
CREATE OR REPLACE FUNCTION public.execute_admin_sql(sql_script TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Security check: Ensure only Headteachers or Admins can run this.
  IF public.get_auth_role() NOT IN ('Headteacher', 'Admin') THEN
    RAISE EXCEPTION 'Forbidden: Only Headteachers or Admins can execute admin scripts.';
  END IF;
  
  -- Execute the provided script
  EXECUTE sql_script;
  
  RETURN 'Script executed successfully.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.execute_admin_sql(sql_script TEXT) TO authenticated;

-- === Automatic Balance Update Trigger ===
-- This function automatically tops up a user's credit balance when a successful transaction is inserted.
-- This replaces the need for a separate Edge Function, keeping logic in the DB.

CREATE OR REPLACE FUNCTION public.handle_new_transaction_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the transaction is marked as success
  IF NEW.status = 'success' THEN
      -- Update the user's profile credit balance
      UPDATE public.profiles
      SET credit_balance = COALESCE(credit_balance, 0) + NEW.amount
      WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the transactions table
DROP TRIGGER IF EXISTS on_transaction_created ON public.transactions;
CREATE TRIGGER on_transaction_created
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_transaction_balance();

-- Ensure users can insert their own transactions (for client-side payment flow)
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions" ON public.transactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- === Schema Update: Create teacher_attendance table ===
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    teacher_id uuid NOT NULL,
    school_id uuid NOT NULL,
    attendance_date date NOT NULL DEFAULT CURRENT_DATE,
    check_in_time time without time zone,
    check_out_time time without time zone,
    status text NOT NULL DEFAULT 'Present',
    CONSTRAINT teacher_attendance_pkey PRIMARY KEY (id),
    CONSTRAINT teacher_attendance_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    CONSTRAINT teacher_attendance_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT teacher_attendance_unique_entry UNIQUE (teacher_id, attendance_date)
);

-- Defensive check: Ensure school_id exists if table was created earlier without it
ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Policies for schools
DROP POLICY IF EXISTS "Headteachers can manage their school" ON public.schools;
CREATE POLICY "Headteachers can manage their school" ON public.schools
FOR ALL USING (
  public.get_auth_role() = 'Headteacher'
);

DROP POLICY IF EXISTS "Admins can manage all schools" ON public.schools;
CREATE POLICY "Admins can manage all schools" ON public.schools
FOR ALL USING (
  public.get_auth_role() = 'Admin'
);

DROP POLICY IF EXISTS "Users can view their school" ON public.schools;
CREATE POLICY "Users can view their school" ON public.schools
FOR SELECT USING (
  id = public.get_my_school_id()
);

-- Policies for teacher_attendance
DROP POLICY IF EXISTS "Headteachers can manage all staff attendance" ON public.teacher_attendance;
CREATE POLICY "Headteachers can manage all staff attendance" ON public.teacher_attendance
FOR ALL USING (public.get_auth_role() = 'Headteacher');

DROP POLICY IF EXISTS "Teachers can manage their own attendance" ON public.teacher_attendance;
CREATE POLICY "Teachers can manage their own attendance" ON public.teacher_attendance
FOR ALL USING (
  teacher_id IN (SELECT id FROM public.teachers WHERE email = (auth.jwt() ->> 'email'))
);

-- Policies for school_settings
DROP POLICY IF EXISTS "Users can view their school settings" ON public.school_settings;
CREATE POLICY "Users can view their school settings" ON public.school_settings 
FOR SELECT USING (
  id = public.get_my_school_id() OR
  (
    public.get_auth_role() = 'Parent' AND
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.school_id = school_settings.id AND
      s.admission_number IN (SELECT UNNEST(admission_numbers) FROM public.profiles WHERE id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Headteachers can manage their school settings" ON public.school_settings;
CREATE POLICY "Headteachers can manage their school settings" ON public.school_settings
FOR ALL USING (
  public.get_auth_role() = 'Headteacher'
);

DROP POLICY IF EXISTS "Admins can manage all school settings" ON public.school_settings;
CREATE POLICY "Admins can manage all school settings" ON public.school_settings
FOR ALL USING (
  public.get_auth_role() = 'Admin'
);

-- Policies for students (Allow parents to see their wards even if school_id is not set on parent profile yet)
DROP POLICY IF EXISTS "Parents can view their wards" ON public.students;
CREATE POLICY "Parents can view their wards" ON public.students
FOR SELECT USING (
  public.get_auth_role() = 'Parent' AND
  admission_number IN (SELECT UNNEST(admission_numbers) FROM public.profiles WHERE id = auth.uid())
);

GRANT ALL ON TABLE public.teacher_attendance TO authenticated, service_role;
GRANT ALL ON TABLE public.school_settings TO authenticated, service_role;
GRANT ALL ON TABLE public.schools TO authenticated, service_role;

-- === Profiles Table Policies ===
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles 
FOR SELECT USING (public.get_auth_role() = 'Admin');

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles 
FOR UPDATE USING (public.get_auth_role() = 'Admin');

DROP POLICY IF EXISTS "Headteachers can view profiles in their school" ON public.profiles;
CREATE POLICY "Headteachers can view profiles in their school" ON public.profiles 
FOR SELECT USING (
  public.get_auth_role() = 'Headteacher' AND 
  school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Headteachers can update profiles in their school" ON public.profiles;
CREATE POLICY "Headteachers can update profiles in their school" ON public.profiles 
FOR UPDATE USING (
  public.get_auth_role() = 'Headteacher' AND 
  school_id = public.get_my_school_id()
);

DROP POLICY IF EXISTS "Users can view profiles in their school" ON public.profiles;
CREATE POLICY "Users can view profiles in their school" ON public.profiles 
FOR SELECT USING (
  school_id = public.get_my_school_id()
);

GRANT ALL ON TABLE public.profiles TO authenticated, service_role;

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
        'student_term_reports'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policies to avoid conflicts
        EXECUTE format('DROP POLICY IF EXISTS "Headteachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers view school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users view school data" ON public.%I', t);
        
        -- Policy: Headteachers have full access to their school's data
        EXECUTE format('
            CREATE POLICY "Headteachers manage school data" ON public.%I
            FOR ALL USING (
                public.get_auth_role() = ''Headteacher'' AND
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Policy: Teachers manage school data
        -- Special handling for student_assessments to restrict to assigned subjects/classes
        IF t = 'student_assessments' THEN
            EXECUTE format('
                CREATE POLICY "Teachers manage their assigned assessments" ON public.student_assessments
                FOR ALL USING (
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
                )
            ');
        ELSE
            EXECUTE format('
                CREATE POLICY "Teachers manage school data" ON public.%I
                FOR ALL USING (
                    public.get_auth_role() = ''Teacher'' AND
                    school_id = public.get_my_school_id()
                )
            ', t);
        END IF;

        -- Policy: Students/Parents can view their school's data
        EXECUTE format('
            CREATE POLICY "Users view school data" ON public.%I
            FOR SELECT USING (
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Grant permissions
        EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated, service_role', t);
    END LOOP;
END $$;
`.trim();

const messagingSqlScript = `
-- === Messaging Schema Setup ===

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    participant_ids UUID[] NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT
);

-- Defensive check: Ensure columns exist if table was created earlier
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS group_name TEXT;

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

-- Grant Permissions
GRANT ALL ON TABLE public.conversations TO authenticated, service_role;
GRANT ALL ON TABLE public.messages TO authenticated, service_role;

-- Ensure users can see each other to start conversations
DROP POLICY IF EXISTS "Users can view profiles in their school" ON public.profiles;
CREATE POLICY "Users can view profiles in their school" ON public.profiles 
FOR SELECT USING (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
`.trim();

const reportsAndAttendanceSqlScript = `
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
ALTER TABLE public.student_term_reports ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 4. Enable RLS and Apply Policies
DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY['student_attendance', 'student_assessments', 'student_term_reports'];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Headteachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users view school data" ON public.%I', t);
        
        -- Policy: Headteachers full access
        EXECUTE format('
            CREATE POLICY "Headteachers manage school data" ON public.%I
            FOR ALL USING (
                public.get_auth_role() = ''Headteacher'' AND
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Policy: Teachers full access
        EXECUTE format('
            CREATE POLICY "Teachers manage school data" ON public.%I
            FOR ALL USING (
                public.get_auth_role() = ''Teacher'' AND
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Policy: Users view access
        EXECUTE format('
            CREATE POLICY "Users view school data" ON public.%I
            FOR SELECT USING (
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Grant permissions
        EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated, service_role', t);
    END LOOP;
END $$;
`.trim();

const notificationsSqlScript = `
-- === Notifications Schema Setup ===

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Grant Permissions
GRANT ALL ON TABLE public.notifications TO authenticated, service_role;
`.trim();

const feesSqlScript = `
-- === Fees & Billing Schema Setup ===

-- 1. Fee Types
CREATE TABLE IF NOT EXISTS public.fee_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    default_amount DECIMAL(12,2) DEFAULT 0.00
);

-- 2. Fee Payments
CREATE TABLE IF NOT EXISTS public.fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    fee_type_id UUID REFERENCES public.fee_types(id) ON DELETE CASCADE,
    amount_paid DECIMAL(12,2) NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mobile Money', 'Other')),
    payment_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- Apply School-based RLS Policies
DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY['fee_types', 'fee_payments'];
BEGIN
    FOREACH t IN ARRAY tables_to_secure LOOP
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Headteachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Teachers manage school data" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users view school data" ON public.%I', t);
        
        -- Headteachers full access
        EXECUTE format('
            CREATE POLICY "Headteachers manage school data" ON public.%I
            FOR ALL USING (
                public.get_auth_role() = ''Headteacher'' AND
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Teachers full access (for billing staff)
        EXECUTE format('
            CREATE POLICY "Teachers manage school data" ON public.%I
            FOR ALL USING (
                public.get_auth_role() = ''Teacher'' AND
                school_id = public.get_my_school_id()
            )
        ', t);

        -- Grant permissions
        EXECUTE format('GRANT ALL ON TABLE public.%I TO authenticated, service_role', t);
    END LOOP;
END $$;
`.trim();


// --- Components for Settings Page ---
interface ScriptBlockProps {
    title: string;
    warning: React.ReactNode;
    instructions: React.ReactNode;
    script: string;
    isDestructive: boolean;
    onRun: (script: string) => void;
    isRunning: boolean;
}

const ScriptBlock: React.FC<ScriptBlockProps> = ({ title, warning, instructions, script, isDestructive, onRun, isRunning }) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy Script');

    const handleCopy = () => {
        navigator.clipboard.writeText(script).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Script'), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            setCopyButtonText('Failed to copy');
        });
    };
    
    const borderColor = isDestructive ? 'border-red-300 dark:border-red-700' : 'border-yellow-300 dark:border-yellow-700';
    const bgColor = isDestructive ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20';
    const titleColor = isDestructive ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300';
    const textColor = isDestructive ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300';
    const strongColor = isDestructive ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200';
    const runButtonColor = isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700';

    return (
        <div className={`p-6 border ${borderColor} ${bgColor} rounded-lg`}>
            <h2 className={`text-xl font-semibold ${titleColor} mb-4`}>{title}</h2>
            <div className={`${textColor} mb-4 space-y-3`}>
                {warning}
            </div>
            <div className="mb-4">
                <h3 className={`font-semibold mb-2 ${strongColor}`}>Instructions:</h3>
                {instructions}
            </div>
            <div className="relative group">
                <textarea
                    readOnly
                    value={script}
                    className="w-full h-64 p-3 font-mono text-sm bg-gray-900 text-gray-200 rounded-md border border-gray-600 focus:outline-none"
                />
                 <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleCopy}
                        className="px-3 py-1 text-xs font-semibold text-white bg-gray-600 rounded-md hover:bg-gray-700"
                    >
                        {copyButtonText}
                    </button>
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <button
                    onClick={() => onRun(script)}
                    disabled={isRunning}
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${runButtonColor}`}
                >
                    {isRunning ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : 'Run Script'}
                </button>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{ onConfirm: () => void; onCancel: () => void; isRunning: boolean }> = ({ onConfirm, onCancel, isRunning }) => {
    const [confirmText, setConfirmText] = useState('');
    const canConfirm = confirmText === 'DELETE';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Warning: Destructive Action</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                    You are about to run a script that will <strong className="font-bold underline">permanently delete all student assessment data</strong>. This action cannot be undone.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                    To proceed, please type <code className="font-mono bg-gray-200 dark:bg-gray-900 px-1 py-0.5 rounded">DELETE</code> into the box below.
                </p>
                <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md mb-6 dark:bg-gray-700"
                />
                <div className="flex justify-end gap-4">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Cancel</button>
                    <button onClick={onConfirm} disabled={!canConfirm || isRunning} className="px-4 py-2 bg-red-600 text-white rounded-md disabled:bg-red-400 disabled:cursor-not-allowed">
                        {isRunning ? 'Running...' : 'Confirm & Delete Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const AdvancedSettings: React.FC = () => {
    const [isScriptRunning, setIsScriptRunning] = useState(false);
    const [scriptToRun, setScriptToRun] = useState<string | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    const handleRunScript = async (script: string) => {
        setIsScriptRunning(true);
        setMessage(null);
        try {
            const { data, error } = await supabase.rpc('execute_admin_sql', { sql_script: script });
            if (error) throw error;
            setMessage({ type: 'success', text: data || 'Script executed successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'An unknown error occurred.' });
        } finally {
            setIsScriptRunning(false);
            setIsConfirmModalOpen(false);
            setScriptToRun(null);
        }
    };
    
    const triggerRun = (script: string, isDestructive: boolean) => {
        if (isDestructive) {
            setScriptToRun(script);
            setIsConfirmModalOpen(true);
        } else {
            handleRunScript(script);
        }
    };

    const commonInstructions = (
        <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click the "Run Script" button below.</li>
            <li>If the script is destructive, you will be asked to confirm.</li>
            <li>Alternatively, you can manually copy the script and run it in your Supabase SQL Editor.</li>
        </ol>
    );

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}

            {isConfirmModalOpen && (
                <ConfirmationModal 
                    onConfirm={() => { if(scriptToRun) handleRunScript(scriptToRun) }} 
                    onCancel={() => setIsConfirmModalOpen(false)}
                    isRunning={isScriptRunning}
                />
            )}

            <ScriptBlock
                title="1. Database & Payments Setup (Helper Functions)"
                isDestructive={false}
                warning={
                     <p>
                        Run this script first if you are setting up the system. It includes triggers for payments and helper functions for user lookups.
                    </p>
                }
                instructions={commonInstructions}
                script={helperFunctionsSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="2. Fees & Billing Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to create the tables required for managing fee types and recording student payments.
                    </p>
                }
                instructions={commonInstructions}
                script={feesSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="3. Messaging Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the messaging system, including conversations, messages, and security rules.
                    </p>
                }
                instructions={commonInstructions}
                script={messagingSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />
            
            <ScriptBlock
                title="4. Reports & Attendance Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the tables required for student reports, assessments, and attendance tracking. This also fixes permission issues for these features.
                    </p>
                }
                instructions={commonInstructions}
                script={reportsAndAttendanceSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="5. Notifications Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the real-time notification system.
                    </p>
                }
                instructions={commonInstructions}
                script={notificationsSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="6. Reset Student Assessments Table (Destructive)"
                isDestructive={true}
                warning={
                    <>
                        <p>
                            <strong className="block">Fix for Assessment Errors:</strong>
                            If you see an error like <code className="text-sm bg-red-200 dark:bg-red-800 p-1 rounded">"no unique or exclusion constraint matching the ON CONFLICT specification"</code> when saving scores, running this script will resolve it.
                        </p>
                        <p>
                            <strong className="block">Warning: Highly Destructive Action</strong>
                            This script will <strong className="underline">permanently delete all student assessment data</strong> to recreate the table with the correct structure. Use with extreme caution.
                        </p>
                    </>
                }
                instructions={commonInstructions}
                script={assessmentSqlScript}
                onRun={(script) => triggerRun(script, true)}
                isRunning={isScriptRunning}
            />
        </div>
    );
};


// Component for User-specific settings (Password change, etc.)
const UserSettings: React.FC = () => {
    const { theme, setTheme } = useSettings();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChangePassword = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (password.length < 8) {
            setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setIsSaving(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setMessage({ type: 'error', text: `Password update failed: ${error.message}` });
        } else {
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => setMessage(null), 5000); // Clear message after 5 seconds
        }
        setIsSaving(false);
    };
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.text}
                </div>
            )}
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Appearance</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Theme</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Choose how SmartSchool looks to you. Your preference is saved locally.</p>
                    </div>
                    <div className="flex items-center space-x-2 rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
                        <button onClick={() => setTheme('light')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500'}`}>Light</button>
                        <button onClick={() => setTheme('dark')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500'}`}>Dark</button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Change Password</h2>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClasses} placeholder="8+ characters" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClasses} placeholder="••••••••" />
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button type="submit" disabled={isSaving} className="px-6 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </form>

            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Notification Preferences</h2>
                <p className="text-gray-600 dark:text-gray-400">
                    This feature is coming soon. You will be able to manage email and in-app notifications here.
                </p>
            </div>
        </div>
    );
};

// Component for School-wide settings (Headteacher or Admin)
export const SchoolSettingsComponent: React.FC<{ schoolId: string | null; userRole: UserRole }> = ({ schoolId, userRole }) => {
    const { settings: contextSettings, isLoading: isSettingsLoading, refetchSettings } = useSettings();
    const [formData, setFormData] = useState<Partial<SchoolSettings>>({});
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);

    useEffect(() => {
        const fetchLocalSettings = async () => {
            if (!schoolId) return;
            
            // If the schoolId matches the context, use context data
            if (contextSettings && contextSettings.id === schoolId) {
                setFormData(contextSettings);
                return;
            }

            // Otherwise, fetch specifically for this schoolId (Admin use case)
            setIsLocalLoading(true);
            try {
                const { data, error } = await supabase
                    .from('school_settings')
                    .select('*')
                    .eq('id', schoolId)
                    .maybeSingle();
                
                if (error) throw error;
                if (data) {
                    setFormData(data);
                } else {
                    // Initialize with defaults if no settings exist yet
                    setFormData({ id: schoolId });
                }
            } catch (err: any) {
                console.error("Error fetching school settings:", err);
                setMessage({ type: 'error', text: 'Failed to load school settings.' });
            } finally {
                setIsLocalLoading(false);
            }
        };

        fetchLocalSettings();
    }, [schoolId, contextSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumberInput = (e.target as HTMLInputElement).type === 'number';
        setFormData(prev => ({ ...prev, [name]: isNumberInput ? (value === '' ? null : parseFloat(value)) : value }));
    };
    
    const handleFetchLocation = () => {
      if (!navigator.geolocation) {
        setMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
        return;
      }

      setIsFetchingLocation(true);
      setMessage(null);

      const options = {
        enableHighAccuracy: false,
        timeout: 20000, // Increased to 20 seconds
        maximumAge: 60000 // Allow cached positions up to 1 minute old
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            school_latitude: latitude,
            school_longitude: longitude,
          }));
          setIsFetchingLocation(false);
          setMessage({ type: 'success', text: `Location fetched: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
          setTimeout(() => setMessage(null), 5000);
        },
        (error) => {
          let errorText = 'Could not get your location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorText = 'Location access denied. Please check your browser address bar for a blocked location icon and set it to "Allow".';
              break;
            case error.POSITION_UNAVAILABLE:
              errorText = 'Location information is unavailable. Ensure your device GPS is on or try using a different browser/device.';
              break;
            case error.TIMEOUT:
              errorText = 'The request timed out. This often happens if the browser permission prompt is ignored or if the signal is weak. Please try again or enter coordinates manually.';
              break;
          }
          setMessage({ type: 'error', text: `${errorText} (System Error: ${error.message})` });
          setIsFetchingLocation(false);
        },
        options
      );
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            let currentSchoolId = schoolId;

            // If no school ID exists, create the school first
            if (!currentSchoolId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not authenticated");

                const { data: newSchool, error: schoolError } = await supabase
                    .from('schools')
                    .insert({ name: formData.school_name || 'New School' })
                    .select()
                    .single();
                
                if (schoolError) throw schoolError;
                currentSchoolId = newSchool.id;

                // Update user profile with new school ID
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ school_id: currentSchoolId })
                    .eq('id', user.id);
                
                if (profileError) throw profileError;
            }

            let logo_url = formData.logo_url;

            if (logoFile) {
                const filePath = `school/${currentSchoolId}/${Date.now()}_${logoFile.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, logoFile, { upsert: true });
                if (uploadError) throw new Error(`Logo upload failed: ${uploadError.message}`);

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                logo_url = urlData.publicUrl;
            }

            const { id, ...updateData } = formData;
            const payload = { 
                ...updateData, 
                logo_url, 
                id: currentSchoolId,
                paystack_public_key: formData.paystack_public_key?.trim() || null,
                paystack_secret_key: formData.paystack_secret_key?.trim() || null
            };
            
            const { error } = await supabase.from('school_settings').upsert(payload, { onConflict: 'id' });
            
            if (error) throw error;

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
            refetchSettings();
            // Reload page to ensure all contexts are updated with the new school ID
            setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'An error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isSettingsLoading || isLocalLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

    return (
        <div>
            {message && (
                <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">School Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label htmlFor="school_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">School Name</label>
                                    <input type="text" name="school_name" id="school_name" value={formData.school_name || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="motto" className="block text-sm font-medium text-gray-700 dark:text-gray-300">School Motto</label>
                                    <input type="text" name="motto" id="motto" value={formData.motto || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                                    <input type="text" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                    <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                                    <textarea name="address" id="address" value={formData.address || ''} onChange={handleChange} rows={3} className={inputClasses}/>
                                </div>
                            </div>
                        </div>
                         <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Attendance Location (GPS)</h2>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Set the school's coordinates to be used as a reference point for teacher attendance check-ins.</p>
                             <div className="mb-4 space-y-2">
                                <button 
                                    type="button" 
                                    onClick={handleFetchLocation}
                                    disabled={isFetchingLocation}
                                    className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                                >
                                    {isFetchingLocation ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {isFetchingLocation ? 'Fetching...' : 'Use My Current Location'}
                                </button>
                                <p className="text-[11px] text-gray-500 italic">
                                    Tip: If the button times out, you can find your coordinates on Google Maps and enter them manually below.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="school_latitude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">School Latitude</label>
                                    <input type="number" step="any" name="school_latitude" id="school_latitude" value={formData.school_latitude ?? ''} onChange={handleChange} className={inputClasses} placeholder="e.g., 5.603717"/>
                                </div>
                                <div>
                                    <label htmlFor="school_longitude" className="block text-sm font-medium text-gray-700 dark:text-gray-300">School Longitude</label>
                                    <input type="number" step="any" name="school_longitude" id="school_longitude" value={formData.school_longitude ?? ''} onChange={handleChange} className={inputClasses} placeholder="e.g., -0.186964"/>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Payment Gateway (Paystack)</h2>
                            {userRole === UserRole.Admin ? (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter your Paystack API keys. These will be used to enable credit top-ups for students and parents.</p>
                                    <div className="p-3 mb-4 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 text-blue-700 dark:text-blue-200 text-sm">
                                        <strong>Note:</strong> The <strong>Public Key</strong> is used on the client-side to initialize payments. The <strong>Secret Key</strong> is kept securely in the database but is not actively used by the client application to ensure security.
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                                            <select name="currency" id="currency" value={formData.currency || ''} onChange={handleChange} className={inputClasses}>
                                                <option value="">-- Select Currency --</option>
                                                <option value="GHS">GHS (Ghana Cedi)</option>
                                                <option value="NGN">NGN (Nigerian Naira)</option>
                                                <option value="USD">USD (US Dollar)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="paystack_public_key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Public Key</label>
                                            <input type="text" name="paystack_public_key" id="paystack_public_key" value={formData.paystack_public_key || ''} onChange={handleChange} className={inputClasses} placeholder="pk_test_... or pk_live_..."/>
                                        </div>
                                        <div>
                                            <label htmlFor="paystack_secret_key" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Secret Key</label>
                                            <div className="relative">
                                                <input type={showSecret ? 'text' : 'password'} name="paystack_secret_key" id="paystack_secret_key" value={formData.paystack_secret_key || ''} onChange={handleChange} className={inputClasses} placeholder="sk_test_... or sk_live_..."/>
                                                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute inset-y-0 right-0 px-3 flex items-center text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                                    {showSecret ? 'Hide' : 'Show'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">Restricted Access</h3>
                                            <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                                                <p>Payment gateway settings can only be managed by a Super Admin. Please contact the platform administrator to configure your Paystack keys.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                         <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">School Logo</h2>
                            <ImageUpload onFileChange={setLogoFile} defaultImageUrl={formData.logo_url} />
                        </div>
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                             <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Default School Theme</h2>
                             <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Set the default theme for all users. Users can override this in their own settings.</p>
                             <select name="theme" value={formData.theme || 'light'} onChange={handleChange} className={inputClasses}>
                                 <option value="light">Light Mode</option>
                                 <option value="dark">Dark Mode</option>
                             </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-8 py-3 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Main page component that decides which settings to show based on user role
interface SettingsPageProps {
    profile: Profile;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ profile }) => {
    const [activeTab, setActiveTab] = useState('my-settings');

    if (profile.role !== UserRole.Headteacher && profile.role !== UserRole.Admin) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">My Settings</h1>
                <UserSettings />
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                <button 
                    onClick={() => setActiveTab('my-settings')} 
                    className={`px-4 py-2 text-lg font-medium transition-colors ${activeTab === 'my-settings' 
                        ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    My Settings
                </button>
                <button 
                    onClick={() => setActiveTab('school-settings')} 
                    className={`px-4 py-2 text-lg font-medium transition-colors ${activeTab === 'school-settings' 
                        ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                    School Settings
                </button>
                 {profile.role === UserRole.Admin && (
                     <button 
                        onClick={() => setActiveTab('advanced')} 
                        className={`px-4 py-2 text-lg font-medium transition-colors ${activeTab === 'advanced' 
                            ? 'border-b-2 border-brand-600 text-brand-600 dark:text-brand-400' 
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Advanced
                    </button>
                 )}
            </div>
            
            {activeTab === 'my-settings' && (
                 <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">My Settings</h1>
                    <UserSettings />
                </div>
            )}
            {activeTab === 'school-settings' && (
                 <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">School Settings</h1>
                    <SchoolSettingsComponent schoolId={profile.school_id} userRole={profile.role} />
                </div>
            )}
            {activeTab === 'advanced' && profile.role === UserRole.Admin && (
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Advanced Database Scripts</h1>
                    <AdvancedSettings />
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
