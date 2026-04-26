

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Announcement, SchoolSettings } from '../../types.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { UsersIcon, BriefcaseIcon, UserCheckIcon, CashIcon } from '../icons/WidgetIcons.tsx';
import { AddStudentIcon, AddTeacherIcon } from '../icons/ActionIcons.tsx';
import { AnnouncementIcon, ReportsIcon, FeesIcon } from '../icons/NavIcons.tsx';
import { EnrollmentChart, AttendanceDonutChart, FinancialGrowthChart } from '../DashboardCharts.tsx';
import { Calendar, Save, Loader2, Sparkles, AlertCircle } from 'lucide-react';

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
    const { settings, refetchSettings } = useSettings();
    const [stats, setStats] = useState({ studentCount: 0, teacherCount: 0, studentAttendance: 0 });
    const [financials, setFinancials] = useState({ collected: 0 });
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [pendingSchemesCount, setPendingSchemesCount] = useState(0);
    const [incompleteProfiles, setIncompleteProfiles] = useState<Profile[]>([]);
    const [enrollmentTrend, setEnrollmentTrend] = useState<any[]>([]);
    const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
    const [attendanceBreakdown, setAttendanceBreakdown] = useState<any[]>([]);
    const [feeRecoveryPerc, setFeeRecoveryPerc] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Session Management State
    const [isEditingSession, setIsEditingSession] = useState(false);
    const [sessionForm, setSessionForm] = useState({
        current_year: settings?.current_year || new Date().getFullYear(),
        current_term: settings?.current_term || 'Term 1',
        term_start_date: settings?.term_start_date || '',
        term_end_date: settings?.term_end_date || ''
    });
    const [isSavingSession, setIsSavingSession] = useState(false);

    useEffect(() => {
        if (settings) {
            setSessionForm({
                current_year: settings.current_year || new Date().getFullYear(),
                current_term: settings.current_term || 'Term 1',
                term_start_date: settings.term_start_date || '',
                term_end_date: settings.term_end_date || ''
            });
        }
    }, [settings]);

    const handleUpdateSession = async () => {
        if (!profile.school_id) return;
        setIsSavingSession(true);
        try {
            const { error } = await supabase
                .from('school_settings')
                .upsert({
                    id: profile.school_id,
                    ...sessionForm
                });
            
            if (error) throw error;
            setIsEditingSession(false);
            refetchSettings();
        } catch (err) {
            console.error("Error updating session:", err);
            alert("Failed to update session. Please try again.");
        } finally {
            setIsSavingSession(false);
        }
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                const currentYear = today.getFullYear();

                // Calculate date 6 months ago for trends
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(today.getMonth() - 5);
                sixMonthsAgo.setDate(1);
                const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

                const [
                    { count: studentCount }, 
                    { count: teacherCount }, 
                    { count: presentStudents }, 
                    { data: feeData },
                    { data: announcementData },
                    profilesRes,
                    pendingSchemesRes,
                    { data: allStudentsDates },
                    { data: feeTrendData },
                    { data: feeTypes }
                ] = await Promise.all([
                    supabase.from('students').select('*', { count: 'exact', head: true }),
                    supabase.from('teachers').select('*', { count: 'exact', head: true }),
                    supabase.from('student_attendance').select('*', { count: 'exact', head: true }).eq('attendance_date', todayStr).in('status', ['Present', 'Late']),
                    supabase.from('fee_payments').select('amount_paid').gte('payment_date', `${currentYear}-01-01`).lte('payment_date', `${currentYear}-12-31`),
                    supabase.from('announcements').select('*').gte('expiry_date', todayStr).order('created_at', { ascending: false }).limit(4),
                    supabase.from('profiles').select('*').eq('school_id', profile.school_id).eq('role', 'Teacher').eq('is_onboarded', true),
                    supabase.from('schemes_of_learning').select('*', { count: 'exact', head: true }).eq('school_id', profile.school_id).eq('status', 'pending'),
                    supabase.from('students').select('created_at').gte('created_at', sixMonthsAgoStr),
                    supabase.from('fee_payments').select('amount_paid, payment_date').gte('payment_date', sixMonthsAgoStr),
                    supabase.from('fee_types').select('default_amount')
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
                setPendingSchemesCount(pendingSchemesRes?.count || 0);
                setIncompleteProfiles(incomplete);

                // Helper for month formatting
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const getMonthLabel = (date: Date) => monthNames[date.getMonth()];

                // Real Enrollment Trend (Last 6 months cumulative)
                const last6Months = [];
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    last6Months.push({
                        name: getMonthLabel(d),
                        month: d.getMonth(),
                        year: d.getFullYear(),
                        students: 0
                    });
                }

                (allStudentsDates || []).forEach(s => {
                    const d = new Date(s.created_at);
                    const month = d.getMonth();
                    const year = d.getFullYear();
                    const idx = last6Months.findIndex(m => m.month === month && m.year === year);
                    if (idx !== -1) {
                        for (let i = idx; i < last6Months.length; i++) {
                            last6Months[i].students++;
                        }
                    }
                });
                // Base student count correction (approximate previous months)
                const finalEnrollment = last6Months.map((m, idx) => ({
                    ...m,
                    students: (studentCount || 0) - (last6Months[last6Months.length-1].students - m.students)
                }));
                setEnrollmentTrend(finalEnrollment);

                // Real Revenue Trend
                const revenueByMonth = last6Months.map(m => ({
                    name: m.name,
                    month: m.month,
                    year: m.year,
                    revenue: 0
                }));

                (feeTrendData || []).forEach(f => {
                    const d = new Date(f.payment_date);
                    const month = d.getMonth();
                    const year = d.getFullYear();
                    const idx = revenueByMonth.findIndex(m => m.month === month && m.year === year);
                    if (idx !== -1) {
                        revenueByMonth[idx].revenue += f.amount_paid;
                    }
                });
                setRevenueTrend(revenueByMonth);

                // Fee Recovery Calculation
                const totalBilledPerStudent = (feeTypes || []).reduce((sum, ft) => sum + (ft.default_amount || 0), 0);
                const totalExpected = totalBilledPerStudent * (studentCount || 0);
                const collectedTotal = (feeData || []).reduce((sum, p) => sum + p.amount_paid, 0);
                setFeeRecoveryPerc(totalExpected > 0 ? (collectedTotal / totalExpected) * 100 : 0);

                // Attendance Breakdown
                const presentCount = presentStudents || 0;
                const absentCount = (studentCount || 0) - presentCount;
                setAttendanceBreakdown([
                    { name: 'Present', value: presentCount, color: '#10B981' },
                    { name: 'Absent', value: absentCount, color: '#EF4444' },
                ]);
                
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

            {/* Featured Ghanaian Education Excellence Announcement */}
            <div className="mb-8 bg-brand-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-brand-900/40">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-500/20 to-transparent"></div>
                <div className="absolute -bottom-12 -right-12 opacity-5 scale-150 rotate-12">
                    <ReportsIcon className="w-64 h-64" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-500/20 backdrop-blur-sm rounded-full text-brand-400 text-xs font-black uppercase tracking-widest mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                            </span>
                            SmartSchool Ghana Optimizer
                        </div>
                        <h2 className="text-4xl font-black mb-4 leading-tight tracking-tight">GES-Compliant Reporting & Mock Analytics Now Live</h2>
                        <p className="text-brand-100/70 text-lg font-medium leading-relaxed max-w-2xl">
                            We've optimized your school for the Ghanaian educational landscape. 
                            You can now generate terminal reports with automatic class positions and grading based on GES standards.
                        </p>
                        
                        <div className="mt-10 flex flex-wrap gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                    <UserCheckIcon className="w-5 h-5 text-brand-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-brand-400">GES Compliant</p>
                                    <p className="text-white font-bold">Standard Grading</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                    <BriefcaseIcon className="w-5 h-5 text-brand-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-brand-400">Mock Analytics</p>
                                    <p className="text-white font-bold">BECE/WASSCE Prediction</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-4 w-full md:w-auto">
                        <button 
                            onClick={() => setActivePage('Reports')}
                            className="px-10 py-5 bg-white text-brand-900 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-brand-50 transition-all active:scale-95 shadow-xl shadow-black/20"
                        >
                            Open Report Center
                        </button>
                    </div>
                </div>
            </div>

            {/* Active Academic Session Section */}
            <div className="mb-8 p-8 bg-white dark:bg-gray-800 border border-brand-100 dark:border-brand-900/30 rounded-[2.5rem] shadow-xl shadow-brand-500/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-2 h-full bg-brand-500"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center border border-brand-100 dark:border-brand-800/50">
                            <Calendar className="w-7 h-7 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-black uppercase tracking-widest text-brand-600 dark:text-brand-400">Current Academic Session</h3>
                                <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-[10px] font-black rounded-lg">ACTIVE</span>
                            </div>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {settings?.current_year || '---'} Academic Year • {settings?.current_term || '---'}
                            </p>
                            {settings?.term_start_date && settings?.term_end_date && (
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider">
                                    {new Date(settings.term_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                                    <span className="mx-2 text-gray-300 dark:text-gray-600">—</span> 
                                    {new Date(settings.term_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsEditingSession(!isEditingSession)}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                            isEditingSession 
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200' 
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20 active:scale-95'
                        }`}
                    >
                        {isEditingSession ? 'Cancel Editing' : 'Update Session'}
                    </button>
                </div>

                {isEditingSession && (
                    <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-300">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Year</label>
                            <input 
                                type="number" 
                                value={sessionForm.current_year}
                                onChange={(e) => setSessionForm({...sessionForm, current_year: parseInt(e.target.value)})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl font-bold dark:text-white"
                                placeholder="e.g. 2024"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Term</label>
                            <select 
                                value={sessionForm.current_term}
                                onChange={(e) => setSessionForm({...sessionForm, current_term: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl font-bold dark:text-white"
                            >
                                <option value="Term 1">Term 1</option>
                                <option value="Term 2">Term 2</option>
                                <option value="Term 3">Term 3</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Start Date</label>
                            <input 
                                type="date" 
                                value={sessionForm.term_start_date}
                                onChange={(e) => setSessionForm({...sessionForm, term_start_date: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl font-bold dark:text-white"
                            />
                        </div>
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">End Date</label>
                            <div className="flex gap-2">
                                <input 
                                    type="date" 
                                    value={sessionForm.term_end_date}
                                    onChange={(e) => setSessionForm({...sessionForm, term_end_date: e.target.value})}
                                    className="flex-1 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl font-bold dark:text-white"
                                />
                                <button 
                                    onClick={handleUpdateSession}
                                    disabled={isSavingSession}
                                    className="px-4 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
                                >
                                    {isSavingSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-4 flex items-center gap-2 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-2xl border border-brand-100 dark:border-brand-800/50">
                            <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                            <p className="text-[11px] font-bold text-brand-700 dark:text-brand-300 leading-relaxed uppercase tracking-wide">
                                Updating this session will automatically refresh all dashboard reports, student terminal results, and attendance records to reflect the new period.
                            </p>
                        </div>
                    </div>
                )}
            </div>

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

            {/* Pending Schemes Notification */}
            {pendingSchemesCount > 0 && (
                <div className="mb-8 p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4 text-blue-800 dark:text-blue-300">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center shrink-0">
                            <BriefcaseIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-base">Pending Schemes of Learning</p>
                            <p className="text-sm mt-0.5">There are {pendingSchemesCount} schemes of learning awaiting your review and approval.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setActivePage('Scheme of Learning')}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shrink-0 shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        Review Schemes
                    </button>
                </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard title="Total Students" value={stats.studentCount.toString()} icon={UsersIcon} isLoading={isLoading} />
                <StatCard title="Total Staff" value={stats.teacherCount.toString()} icon={BriefcaseIcon} isLoading={isLoading} />
                <StatCard title="Student Attendance" value={`${stats.studentAttendance.toFixed(0)}%`} icon={UserCheckIcon} isLoading={isLoading} />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <EnrollmentChart data={enrollmentTrend} title="Student Enrollment Trend" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <AttendanceDonutChart data={attendanceBreakdown} title="Today's Attendance Breakdown" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <FinancialGrowthChart data={revenueTrend} title="Fee Revenue Growth (Monthly)" />
                </div>
                {/* Visual Widget: Quick Summary Infographic */}
                <div className="bg-gradient-to-br from-brand-600 to-indigo-700 p-8 rounded-2xl shadow-lg border border-transparent text-white flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Academic Excellence</h3>
                        <p className="text-brand-100 text-sm mb-6 opacity-90">Your school is currently performing in the top 15% of the district based on recent metrics.</p>
                        
                        <div className="space-y-4">
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-200 mb-1">Teacher Capacity</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-black">94%</p>
                                    <span className="text-xs text-green-400 font-bold">↑ 2% vs Last Month</span>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-200 mb-1">Fee Recovery</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-2xl font-black">{isLoading ? '...' : `${feeRecoveryPerc.toFixed(1)}%`}</p>
                                    <span className="text-xs text-amber-300 font-bold">Target: 95%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setActivePage('Reports')}
                        className="mt-8 py-3 bg-white text-brand-700 font-bold rounded-xl hover:bg-brand-50 transition-all active:scale-95 shadow-sm"
                    >
                        View Comprehensive Analytics
                    </button>
                </div>
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
                            <div className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out" style={{width: `${Math.min(feeRecoveryPerc, 100)}%`}}></div>
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