-- Restore Super Admin Profile
INSERT INTO public.profiles (id, full_name, role, is_onboarded)
SELECT id, 'Super Admin', 'Admin', true
FROM auth.users
WHERE email = 'ferdagbatey@gmail.com'
ON CONFLICT (id) DO NOTHING;
