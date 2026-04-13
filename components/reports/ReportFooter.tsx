import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { FerditLogo } from '../../assets/FerditLogo.tsx';
import { supabase } from '../../lib/supabase.ts';

interface PlatformSettings {
    platform_logo_url: string | null;
    platform_name: string;
    contact_phone: string;
    contact_email: string;
    contact_country: string;
}

export const ReportFooter: React.FC = () => {
    const { settings } = useSettings();
    const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

    useEffect(() => {
        const fetchPlatformSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('platform_settings')
                    .select('*')
                    .eq('id', 1)
                    .single();
                
                if (data && !error) {
                    setPlatformSettings(data);
                }
            } catch (err) {
                console.error("Failed to fetch platform settings", err);
            }
        };
        fetchPlatformSettings();
    }, []);

    const logoUrl = platformSettings?.platform_logo_url;
    const platformName = platformSettings?.platform_name || 'FerdIT School Software';
    const phone = platformSettings?.contact_phone || '+233247823410';
    const email = platformSettings?.contact_email || 'ferditgh@gmail.com';
    const country = platformSettings?.contact_country || 'Ghana';

    return (
        <footer className="w-full mt-auto pt-8 text-xs">
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
                <div className="flex items-center space-x-2">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Platform Logo" className="h-8 w-8 object-contain" />
                    ) : (
                        <FerditLogo className="h-8 w-8" />
                    )}
                </div>
                <div className="text-center md:text-right">
                    <p className="font-semibold">{platformName}</p>
                    <p>{country}, {phone}, {email}</p>
                </div>
            </div>
        </footer>
    );
};
