-- 1. Ensure Headteacher is in the enum (just in case!)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Headteacher';

-- 2. Create the debug table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.signup_debug_logs (
    id SERIAL PRIMARY KEY,
    email TEXT,
    error_message TEXT,
    error_state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update the trigger to log errors AND fail the signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role text;
BEGIN
  -- Determine Role Securely
  IF new.email = 'ferditgh@gmail.com' THEN
    assigned_role := 'Admin';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'Teacher');
  END IF;

  BEGIN
    -- Create Profile
    INSERT INTO public.profiles (id, full_name, email, role, is_onboarded)
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
      new.email,
      assigned_role, 
      FALSE
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Auto-populate teachers table if applicable
    IF assigned_role IN ('Teacher', 'Headteacher') THEN
      INSERT INTO public.teachers (full_name, email, staff_id)
      VALUES (
        COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
        new.email,
        -- Fix: If staff_id is empty string, generate a random one
        CASE 
          WHEN new.raw_user_meta_data->>'staff_id' IS NULL OR new.raw_user_meta_data->>'staff_id' = '' 
          THEN 'STAFF-' || substr(md5(new.id::text), 1, 8)
          ELSE new.raw_user_meta_data->>'staff_id'
        END
      )
      ON CONFLICT (staff_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log the exact error to our debug table
    INSERT INTO public.signup_debug_logs (email, error_message, error_state) 
    VALUES (new.email, SQLERRM, SQLSTATE);
    
    -- Re-throw the error so the signup is blocked and no broken account is created
    RAISE EXCEPTION 'Signup failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
