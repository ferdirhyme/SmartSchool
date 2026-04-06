import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Announcement } from '../../types.ts';
import { AnnouncementIcon } from '../icons/NavIcons.tsx';
import { useSettings } from '../../contexts/SettingsContext.tsx';

const AnnouncementBanner: React.FC = () => {
  const { school } = useSettings();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (!school?.id) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('school_id', school.id)
        .gte('expiry_date', today)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message === 'TypeError: Failed to fetch' || error.message === 'Failed to fetch') {
          console.warn('Announcements fetch blocked (likely by an adblocker).');
        } else {
          console.error('Error fetching announcements:', error);
        }
      } else {
        setAnnouncements(data || []);
      }
      setIsLoading(false);
    };

    fetchAnnouncements();
  }, [school?.id]);

  const handleDismiss = (id: string) => {
    const newDismissedIds = [...dismissedIds, id];
    setDismissedIds(newDismissedIds);
  };

  const activeAnnouncements = announcements.filter(
    (ann) => !dismissedIds.includes(ann.id)
  );
  
  if (isLoading || activeAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {activeAnnouncements.map((ann) => (
        <div
          key={ann.id}
          className="bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500 text-blue-800 dark:text-blue-100 p-4 rounded-r-lg shadow-md"
          role="alert"
        >
          <div className="flex">
            <div className="py-1">
              <AnnouncementIcon className="h-6 w-6 text-blue-500 mr-4" />
            </div>
            <div className="flex-grow">
              <p className="font-bold">Announcement</p>
              <p className="text-sm">{ann.message}</p>
            </div>
            <button 
              onClick={() => handleDismiss(ann.id)}
              className="ml-4 p-1 rounded-full text-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800"
              aria-label="Dismiss announcement"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;