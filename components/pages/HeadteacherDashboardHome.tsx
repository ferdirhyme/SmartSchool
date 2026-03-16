

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
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center space-x-4">
    <div className="bg-brand-100 dark:bg-brand-900 p-3 rounded-full">
      <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {isLoading ? (
        <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      ) : (
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      )}
    </div>
  </div>
);

const QuickAction: React.FC<{ title: string; icon: React.FC<{ className?: string }>; onClick: () => void; }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <Icon className="w-8 h-8 text-brand-600 dark:text-brand-400 mb-2" />
        <span className="text-sm font-semibold text-gray-700 dark:text-white text-center">{title}</span>
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
                <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-amber-800 dark:text-amber-300">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center shrink-0">
                            <AddTeacherIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold">Incomplete Staff Profiles</p>
                            <p className="text-sm">There are {incompleteProfiles.length} authorized teachers who haven't completed their school profile details yet.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setActivePage('Staff Authorizations')}
                        className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shrink-0"
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
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Financial Overview</h3>
                        <div className="flex items-center space-x-4">
                            <CashIcon className="w-10 h-10 text-green-500"/>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Fees Collected (This Year)</p>
                                {isLoading ? (
                                    <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1"></div>
                                ) : (
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">GHS {financials.collected.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                                )}
                            </div>
                        </div>
                        {/* Progress bar placeholder */}
                        <div className="mt-4 h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div className="h-2 bg-green-500 rounded-full" style={{width: '70%'}}></div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            <QuickAction title="Admit Student" icon={AddStudentIcon} onClick={() => setActivePage('Add Students')} />
                            <QuickAction title="Manage Fees" icon={FeesIcon} onClick={() => setActivePage('Fees')} />
                            <QuickAction title="Post Announcement" icon={AnnouncementIcon} onClick={() => setActivePage('Manage Announcements')} />
                            <QuickAction title="Generate Report" icon={ReportsIcon} onClick={() => setActivePage('Reports')} />
                        </div>
                    </div>
                </div>

                {/* Side Widget: Announcements */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Recent Announcements</h3>
                     {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>)}
                        </div>
                    ) : announcements.length > 0 ? (
                        <ul className="space-y-4">
                           {announcements.map(ann => (
                               <li key={ann.id} className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                                   <p className="text-sm text-blue-800 dark:text-blue-200">{ann.message}</p>
                                   <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Expires: {new Date(ann.expiry_date).toLocaleDateString()}</p>
                               </li>
                           ))}
                       </ul>
                    ) : (
                       <p className="text-sm text-gray-500 dark:text-gray-400">No active announcements.</p>
                    )}
                    <button onClick={() => setActivePage('Manage Announcements')} className="mt-4 text-sm font-medium text-brand-600 hover:underline w-full text-center">
                        Manage All
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeadteacherDashboardHome;