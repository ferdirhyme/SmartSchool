import React, { useState, FormEvent, useCallback } from 'react';
import { UserRole } from '../types.ts';
import { HeadteacherIcon, TeacherIcon, StudentIcon, ParentIcon } from './icons/UserIcons.tsx';
import { supabase } from '../lib/supabase.ts';

const roleConfig = {
  [UserRole.Headteacher]: {
    icon: HeadteacherIcon,
    color: 'text-red-500',
    hoverColor: 'hover:bg-red-100',
    activeColor: 'bg-red-500',
  },
  [UserRole.Teacher]: {
    icon: TeacherIcon,
    color: 'text-blue-500',
    hoverColor: 'hover:bg-blue-100',
    activeColor: 'bg-blue-500',
  },
  [UserRole.Student]: {
    icon: StudentIcon,
    color: 'text-green-500',
    hoverColor: 'hover:bg-green-100',
    activeColor: 'bg-green-500',
  },
  [UserRole.Parent]: {
    icon: ParentIcon,
    color: 'text-yellow-500',
    hoverColor: 'hover:bg-yellow-100',
    activeColor: 'bg-yellow-500',
  },
};

interface AuthPageProps {
  onNavigateToSignup: () => void;
  onNavigateToForgotPassword: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onNavigateToSignup, onNavigateToForgotPassword }) => {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.Teacher);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError(error.message);
    }
    // On success, the onAuthStateChange listener in App.tsx will handle the session.

    setIsLoading(false);
  }, [email, password]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:grid lg:grid-cols-2 xl:grid-cols-5">
      <div className="hidden lg:flex flex-col items-center justify-center bg-brand-600 p-12 text-center text-white xl:col-span-2">
          <div className="inline-block p-4 bg-white/20 rounded-full mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-9-5.747h18M5.47 16.64l13.06-9.28M5.47 7.36l13.06 9.28" />
              </svg>
          </div>
          <h1 className="text-4xl font-bold">Welcome to SmartSchool</h1>
          <p className="mt-4 text-lg text-brand-100 max-w-sm">
            A modern, integrated platform for seamless school management.
          </p>
      </div>
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:py-16 lg:px-8 xl:col-span-3">
        <div className="w-full max-w-md">
            <div className="text-center mb-8">
                <div className="lg:hidden inline-block p-3 bg-brand-600 rounded-full mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-9-5.747h18M5.47 16.64l13.06-9.28M5.47 7.36l13.06 9.28" />
                    </svg>
                </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Sign in to your account</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">Welcome back! Please enter your details.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
              <form onSubmit={handleLogin}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">I am a...</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(roleConfig) as Array<keyof typeof roleConfig>)
                      .filter(role => role === UserRole.Headteacher || role === UserRole.Teacher)
                      .map((role) => {
                      const config = roleConfig[role];
                      const Icon = config.icon;
                      const isActive = activeRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setActiveRole(role)}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                            isActive
                              ? `${config.activeColor} text-white border-transparent shadow-md`
                              : `bg-white dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 ${config.hoverColor} dark:hover:bg-gray-600 ${config.color}`
                          }`}
                        >
                          <Icon className="w-6 h-6 mb-1.5" />
                          <span className="text-sm font-semibold">{role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                
                {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}

                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 ${
                      isLoading
                        ? 'bg-brand-400 cursor-not-allowed'
                        : 'bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-brand-500'
                    }`}
                  >
                    {isLoading ? (
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center text-sm space-y-2">
                <p className="text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <button
                        onClick={onNavigateToSignup}
                        className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 focus:outline-none"
                    >
                        Sign up
                    </button>
                </p>
                <button
                    type="button"
                    onClick={onNavigateToForgotPassword}
                    className="font-medium text-gray-500 hover:text-gray-400 focus:outline-none"
                >
                    Forgot your password?
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
