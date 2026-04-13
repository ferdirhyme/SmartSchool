import React from 'react';
import { UserRole } from '../../types.ts';
import { CustomAdBanner } from './CustomAdBanner.tsx';
import { AdSenseBanner } from './AdSenseBanner.tsx';

interface AdContainerProps {
    profileRole?: string;
}

export const AdContainer: React.FC<AdContainerProps> = ({ profileRole }) => {
    // Privacy & Compliance: NEVER show ads to students
    if (profileRole === UserRole.Student) {
        return null;
    }

    return (
        <div className="w-full space-y-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 border-dashed">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">
                Sponsors & Offers
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Internal / Custom Ad */}
                <CustomAdBanner />
                
                {/* Third-Party / Google AdSense */}
                <AdSenseBanner />
            </div>
        </div>
    );
};
