
import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Profile, School, SubscriptionStatus, UserRole, Announcement, Message } from '../../types.ts';
import { NavItem } from '../../lib/navigation.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { supabase } from '../../lib/supabase.ts';
import AnnouncementBanner from '../common/AnnouncementBanner.tsx';
import { NotificationBell } from '../common/NotificationBell.tsx';

interface DashboardLayoutProps {
  profile: Profile;
  navItems: NavItem[];
  activePage: string | { page: string; conversationId?: string };
  setActivePage: (page: string | { page: string; conversationId?: string }) => void;
  children: React.ReactNode;
  hideSidebar?: boolean;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ profile, navItems, activePage, setActivePage, children, hideSidebar = false }) => {
  const { school, settings, isLoading } = useSettings();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!school?.id || !profile.id) return;

      const today = new Date().toISOString().split('T')[0];
      
      // Fetch active announcements
      const { data: annData } = await supabase
        .from('announcements')
        .select('*')
        .eq('school_id', school.id)
        .gte('expiry_date', today)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (annData) setAnnouncements(annData);

      // Fetch recent messages from conversations where the user is a participant
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .contains('participant_ids', [profile.id]);
      
      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(full_name, avatar_url)')
          .in('conversation_id', conversationIds)
          .neq('sender_id', profile.id) // Don't notify about own messages
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (msgs) setMessages(msgs as any[]);
      }
    };

    if (!isLoading) {
      fetchNotifications();
    }
  }, [school?.id, profile.id, isLoading]);

  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
             <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loading SmartSchool...</p>
        </div>
    );
  }

  const currentPageName = typeof activePage === 'string' ? activePage : activePage.page;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
          {((settings?.logo_url || school?.logo_url) && profile.school_id && (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher)) ? (
            <img 
              src={settings?.logo_url || school?.logo_url || ''} 
              className="w-full h-full object-contain p-1" 
              alt="Logo" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-brand-900 font-black text-2xl">S</span>
          )}
        </div>
        <div className="overflow-hidden">
          <h2 className="font-bold truncate text-sm">
            {(profile.school_id && (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher)) 
              ? (settings?.school_name || school?.name || 'SmartSchool') 
              : (profile.role === UserRole.Admin ? 'Platform Admin' : (profile.role === UserRole.Parent ? 'Parent Portal' : (profile.role === UserRole.Student ? 'Student Portal' : 'SmartSchool')))}
          </h2>
          <span className="text-[10px] uppercase font-bold tracking-widest text-brand-400 block mt-0.5">
              {(profile.school_id && (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher))
                ? (school?.plan_id?.replace(/_/g, ' ') || 'Standard Edition') 
                : (profile.role === UserRole.Admin ? 'Superuser' : (profile.role === UserRole.Parent ? 'Guardian' : (profile.role === UserRole.Student ? 'Learner' : 'Pending Setup')))}
          </span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(false)}
          className="ml-auto p-2 text-brand-200 hover:text-white md:hidden"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <nav className="flex-grow p-4 overflow-y-auto custom-scrollbar">
        {navItems.map(item => {
          const isActive = currentPageName === item.label;
          const isChildActive = item.subItems?.some(sub => sub.label === currentPageName);
          const isExpanded = isActive || isChildActive;
          
          return (
              <div key={item.label} className="mb-1">
                  <button
                      onClick={() => {
                        setActivePage(item.label);
                        if (!item.subItems) setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-sm' : isChildActive ? 'text-white' : 'text-brand-100 hover:bg-white/5 hover:text-white'}`}
                  >
                      <item.icon className={`w-5 h-5 transition-transform ${isActive || isChildActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`} />
                      <span className="font-semibold text-sm">{item.label}</span>
                      {isActive && <div className="ml-auto w-1.5 h-1.5 bg-brand-400 rounded-full"></div>}
                  </button>
                  {isExpanded && item.subItems && (
                      <div className="ml-9 mt-1 space-y-1">
                          {item.subItems.map(sub => {
                              const isSubActive = currentPageName === sub.label;
                              return (
                                  <button 
                                      key={sub.label} 
                                      onClick={() => {
                                        setActivePage(sub.label);
                                        setIsMobileMenuOpen(false);
                                      }}
                                      className={`w-full text-left p-2 text-xs font-medium transition-colors ${isSubActive ? 'text-white' : 'text-brand-200 hover:text-white'}`}
                                  >
                                      {sub.label}
                                  </button>
                              );
                          })}
                      </div>
                  )}
              </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-3 text-brand-300 hover:bg-red-900/40 hover:text-red-100 rounded-xl transition-all group">
          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span className="text-sm font-bold">Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-brand-900 text-white transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      {!hideSidebar && (
          <aside className="hidden md:flex w-64 bg-brand-900 text-white flex-col shrink-0 no-print">
            {sidebarContent}
          </aside>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0 no-print">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 md:hidden"
              >
                <Menu className="w-6 h-6" />
              </button>
              {((settings?.logo_url || school?.logo_url) && profile.school_id && (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher)) && (
                <img 
                  src={settings?.logo_url || school?.logo_url || ''} 
                  alt="School Logo" 
                  className="w-8 h-8 object-contain md:hidden" 
                  referrerPolicy="no-referrer"
                />
              )}
              <h1 className="text-lg font-bold text-gray-800 dark:text-white capitalize truncate">{currentPageName}</h1>
          </div>
          <div className="flex items-center gap-6">
            <NotificationBell 
                userId={profile.id}
                onMessageClick={(id) => setActivePage({ page: 'Messages', conversationId: id })}
            />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">Balance:</span>
              <span className="text-sm font-black text-brand-900 dark:text-white">GHS {Number(profile.credit_balance || 0).toFixed(2)}</span>
            </div>
            <ThemeToggle />
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{profile.full_name}</p>
                <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-tighter">{profile.role}</p>
              </div>
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name}
                  className="w-10 h-10 rounded-xl object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center font-bold text-brand-700 dark:text-brand-400 shadow-inner">
                  {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900 custom-scrollbar">
           <AnnouncementBanner />
           {!school && profile.role !== UserRole.Admin && (
             <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
               <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <div className="text-sm">
                 <p className="font-bold">Account Pending Setup</p>
                 <p>Your account is not yet linked to a school. Please contact your administrator or complete the school registration.</p>
               </div>
             </div>
           )}
           {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
