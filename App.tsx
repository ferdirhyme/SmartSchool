
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
        console.error("Profile Fetch Failed:", err);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-900">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
        <p className="mt-4 text-white font-medium tracking-widest uppercase text-xs">SmartSchool SaaS</p>
      </div>
    );
  }

  // If the user is resetting their password, show the ResetPassword component
  // regardless of whether they are fully logged in yet.
  if (view === 'reset-password') {
    return <ResetPassword onComplete={() => setView('login')} />;
  }

  if (!session || !profile) {
    if (view === 'forgot-password') {
      return <ForgotPassword onNavigateToLogin={() => setView('login')} />;
    }
    return view === 'login' ? (
      <AuthPage 
        onNavigateToSignup={() => setView('signup')} 
        onNavigateToForgotPassword={() => setView('forgot-password')} 
      />
    ) : (
      <SignupPage onNavigateToLogin={() => setView('login')} />
    );
  }

  // Check for onboarding status (Superadmins are exempt)
  if (!profile.is_onboarded && profile.role !== UserRole.Admin) {
    return <PendingOnboarding fullName={profile.full_name} />;
  }

  return (
    <SettingsProvider session={session}>
      {profile.role === UserRole.Admin && <AdminDashboard session={session} profile={profile} />}
      {profile.role === UserRole.Headteacher && <HeadteacherDashboard session={session} profile={profile} />}
      {profile.role === UserRole.Teacher && <TeacherDashboard session={session} profile={profile} />}
      {profile.role === UserRole.Student && <StudentDashboard session={session} profile={profile} />}
      {profile.role === UserRole.Parent && <ParentDashboard session={session} profile={profile} />}
    </SettingsProvider>
  );
};

export default App;
