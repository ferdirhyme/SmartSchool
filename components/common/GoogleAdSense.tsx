import React, { useEffect, useRef } from 'react';

interface GoogleAdSenseProps {
  client?: string;
  slot?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
}

export const GoogleAdSense: React.FC<GoogleAdSenseProps> = ({
  client = 'ca-pub-1927885610381497',
  slot = '4773328065',
  format = 'auto',
  responsive = true,
  className = '',
}) => {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e: any) {
        if (e.message && !e.message.includes('already have ads')) {
          console.error('AdSense error:', e);
        }
      }
    }
  }, []);

  return (
    <div className={`w-full overflow-hidden flex justify-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 relative min-h-[100px] items-center ${className}`}>
      <div className="absolute top-0 left-0 bg-gray-200 dark:bg-gray-700 text-gray-500 text-[9px] px-1.5 py-0.5 rounded-br font-bold uppercase tracking-wider z-10">
        Advertisement
      </div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
      <span className="text-xs text-gray-400 dark:text-gray-500 absolute pointer-events-none">
        Google AdSense Space
      </span>
    </div>
  );
};
