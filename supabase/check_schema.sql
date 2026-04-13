-- Database Requirement Verification Script

-- 1. Check Tables
SELECT 'profiles' AS table_name, EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') AS exists;
SELECT 'teachers' AS table_name, EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers') AS exists;
SELECT 'schools' AS table_name, EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools') AS exists;
SELECT 'platform_settings' AS table_name, EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'platform_settings') AS exists;

-- 2. Check Columns in 'teachers'
SELECT 'teachers.staff_id' AS column_name, EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'staff_id') AS exists;
SELECT 'teachers.email' AS column_name, EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'email') AS exists;
SELECT 'teachers.full_name' AS column_name, EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'full_name') AS exists;

-- 3. Check Functions
SELECT 'handle_new_user' AS function_name, EXISTS (SELECT FROM pg_proc WHERE proname = 'handle_new_user') AS exists;
SELECT 'get_user_id_by_email' AS function_name, EXISTS (SELECT FROM pg_proc WHERE proname = 'get_user_id_by_email') AS exists;

-- 4. Check Triggers
SELECT 'on_auth_user_created' AS trigger_name, EXISTS (SELECT FROM pg_trigger WHERE tgname = 'on_auth_user_created') AS exists;
