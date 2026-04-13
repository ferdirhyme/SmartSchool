
import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Profile, School, SubscriptionStatus, UserRole, Announcement, Message } from '../../types.ts';
import { NavItem } from '../../lib/navigation.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { supabase } from '../../lib/supabase.ts';
import AnnouncementBanner from '../common/AnnouncementBanner.tsx';
import { NotificationBell } from '../common/NotificationBell.tsx';
import { CustomPromo } from '../promotions/CustomPromo.tsx';

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
  const [logoError, setLogoError] = useState(false);

  const currentPageName = typeof activePage === 'string' ? activePage : activePage.page;

  const logoUrl = (settings?.logo_url && settings.logo_url.trim() !== '') 
    ? settings.logo_url 
    : (school?.logo_url && school.logo_url.trim() !== '') 
      ? school.logo_url 
      : null;

  // Reset logo error when URL changes
  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10 flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner shrink-0 overflow-hidden">
          {(logoUrl && !logoError) ? (
            <img 
              key={logoUrl}
              src={logoUrl} 
              className="w-full h-full object-contain p-1" 
              alt="Logo" 
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span key={school?.name || settings?.school_name} className="text-brand-900 font-black text-2xl">
              {(school?.name || settings?.school_name || 'S')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="overflow-hidden">
          <h2 className="font-bold truncate text-sm">
            {(school?.name || settings?.school_name) 
              ? (school?.name || settings?.school_name) 
              : (profile.role === UserRole.Admin ? 'Platform Admin' : (profile.role === UserRole.Parent ? 'Parent Portal' : (profile.role === UserRole.Student ? 'Student Portal' : 'SmartSchool')))}
          </h2>
          <span className="text-[10px] uppercase font-bold tracking-widest text-brand-400 block mt-0.5">
              {(profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher)
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
      
      <nav className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-1">
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-brand-800 text-white shadow-sm' : isChildActive ? 'text-white' : 'text-brand-100/70 hover:bg-brand-800/50 hover:text-white'}`}
                  >
                      <item.icon className={`w-5 h-5 transition-transform ${isActive || isChildActive ? 'scale-110 text-brand-300' : 'group-hover:scale-110 group-hover:text-brand-300'}`} />
                      <span className="font-medium text-sm tracking-wide">{item.label}</span>
                      {isActive && <div className="ml-auto w-1.5 h-1.5 bg-brand-400 rounded-full shadow-[0_0_8px_rgba(45,212,191,0.8)]"></div>}
                  </button>
                  {isExpanded && item.subItems && (
                      <div className="ml-9 mt-1 mb-2 space-y-1 relative before:absolute before:inset-y-0 before:-left-4 before:w-px before:bg-brand-800">
                          {item.subItems.map(sub => {
                              const isSubActive = currentPageName === sub.label;
                              return (
                                  <button 
                                      key={sub.label} 
                                      onClick={() => {
                                        setActivePage(sub.label);
                                        setIsMobileMenuOpen(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md transition-all relative ${isSubActive ? 'text-white bg-brand-800/50 before:absolute before:top-1/2 before:-left-4 before:w-4 before:h-px before:bg-brand-400' : 'text-brand-200/70 hover:text-white hover:bg-brand-800/30'}`}
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

      <div className="p-4 border-t border-brand-800">
        {profile.role !== UserRole.Student && (
          <div className="mb-4">
            <CustomPromo layout="sidebar" />
          </div>
        )}
        <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2.5 text-brand-200/70 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all group">
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span className="text-sm font-medium tracking-wide">Sign Out</span>
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
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
        <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 no-print transition-colors duration-200">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:hidden rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              {(logoUrl && !logoError) && (
                <img 
                  key={`header-${logoUrl}`}
                  src={logoUrl} 
                  alt="School Logo" 
                  className="w-8 h-8 object-contain md:hidden" 
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                />
              )}
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white capitalize truncate tracking-tight">{currentPageName}</h1>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <NotificationBell 
                userId={profile.id}
                onMessageClick={(id) => setActivePage({ page: 'Messages', conversationId: id })}
            />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-full">
              <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]"></div>
              <span className="text-xs font-medium text-brand-700 dark:text-brand-300 tracking-wide">Balance:</span>
              <span className="text-sm font-bold text-brand-900 dark:text-brand-100">GHS {Number(profile.credit_balance || 0).toFixed(2)}</span>
            </div>
            <ThemeToggle />
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">{profile.full_name}</p>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1 capitalize">{profile.role.replace('_', ' ')}</p>
              </div>
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-800">
                  {profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar flex flex-col">
           <div className="flex-none">
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
           </div>
           
           <div className="flex-grow">
             {children}
           </div>

           {/* Ads Section - Bottom of screen */}
           {profile.role !== UserRole.Student && (
             <div className="mt-8 shrink-0 py-6 border-t border-gray-200 dark:border-gray-800 border-dashed no-print">
                 <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-4">
                   Sponsors & Offers
                 </h3>
                 <CustomPromo layout="horizontal" />
             </div>
           )}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
