import React, { useState, FormEvent, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserRole } from '../types.ts';
import { HeadteacherIcon, TeacherIcon, StudentIcon, ParentIcon } from './icons/UserIcons.tsx';
import { supabase } from '../lib/supabase.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';

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
  const { platformSettings } = useSettings();
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.Teacher);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="hidden lg:flex flex-col items-center justify-center bg-brand-900 p-12 text-center text-white xl:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-400 via-brand-800 to-brand-950"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-block p-4 bg-white/10 backdrop-blur-md rounded-2xl mb-8 shadow-2xl border border-white/20 overflow-hidden w-24 h-24 flex items-center justify-center">
                {platformSettings?.platform_logo_url ? (
                  <img src={platformSettings.platform_logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-9-5.747h18M5.47 16.64l13.06-9.28M5.47 7.36l13.06 9.28" />
                  </svg>
                )}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">Welcome to {platformSettings?.platform_name || 'SmartSchool'}</h1>
            <p className="text-lg text-brand-100 max-w-sm font-medium leading-relaxed">
              A modern, integrated platform for seamless school management.
            </p>
          </div>
      </div>
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:py-16 lg:px-8 xl:col-span-3">
        <div className="w-full max-w-md">
            <div className="text-center mb-10">
                <div className="lg:hidden inline-block p-3 bg-brand-600 rounded-xl mb-6 shadow-md overflow-hidden w-16 h-16 flex items-center justify-center">
                    {platformSettings?.platform_logo_url ? (
                      <img src={platformSettings.platform_logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v11.494m-9-5.747h18M5.47 16.64l13.06-9.28M5.47 7.36l13.06 9.28" />
                      </svg>
                    )}
                </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Sign in to your account</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Welcome back! Please enter your details.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 p-8 sm:p-10">
              <form onSubmit={handleLogin}>
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">I am a...</label>
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
                          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                            isActive
                              ? `border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 shadow-sm`
                              : `border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400`
                          }`}
                        >
                          <Icon className={`w-6 h-6 mb-2 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`} />
                          <span className="text-sm font-semibold capitalize">{role.replace('_', ' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
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
                      className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white dark:bg-gray-700 dark:text-white transition-shadow"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white dark:bg-gray-700 dark:text-white pr-10 transition-shadow"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {error && <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</p>}

                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white transition-all duration-200 ${
                      isLoading
                        ? 'bg-brand-400 cursor-not-allowed'
                        : 'bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-brand-500 hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={onNavigateToSignup}
                    className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToForgotPassword}
                    className="w-full flex justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
