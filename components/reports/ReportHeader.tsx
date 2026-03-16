import React from 'react';
import { useSettings } from '../../contexts/SettingsContext.tsx';

// The title is now rendered by the parent report component
export const ReportHeader: React.FC<{title?: string}> = ({title}) => {
    const { settings } = useSettings();

    return (
        <header className="w-full mb-4">
            <div className="flex flex-col md:flex-row items-center justify-between border-b-2 border-black pb-4 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="School Logo" className="h-24 w-24 object-contain" />
                    ) : (
                        <div className="h-24 w-24 bg-gray-200 flex items-center justify-center text-gray-500">Logo</div>
                    )}
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold uppercase text-[#722F37]">{settings?.school_name || 'School Name'}</h1>
                        <p className="text-sm">{settings?.address}</p>
                        <p className="text-sm">{settings?.phone} | {settings?.email}</p>
                        {settings?.motto && <p className="text-sm italic">"{settings.motto}"</p>}
                    </div>
                </div>
            </div>
             {title && <h2 className="text-center text-xl md:text-2xl font-bold my-4 text-[#722F37]">{title}</h2>}
        </header>
    );
};
