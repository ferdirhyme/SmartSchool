

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Announcement } from '../../types.ts';
import { UsersIcon, BriefcaseIcon, UserCheckIcon, CashIcon } from '../icons/WidgetIcons.tsx';
import { AddStudentIcon, AddTeacherIcon } from '../icons/ActionIcons.tsx';
import { AnnouncementIcon, ReportsIcon, FeesIcon } from '../icons/NavIcons.tsx';

interface HeadteacherDashboardHomeProps {
  profile: Profile;
  setActivePage: (page: string | { page: string; conversationId?: string }) => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.FC<{ className?: string }>; isLoading: boolean }> = ({ title, value, icon: Icon, isLoading }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-5 transition-all duration-200 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800">
    <div className="bg-brand-50 dark:bg-brand-900/30 p-4 rounded-xl">
      <Icon className="w-7 h-7 text-brand-600 dark:text-brand-400" />
    </div>
    <div>
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      {isLoading ? (
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
      ) : (
        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      )}
    </div>
  </div>
);

const QuickAction: React.FC<{ title: string; icon: React.FC<{ className?: string }>; onClick: () => void; }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl hover:bg-brand-50 dark:hover:bg-gray-700/80 hover:border-brand-200 dark:hover:border-gray-600 transition-all duration-200 group shadow-sm hover:shadow-md">
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-3 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
            <Icon className="w-7 h-7 text-gray-600 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 text-center group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{title}</span>
    </button>
);

const HeadteacherDashboardHome: React.FC<HeadteacherDashboardHomeProps> = ({ profile, setActivePage }) => {
    const [stats, setStats] = useState({ studentCount: 0, teacherCount: 0, studentAttendance: 0 });
    const [financials, setFinancials] = useState({ collected: 0 });
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [incompleteProfiles, setIncompleteProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const today = new Date().toISOString().split('T')[0];
                const currentYear = new Date().getFullYear();

                const [
                    { count: studentCount }, 
                    { count: teacherCount }, 
                    { count: presentStudents }, 
                    { data: feeData },
                    { data: announcementData },
                    profilesRes
                ] = await Promise.all([
                    supabase.from('students').select('*', { count: 'exact', head: true }),
                    supabase.from('teachers').select('*', { count: 'exact', head: true }),
                    supabase.from('student_attendance').select('*', { count: 'exact', head: true }).eq('attendance_date', today).in('status', ['Present', 'Late']),
                    supabase.from('fee_payments').select('amount_paid').gte('payment_date', `${currentYear}-01-01`).lte('payment_date', `${currentYear}-12-31`),
                    supabase.from('announcements').select('*').gte('expiry_date', today).order('created_at', { ascending: false }).limit(4),
                    supabase.from('profiles').select('*').eq('school_id', profile.school_id).eq('role', 'Teacher').eq('is_onboarded', true)
                ]);

                // Find profiles that don't have a record in the teachers table
                const { data: teacherRecords } = await supabase.from('teachers').select('id').eq('school_id', profile.school_id);
                const teacherIds = new Set((teacherRecords || []).map(t => t.id));
                const incomplete = (profilesRes.data || []).filter(p => !teacherIds.has(p.id));

                setStats({
                    studentCount: studentCount || 0,
                    teacherCount: teacherCount || 0,
                    studentAttendance: studentCount ? ((presentStudents || 0) / studentCount) * 100 : 0,
                });
                
                setFinancials({
                    collected: (feeData || []).reduce((sum, p) => sum + p.amount_paid, 0)
                });
                
                setAnnouncements(announcementData || []);
                setIncompleteProfiles(incomplete);
                
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [profile.school_id]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {profile.full_name}!</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Here's a snapshot of your school's performance today.</p>

            {/* Incomplete Profiles Notification */}
            {incompleteProfiles.length > 0 && (
                <div className="mb-8 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4 text-amber-800 dark:text-amber-300">
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center shrink-0">
                            <AddTeacherIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-base">Incomplete Staff Profiles</p>
                            <p className="text-sm mt-0.5">There are {incompleteProfiles.length} authorized teachers who haven't completed their school profile details yet.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setActivePage('Staff Authorizations')}
                        className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shrink-0 shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        Complete Profiles
                    </button>
                </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard title="Total Students" value={stats.studentCount.toString()} icon={UsersIcon} isLoading={isLoading} />
                <StatCard title="Total Staff" value={stats.teacherCount.toString()} icon={BriefcaseIcon} isLoading={isLoading} />
                <StatCard title="Student Attendance" value={`${stats.studentAttendance.toFixed(0)}%`} icon={UserCheckIcon} isLoading={isLoading} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Widgets */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Financial Overview */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Financial Overview</h3>
                        <div className="flex items-center space-x-5">
                            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
                                <CashIcon className="w-8 h-8 text-green-600 dark:text-green-400"/>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Total Fees Collected (This Year)</p>
                                {isLoading ? (
                                    <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
                                ) : (
                                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">GHS {financials.collected.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                                )}
                            </div>
                        </div>
                        {/* Progress bar placeholder */}
                        <div className="mt-6 h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out" style={{width: '70%'}}></div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            <QuickAction title="Admit Student" icon={AddStudentIcon} onClick={() => setActivePage('Add Students')} />
                            <QuickAction title="Manage Fees" icon={FeesIcon} onClick={() => setActivePage('Fees')} />
                            <QuickAction title="Post Announcement" icon={AnnouncementIcon} onClick={() => setActivePage('Manage Announcements')} />
                            <QuickAction title="Generate Report" icon={ReportsIcon} onClick={() => setActivePage('Reports')} />
                        </div>
                    </div>
                </div>

                {/* Side Widget: Announcements */}
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Recent Announcements</h3>
                     {isLoading ? (
                        <div className="space-y-4 flex-grow">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse"></div>)}
                        </div>
                    ) : announcements.length > 0 ? (
                        <ul className="space-y-4 flex-grow">
                           {announcements.map(ann => (
                               <li key={ann.id} className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/50 rounded-xl transition-all hover:shadow-sm">
                                   <p className="text-sm font-medium text-brand-900 dark:text-brand-100 mb-2">{ann.message}</p>
                                   <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">Expires: {new Date(ann.expiry_date).toLocaleDateString()}</p>
                               </li>
                           ))}
                       </ul>
                    ) : (
                       <div className="flex-grow flex items-center justify-center">
                           <p className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-4 py-3 rounded-lg">No active announcements.</p>
                       </div>
                    )}
                    <button onClick={() => setActivePage('Manage Announcements')} className="mt-6 py-2.5 px-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm font-bold text-gray-700 dark:text-gray-200 rounded-xl w-full text-center transition-colors">
                        Manage All Announcements
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeadteacherDashboardHome;