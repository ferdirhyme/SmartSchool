import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { AppNotification, Announcement, Message } from '../../types';
import { Bell, Check, Trash2, ExternalLink, Info, AlertCircle, CheckCircle, XCircle, MessageSquare, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationBellProps {
    userId: string;
    onMessageClick?: (conversationId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
    userId, 
    onMessageClick 
}) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        
        // Subscribe to real-time notifications
        const channel = supabase
            .channel(`notifications-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const newNotification = payload.new as AppNotification;
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                    
                    // Show browser notification if permitted
                    if (window.Notification && window.Notification.permission === 'granted') {
                        new window.Notification(newNotification.title, {
                            body: newNotification.message,
                        });
                    }
                }
            )
            .subscribe();

        // Request notification permission
        if (window.Notification && window.Notification.permission === 'default') {
            window.Notification.requestPermission();
        }

        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            channel.unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userId]);

    const fetchNotifications = async () => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching notifications:', error);
        } else {
            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        }
    };

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const clearAllNotifications = async () => {
        // Optimistic update
        setNotifications([]);
        setUnreadCount(0);

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Error clearing notifications:', error);
            fetchNotifications();
        }
    };

    const deleteNotification = async (id: string) => {
        // Optimistic update
        const deleted = notifications.find(n => n.id === id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (deleted && !deleted.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting notification:', error);
            // Revert on error if needed, but usually better to stay optimistic for UX
            fetchNotifications(); 
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
            case 'announcement': return <Megaphone className="w-4 h-4 text-purple-500" />;
            default: return <Info className="w-4 h-4 text-brand-500" />;
        }
    };

    // Badge count should only reflect the actual unread notifications from the database
    // Legacy props (messages/announcements) are shown for convenience but shouldn't double-count
    const totalUnread = unreadCount;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none"
            >
                <Bell className="w-6 h-6" />
                {totalUnread > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                        {totalUnread > 9 ? '9+' : totalUnread}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden"
                    >
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAllNotifications}
                                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {/* Unified Notifications */}
                            {notifications.length > 0 ? (
                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                
                                                const link = notification.link;
                                                // Start deletion immediately
                                                deleteNotification(notification.id);
                                                
                                                if (link) {
                                                    // Small delay to allow state update to feel "immediate" before navigation
                                                    setTimeout(() => {
                                                        window.location.href = link;
                                                    }, 100);
                                                }
                                            }}
                                            className={`p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer ${!notification.is_read ? 'bg-brand-50/30 dark:bg-brand-900/10' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="mt-1 flex-shrink-0">
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={`text-sm font-bold text-gray-900 dark:text-white leading-tight ${!notification.is_read ? 'pr-2' : ''}`}>
                                                            {notification.title}
                                                        </p>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {!notification.is_read && (
                                                                <button
                                                                    onClick={() => markAsRead(notification.id)}
                                                                    className="p-1 text-gray-400 hover:text-brand-600 transition-colors"
                                                                    title="Mark as read"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => deleteNotification(notification.id)}
                                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                                            {new Date(notification.created_at).toLocaleDateString()} at {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {notification.link && (
                                                            <a
                                                                href={notification.link}
                                                                className="flex items-center gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest hover:underline"
                                                            >
                                                                View <ExternalLink className="w-2.5 h-2.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Bell className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-300">No notifications yet</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-center">
                            <button className="text-[10px] font-bold text-gray-500 dark:text-gray-300 uppercase tracking-widest hover:text-gray-700 dark:hover:text-white transition-colors">
                                View all activity
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
