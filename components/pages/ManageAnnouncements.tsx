import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { Announcement, Profile } from '../../types.ts';

interface ManageAnnouncementsProps {
  session: Session;
  profile: Profile;
}

const ManageAnnouncements: React.FC<ManageAnnouncementsProps> = ({ session, profile }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('expiry_date', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setAnnouncements(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);
  
  const { activeAnnouncements, expiredAnnouncements } = useMemo(() => {
      const active: Announcement[] = [];
      const expired: Announcement[] = [];
      announcements.forEach(ann => {
          if (ann.expiry_date >= today) {
              active.push(ann);
          } else {
              expired.push(ann);
          }
      });
      return { activeAnnouncements: active, expiredAnnouncements: expired };
  }, [announcements, today]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!newMessage.trim() || !newExpiry) {
      setError('Message and expiry date are required.');
      return;
    }

    const { error: insertError } = await supabase.from('announcements').insert({
      message: newMessage,
      expiry_date: newExpiry,
      created_by: session.user.id,
      school_id: profile.school_id
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      // Create notifications for all users in the school
      try {
          const { data: schoolUsers } = await supabase.from('profiles').select('id').eq('school_id', profile.school_id);
          if (schoolUsers && schoolUsers.length > 0) {
              const notifications = schoolUsers.map(u => ({
                  user_id: u.id,
                  title: 'New School Announcement',
                  message: newMessage.substring(0, 100) + (newMessage.length > 100 ? '...' : ''),
                  type: 'announcement'
              }));
              // Insert in batches if many users, but for now just insert
              await supabase.from('notifications').insert(notifications);
          }
      } catch (err) {
          console.error("Failed to create announcement notifications:", err);
      }

      setSuccessMessage('Announcement created successfully!');
      setNewMessage('');
      setNewExpiry('');
      await fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      const { error: deleteError } = await supabase.from('announcements').delete().eq('id', id);
      if (deleteError) {
        setError(deleteError.message);
      } else {
        setSuccessMessage('Announcement deleted.');
        await fetchAnnouncements();
      }
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Manage Announcements</h1>

      <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Create New Announcement</h2>
        {error && <p className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md text-sm">{error}</p>}
        {successMessage && <p className="p-3 mb-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-md text-sm">{successMessage}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message
            </label>
            <textarea
              id="message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-brand-500 focus:border-brand-500"
              placeholder="Enter the announcement text..."
            />
          </div>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto">
              <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiry Date
              </label>
              <input
                id="expiry_date"
                type="date"
                min={today}
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
            >
              Post Announcement
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-8">
        <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Active Announcements</h2>
            {isLoading ? <p>Loading...</p> : activeAnnouncements.length > 0 ? (
                <ul className="space-y-3">
                    {activeAnnouncements.map(ann => (
                        <li key={ann.id} className="flex items-start justify-between bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm">
                            <div>
                                <p className="text-gray-800 dark:text-gray-200">{ann.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expires on: {new Date(ann.expiry_date).toDateString()}</p>
                            </div>
                            <button onClick={() => handleDelete(ann.id)} className="p-1.5 ml-4 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" aria-label="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-gray-500 dark:text-gray-400">No active announcements.</p>}
        </div>
        <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Expired Announcements</h2>
             {isLoading ? <p>Loading...</p> : expiredAnnouncements.length > 0 ? (
                <ul className="space-y-3">
                    {expiredAnnouncements.map(ann => (
                        <li key={ann.id} className="flex items-start justify-between bg-white dark:bg-gray-800 p-4 rounded-md shadow-sm opacity-60">
                            <div>
                                <p className="text-gray-800 dark:text-gray-200">{ann.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Expired on: {new Date(ann.expiry_date).toDateString()}</p>
                            </div>
                             <button onClick={() => handleDelete(ann.id)} className="p-1.5 ml-4 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" aria-label="Delete">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </li>
                    ))}
                </ul>
             ) : <p className="text-gray-500 dark:text-gray-400">No expired announcements.</p>}
        </div>
      </div>
    </div>
  );
};

export default ManageAnnouncements;