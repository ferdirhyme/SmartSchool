
import React, { useState, FormEvent, useCallback } from 'react';
import { UserRole } from '../types.ts';
import { HeadteacherIcon, TeacherIcon } from './icons/UserIcons.tsx';
import { supabase } from '../lib/supabase.ts';

interface SignupPageProps {
  onNavigateToLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onNavigateToLogin }) => {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.Teacher);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignup = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: activeRole }
        }
      });

      if (authError) throw authError;

      setSuccessMessage('Registration successful! Please check your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, fullName, email, password, confirmPassword]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Start Your Journey</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Scale your school with SmartSchool</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              type="button"
              onClick={() => setActiveRole(UserRole.Headteacher)}
              className={`p-3 border-2 rounded-xl flex flex-col items-center transition-all ${activeRole === UserRole.Headteacher ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-500' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <HeadteacherIcon className={`w-6 h-6 mb-1 ${activeRole === UserRole.Headteacher ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`} />
              <span className={`text-xs font-bold ${activeRole === UserRole.Headteacher ? 'text-brand-700 dark:text-brand-300' : 'text-gray-500'}`}>Headteacher</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRole(UserRole.Teacher)}
              className={`p-3 border-2 rounded-xl flex flex-col items-center transition-all ${activeRole === UserRole.Teacher ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-500' : 'border-gray-200 dark:border-gray-700'}`}
            >
              <TeacherIcon className={`w-6 h-6 mb-1 ${activeRole === UserRole.Teacher ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`} />
              <span className={`text-xs font-bold ${activeRole === UserRole.Teacher ? 'text-brand-700 dark:text-brand-300' : 'text-gray-500'}`}>Teacher</span>
            </button>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-tight">
              {activeRole === UserRole.Headteacher && "As a Headteacher, you will manage school operations. Your account must be linked to a school by a Superadmin."}
              {activeRole === UserRole.Teacher && "As a Teacher, you will manage classes and assessments. Your account must be linked to a school by a Superadmin."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Full Name</label>
            <input required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Confirm</label>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          {successMessage && <p className="text-sm text-green-500 font-medium">{successMessage}</p>}

          <button type="submit" disabled={isLoading} className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-brand-500/20">
            {isLoading ? 'Processing...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account? <button onClick={onNavigateToLogin} className="text-brand-600 dark:text-brand-400 font-bold hover:underline">Sign In</button>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
