import React from 'react';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { FerditLogo } from '../../assets/FerditLogo.tsx';

export const ReportFooter: React.FC = () => {
    const { settings } = useSettings();

    return (
        <footer className="w-full mt-auto pt-8 text-xs">
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
                <div className="flex items-center space-x-2">
                    <FerditLogo className="h-8 w-8" />
                    <span className="font-bold text-lg">FerdIT</span>
                </div>
                <div className="text-center md:text-right">
                    <p className="font-semibold">FerdIT School Software</p>
                    <p>Ghana, +233247823410, ferditgh@gmail.com</p>
                </div>
            </div>
        </footer>
    );
};
