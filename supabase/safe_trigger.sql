CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Attempt to insert into profiles
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, is_onboarded)
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
      CASE 
        WHEN new.email = 'ferdagbatey@gmail.com' THEN 'Admin'::public.user_role
        ELSE (COALESCE(new.raw_user_meta_data->>'role', 'Teacher'))::public.user_role
      END,
      FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors to ensure user signup succeeds
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
