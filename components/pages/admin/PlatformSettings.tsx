import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase.ts';
import ImageUpload from '../../common/ImageUpload.tsx';
import { Settings, Save } from 'lucide-react';

interface PlatformSettingsData {
    id: number;
    platform_logo_url: string | null;
    platform_name: string;
    contact_phone: string;
    contact_email: string;
    contact_country: string;
}

export const PlatformSettingsComponent: React.FC = () => {
    const [settings, setSettings] = useState<PlatformSettingsData>({
        id: 1,
        platform_logo_url: null,
        platform_name: 'FerdIT School Software',
        contact_phone: '+233247823410',
        contact_email: 'ferditgh@gmail.com',
        contact_country: 'Ghana',
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('platform_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error fetching platform settings:", error);
                // We don't throw here because the table might not exist yet
            }
            if (data) {
                setSettings(data);
            }
        } catch (err: any) {
            console.error("Failed to load platform settings", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        setError('');

        try {
            let logo_url = settings.platform_logo_url;

            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `platform-logo-${Date.now()}.${fileExt}`;
                const filePath = `platform/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, logoFile);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                logo_url = urlData.publicUrl;
            }

            const payload = {
                ...settings,
                platform_logo_url: logo_url,
                updated_at: new Date().toISOString()
            };

            const { error: upsertError } = await supabase
                .from('platform_settings')
                .upsert(payload, { onConflict: 'id' });

            if (upsertError) throw upsertError;

            setSettings(payload);
            setLogoFile(null);
            setMessage('Platform settings saved successfully.');
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save platform settings. Please ensure the platform_settings table exists in your database.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div>Loading platform settings...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Platform Settings</h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {message && <div className="p-4 bg-green-100 text-green-800 rounded-lg">{message}</div>}
            {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-brand-600" />
                        Platform Branding
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Platform Logo
                            </label>
                            <ImageUpload 
                                onFileChange={setLogoFile} 
                                defaultImageUrl={settings.platform_logo_url || undefined} 
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                This logo will appear in the footer of all generated reports.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Platform Name
                            </label>
                            <input
                                type="text"
                                value={settings.platform_name}
                                onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4 text-brand-600" />
                        Contact Information
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Contact Phone
                            </label>
                            <input
                                type="text"
                                value={settings.contact_phone}
                                onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Contact Email
                            </label>
                            <input
                                type="email"
                                value={settings.contact_email}
                                onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Country
                            </label>
                            <input
                                type="text"
                                value={settings.contact_country}
                                onChange={(e) => setSettings({ ...settings, contact_country: e.target.value })}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
