
import React from 'react';
import { supabase } from '../lib/supabase.ts';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';

interface PendingOnboardingProps {
  fullName: string;
}

const PendingOnboarding: React.FC<PendingOnboardingProps> = ({ fullName }) => {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 text-center border border-gray-100 dark:border-gray-700">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400 animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Pending Authorization</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Hello <span className="font-bold text-gray-900 dark:text-white">{fullName}</span>, your account has been created successfully. 
          A <span className="font-bold">Headteacher</span> or <span className="font-bold">Superadmin</span> needs to authorize your account and assign you to a school before you can access the dashboard.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-8 flex items-start gap-3 text-left">
          <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This process usually takes less than 24 hours. You will be able to access your school's data once authorized.
          </p>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default PendingOnboarding;
