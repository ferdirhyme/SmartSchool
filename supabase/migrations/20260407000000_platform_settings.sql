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

-- RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
ON platform_settings FOR SELECT
USING (true);

CREATE POLICY "Only super admins can update platform settings"
ON platform_settings FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'Admin'
        AND profiles.school_id IS NULL
    )
);
