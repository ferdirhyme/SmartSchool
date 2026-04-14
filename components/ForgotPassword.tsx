import React, { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const { platformSettings } = useSettings();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset instructions have been sent to your email.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-brand-100 dark:bg-brand-900/30 rounded-xl mb-4 overflow-hidden w-16 h-16 flex items-center justify-center">
            {platformSettings?.platform_logo_url ? (
              <img src={platformSettings.platform_logo_url} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reset Password</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Enter your email for {platformSettings?.platform_name || 'SmartSchool'} instructions</p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
          {message && <p className="text-sm text-green-600 dark:text-green-400 text-center">{message}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors duration-200 ${
              isLoading
                ? 'bg-brand-400 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-brand-500'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={onNavigateToLogin}
            className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 focus:outline-none"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
