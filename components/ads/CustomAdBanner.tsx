import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';

interface AdData {
    id: string;
    title: string;
    description: string;
    link_url: string;
    image_url: string;
}

export const CustomAdBanner: React.FC = () => {
    const [ads, setAds] = useState<AdData[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                // Fetch all active ads
                const { data, error } = await supabase
                    .from('ads')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (data) setAds(data);
            } catch (err) {
                // Silently fail if the table doesn't exist yet or adblocker blocks it
            } finally {
                setIsLoading(false);
            }
        };

        fetchAds();
    }, []);

    // Rotation logic
    useEffect(() => {
        if (ads.length <= 1) return; // No need to rotate if there's only 1 or 0 ads

        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % ads.length);
        }, 10000); // Rotate every 10 seconds

        return () => clearInterval(interval);
    }, [ads.length]);

    if (isLoading) {
        return <div className="h-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl border border-gray-200 dark:border-gray-700"></div>;
    }

    if (ads.length === 0) {
        return null; // Don't show anything if there are no active ads
    }

    const ad = ads[currentIndex];

    return (
        <div 
            key={ad.id} // Adding key forces a re-render/animation when the ad changes
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md animate-in fade-in duration-500"
        >
            <div className="absolute top-0 right-0 bg-gray-100 dark:bg-gray-700 text-gray-500 text-[9px] px-2 py-0.5 rounded-bl-lg font-bold uppercase tracking-wider z-10">
                Sponsored
            </div>
            <img 
                src={ad.image_url} 
                alt="Ad" 
                className="w-16 h-16 object-cover rounded-lg shrink-0" 
                referrerPolicy="no-referrer" 
            />
            <div className="flex-grow min-w-0">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{ad.title}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{ad.description}</p>
            </div>
            <a 
                href={ad.link_url} 
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 p-2.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
                aria-label="Visit sponsor"
            >
                <ExternalLink className="w-5 h-5" />
            </a>
        </div>
    );
};
