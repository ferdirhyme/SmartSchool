import React, { useEffect, useRef } from 'react';

interface ExternalPromoProps {
    client?: string;
    slot?: string;
    format?: string;
    responsive?: boolean;
}

export const ExternalPromo: React.FC<ExternalPromoProps> = ({
    client = "ca-pub-XXXXXXXXXXXXXXXX", // Replace with your actual AdSense Client ID
    slot = "XXXXXXXXXX", // Replace with your actual AdSense Slot ID
    format = "auto",
    responsive = true
}) => {
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
            try {
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (err: any) {
                if (err.message && !err.message.includes('already have ads')) {
                    console.error("AdSense error:", err);
                }
            }
        }
    }, []);

    return (
        <div className="w-full overflow-hidden text-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-2 relative min-h-[100px] flex items-center justify-center">
            <div className="absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-gray-500 text-[9px] px-1.5 py-0.5 rounded-br font-bold uppercase tracking-wider z-10">
                Advertisement
            </div>
            
            {/* The actual AdSense tag */}
            <ins 
                ref={adRef}
                className="adsbygoogle w-full"
                style={{ display: 'block' }}
                data-ad-client={client}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? "true" : "false"}
            ></ins>

            {/* Placeholder text for development environment where ads might not load */}
            <span className="text-xs text-gray-400 dark:text-gray-500 absolute pointer-events-none">
                Google AdSense Space
            </span>
        </div>
    );
};
