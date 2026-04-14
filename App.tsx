
import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage.tsx';
import SignupPage from './components/SignupPage.tsx';
import ForgotPassword from './components/ForgotPassword.tsx';
import ResetPassword from './components/ResetPassword.tsx';
import { supabase } from './lib/supabase.ts';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole } from './types.ts';
import HeadteacherDashboard from './components/dashboards/HeadteacherDashboard.tsx';
import TeacherDashboard from './components/dashboards/TeacherDashboard.tsx';
import StudentDashboard from './components/dashboards/StudentDashboard.tsx';
import ParentDashboard from './components/dashboards/ParentDashboard.tsx';
import AdminDashboard from './components/dashboards/AdminDashboard.tsx';
import PendingOnboarding from './components/PendingOnboarding.tsx';
import { SettingsProvider } from './contexts/SettingsContext.tsx';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'login' | 'signup' | 'forgot-password' | 'reset-password'>('login');

  const lastSessionUserId = React.useRef<string | null>(null);
  const loadingTimeoutRef = React.useRef<any>(null);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) throw error;
      setProfile(data);
    } catch (err: any) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.error("Profile Fetch Failed: Network error. Please check if Supabase is reachable.");
      } else {
        console.error("Profile Fetch Failed:", err); if (err.code === 'PGRST303' || err?.message?.includes('JWT expired')) { supabase.auth.signOut(); }
      }
    } finally {
      setLoading(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
  };

  useEffect(() => {
    // Set a safety timeout for initial loading
    loadingTimeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn("Initial loading timed out. Forcing loading to false.");
        setLoading(false);
      }
    }, 10000); // 10 seconds safety timeout

    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        lastSessionUserId.current = session.user.id;
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    });

    // Global Auth listener - only set up once
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset-password');
      }

      const currentUserId = session?.user.id || null;
      
      // Only trigger updates if the user ID actually changed or session was lost
      if (currentUserId !== lastSessionUserId.current || event === 'SIGNED_OUT') {
        lastSessionUserId.current = currentUserId;
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Real-time profile listener - separate effect that depends on user ID
  useEffect(() => {
    let profileSubscription: any = null;
    if (session?.user.id) {
        profileSubscription = supabase
            .channel(`profile-${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${session.user.id}`
                },
                (payload) => {
                    setProfile(payload.new as Profile);
                }
            )
            .subscribe();
    }

    return () => {
        if (profileSubscription) profileSubscription.unsubscribe();
    };
  }, [session?.user.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-400 via-brand-800 to-brand-950"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-brand-200 dark:border-brand-900/50 border-t-brand-600 dark:border-t-brand-400 rounded-full animate-spin shadow-lg"></div>
          <p className="mt-6 text-brand-900 dark:text-brand-100 font-bold tracking-widest uppercase text-sm animate-pulse">SmartSchool</p>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-xs font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider session={session} profile={profile}>
      {view === 'reset-password' ? (
        <ResetPassword onComplete={() => setView('login')} />
      ) : (!session || !profile) ? (
        view === 'forgot-password' ? (
          <ForgotPassword onNavigateToLogin={() => setView('login')} />
        ) : view === 'login' ? (
          <AuthPage 
            onNavigateToSignup={() => setView('signup')} 
            onNavigateToForgotPassword={() => setView('forgot-password')} 
          />
        ) : (
          <SignupPage onNavigateToLogin={() => setView('login')} />
        )
      ) : (!profile.is_onboarded && profile.role !== UserRole.Admin) ? (
        <PendingOnboarding fullName={profile.full_name} />
      ) : (
        <>
          {profile.role === UserRole.Admin && <AdminDashboard session={session} profile={profile} />}
          {profile.role === UserRole.Headteacher && <HeadteacherDashboard session={session} profile={profile} />}
          {profile.role === UserRole.Teacher && <TeacherDashboard session={session} profile={profile} />}
          {profile.role === UserRole.Student && <StudentDashboard session={session} profile={profile} />}
          {profile.role === UserRole.Parent && <ParentDashboard session={session} profile={profile} />}
        </>
      )}
    </SettingsProvider>
  );
};

export default App;
