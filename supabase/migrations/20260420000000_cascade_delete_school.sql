
-- MIGRATION: Ensure Cascade Deletes for School Deletion
-- This script updates foreign keys to ensure that deleting a school 
-- automatically cleans up all associated data.

-- 1. Profiles Table
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_school_id_fkey,
ADD CONSTRAINT profiles_school_id_fkey 
FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- 2. Audit Logs (User Reference)
ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
ADD CONSTRAINT audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Announcements (Creator Reference)
ALTER TABLE public.announcements
DROP CONSTRAINT IF EXISTS announcements_created_by_fkey,
ADD CONSTRAINT announcements_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Messages (Sender Reference)
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. Student Attendance (Marked By Reference)
-- Repair: Some existing records might have teachers.id instead of profiles.id 
-- matching teachers to profiles via email to fix foreign key violations
UPDATE public.student_attendance sa
SET marked_by = p.id
FROM public.teachers t
JOIN public.profiles p ON p.email = t.email
WHERE sa.marked_by = t.id
AND sa.marked_by NOT IN (SELECT id FROM profiles);

-- Also fix any profiles that might have invalid school_id references before enforcing cascade
UPDATE public.profiles SET school_id = NULL WHERE school_id NOT IN (SELECT id FROM schools);

-- Final cleanup: Set any remaining invalid marked_by to NULL so the constraint can be applied
UPDATE public.student_attendance 
SET marked_by = NULL 
WHERE marked_by NOT IN (SELECT id FROM profiles);

ALTER TABLE public.student_attendance
DROP CONSTRAINT IF EXISTS student_attendance_marked_by_fkey,
ADD CONSTRAINT student_attendance_marked_by_fkey 
FOREIGN KEY (marked_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- 6. Add "Deletion Reason" support to schools (optional but good for auditing before they are gone)
-- Since we are deleting the record, we might want an audit log entry instead.
-- We will just log the action in the audit_logs before deleting.
