
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

  useEffect(() => {
    // Admin auto-fix for missing RPC
    if (profile?.role === 'Admin') {
        const checkAndFixRPC = async () => {
            try {
                const { error: testError } = await supabase.rpc('get_teacher_id_by_auth_email');
                if (testError && (testError.message.includes('Could not find the function') || testError.code === 'PGRST202')) {
                    const fixScript = `
CREATE OR REPLACE FUNCTION public.get_teacher_id_by_auth_email()
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT id 
        FROM public.teachers 
        WHERE email = (auth.jwt() ->> 'email')
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Fix transactions RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Teachers select school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers insert school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers update school data" ON public.transactions;
DROP POLICY IF EXISTS "Headteachers manage school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers manage school data" ON public.transactions;

CREATE POLICY "Transactions: Viewable" ON public.transactions
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Transactions: Insertable" ON public.transactions
    FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Transactions: Updatable" ON public.transactions
    FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Transactions: Deletable" ON public.transactions
    FOR DELETE USING (public.is_admin());
GRANT ALL ON TABLE public.transactions TO authenticated, service_role;

-- Add assessment type columns if missing
ALTER TABLE public.student_assessments ADD COLUMN IF NOT EXISTS assessment_type TEXT DEFAULT 'Regular';
ALTER TABLE public.student_assessments ADD COLUMN IF NOT EXISTS mock_tag TEXT DEFAULT 'N/A';
UPDATE public.student_assessments SET assessment_type = 'Regular' WHERE assessment_type IS NULL;
UPDATE public.student_assessments SET mock_tag = 'N/A' WHERE mock_tag IS NULL;

-- Fix unique constraint for assessments
DO $$ 
BEGIN
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_unique_entry;
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_school_unique;
    ALTER TABLE public.student_assessments DROP CONSTRAINT IF EXISTS student_assessments_composite_key;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_assessments_full_composite_key') THEN
        ALTER TABLE public.student_assessments 
        ADD CONSTRAINT student_assessments_full_composite_key 
        UNIQUE (school_id, student_id, class_id, subject_id, term, year, assessment_type, mock_tag);
    END IF;
END $$;

-- Credit Balance Trigger
CREATE OR REPLACE FUNCTION public.handle_transaction_success()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
        UPDATE public.profiles
        SET credit_balance = COALESCE(credit_balance, 0) + NEW.amount
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_success ON public.transactions;
CREATE TRIGGER on_transaction_success
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transaction_success();
`;
                    await supabase.rpc('execute_admin_sql', { sql_script: fixScript });
                    console.log("Auto-fixed get_teacher_id_by_auth_email RPC.");
                }
            } catch (e) {
                console.error("Failed to check/fix RPC:", e);
            }
        };
        checkAndFixRPC();
    }
  }, [profile?.role]);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (error) throw error;
      setProfile(data);

      // Track platform usage (device density)
      const ua = navigator.userAgent;
      let deviceType = "Desktop";
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) deviceType = "Tablet";
      else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) deviceType = "Mobile";

      supabase.from('platform_usage').upsert({
        user_id: uid,
        device_type: deviceType,
        browser: ua.split(') ')[1]?.split(' ')[0] || 'Unknown',
        os: navigator.platform,
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id, device_type' }).then(({ error }) => {
          if (error && error.code !== 'PGRST116') { // Ignore if table doesn't exist yet
              // silent fail for usage tracking
          }
      });

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
      ) : profile.is_suspended ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Suspended</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your account has been suspended by the platform administrator. Please contact support if you believe this is an error.
            </p>
            <button 
              onClick={() => supabase.auth.signOut()}
              className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>
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
