-- Create ads table
CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    link_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view active ads" ON ads;
DROP POLICY IF EXISTS "Admins have full access to ads" ON ads;
DROP POLICY IF EXISTS "Admins can manage ads" ON ads;

-- Public read access for active ads
CREATE POLICY "Anyone can view active ads" ON ads
    FOR SELECT USING (is_active = true);

-- Admin full access (Explicitly adding WITH CHECK for INSERT/UPDATE)
CREATE POLICY "Admins can manage ads" ON ads
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );

-- Ensure the current user is an Admin (Bootstrap)
-- This is a safety measure to ensure the user has the correct role in the profiles table
UPDATE public.profiles 
SET role = 'Admin' 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'ferdagbatey@gmail.com');
