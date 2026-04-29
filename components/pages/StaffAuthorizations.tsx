
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile } from '../../types.ts';
import { profileService } from '../../modules/core/profile.service.ts';
import { ShieldCheck, Clock, UserCheck } from 'lucide-react';

interface StaffAuthorizationsProps {
  profile: Profile;
  setActivePage: (page: string | { page: string; teacherProfile?: Profile }) => void;
}

const StaffAuthorizations: React.FC<StaffAuthorizationsProps> = ({ profile, setActivePage }) => {
  const [pendingTeachers, setPendingTeachers] = useState<Profile[]>([]);
  const [incompleteTeachers, setIncompleteTeachers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, allSchoolStaffRes] = await Promise.all([
        profileService.getPendingTeachers(profile.school_id),
        supabase.from('profiles').select('*').eq('school_id', profile.school_id).eq('role', 'Teacher').eq('is_onboarded', true)
      ]);

      if (pendingRes.error) throw new Error(pendingRes.error);
      
      // Find which authorized teachers are missing a record in the 'teachers' table
      const { data: teacherRecords } = await supabase.from('teachers').select('email').eq('school_id', profile.school_id);
      const teacherEmails = new Set((teacherRecords || []).map(t => t.email));
      const incomplete = (allSchoolStaffRes.data || []).filter(p => !teacherEmails.has(p.email));

      if (pendingRes.data) setPendingTeachers(pendingRes.data);
      setIncompleteTeachers(incomplete);
    } catch (err) {
      console.error("Failed to fetch authorization data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthorize = async (teacher: Profile) => {
    if (!profile.school_id) {
      alert("Error: Your account is not linked to a school.");
      return;
    }

    setIsActionLoading(true);
    try {
      const { error } = await profileService.authorizeUser(teacher.id, profile.school_id);
      if (error) throw new Error(error);
      
      setPendingTeachers(pendingTeachers.filter(t => t.id !== teacher.id));
      
      // Redirect to Add Teacher with the authorized teacher's profile
      setActivePage({ 
        page: 'Add Teacher', 
        teacherProfile: { ...teacher, school_id: profile.school_id, is_onboarded: true } 
      });
      
    } catch (err: any) {
      console.error('Authorization failed:', err);
      // Try to parse the standard JSON error if it exists
      let errorMessage = 'Failed to authorize teacher. This is likely due to database permissions (RLS).';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          errorMessage = `Auth Error: ${parsed.error}`;
          if (parsed.code) errorMessage += ` (${parsed.code})`;
        }
      } catch (e) {
        errorMessage = err.message || errorMessage;
      }
      alert(errorMessage);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Authorizations</h1>
          <p className="text-gray-500 dark:text-gray-400">Authorize new teachers and link them to your school.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingTeachers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Pending Authorization</h2>
            {pendingTeachers.map(teacher => (
              <div key={teacher.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{teacher.full_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>Joined {new Date(teacher.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleAuthorize(teacher)}
                  disabled={isActionLoading}
                  className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-500/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Authorize & Link to School
                </button>
              </div>
            ))}
          </div>
        )}

        {incompleteTeachers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Awaiting Profile Completion</h2>
            {incompleteTeachers.map(teacher => (
              <div key={teacher.id} className="bg-amber-50/50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{teacher.full_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Authorized - Profile Incomplete</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setActivePage({ page: 'Add Teacher', teacherProfile: teacher })}
                  className="bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  Complete Profile
                </button>
              </div>
            ))}
          </div>
        )}

        {pendingTeachers.length === 0 && incompleteTeachers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <ShieldCheck className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Pending Actions</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs text-center mt-1">
              All staff members are authorized and have completed profiles.
            </p>
          </div>
        )}
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> Authorizing a teacher will grant them full access to your school's data based on their role. Please ensure you recognize the individual before authorizing.
        </p>
      </div>
    </div>
  );
};

export default StaffAuthorizations;
