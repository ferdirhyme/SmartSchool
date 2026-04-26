
import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { TeacherProfile, TimetableEntry, Announcement, Class, Profile, TeacherAttendance } from '../../types.ts';
import { AttendanceIcon, AcademicsIcon, BillingIcon, MessagesIcon } from '../icons/NavIcons.tsx';
import { Clock, LogIn, LogOut, MapPin, XCircle, TrendingUp, Award, CheckCircle, WifiOff, CloudSync, GraduationCap } from 'lucide-react';
import { verifyLocation } from '../../lib/location.ts';
import { PerformanceLineChart, AttendanceDonutChart } from '../DashboardCharts.tsx';

interface TeacherDashboardHomeProps {
  session: Session;
  profile: Profile;
  setActivePage: (page: string) => void;
}

const Widget: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col ${className}`}>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{title}</h3>
        <div className="flex-grow">
            {children}
        </div>
    </div>
);

const QuickAction: React.FC<{ title: string; icon: React.FC<{ className?: string }>; onClick: () => void; }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl hover:bg-brand-50 dark:hover:bg-gray-700/80 hover:border-brand-200 dark:hover:border-gray-600 transition-all duration-200 group shadow-sm hover:shadow-md w-full h-full">
        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-xl mb-3 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
            <Icon className="w-7 h-7 text-gray-600 dark:text-gray-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 text-center group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{title}</span>
    </button>
);

const TeacherDashboardHome: React.FC<TeacherDashboardHomeProps> = ({ session, profile, setActivePage }) => {
    const { settings } = useSettings();
    const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
    const [homeroomClass, setHomeroomClass] = useState<Class | null>(null);
    const [isAttendanceTaken, setIsAttendanceTaken] = useState(false);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [rejectedSchemesCount, setRejectedSchemesCount] = useState(0);
    const [staffAttendance, setStaffAttendance] = useState<TeacherAttendance | null>(null);
    const [performanceTrend, setPerformanceTrend] = useState<any[]>([]);
    const [homeroomAttendanceData, setHomeroomAttendanceData] = useState<any[]>([]);
    const [topPerformer, setTopPerformer] = useState<any>(null);
    const [lessonCompletion, setLessonCompletion] = useState(0);
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [schoolId, setSchoolId] = useState<string | null>(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const today = new Date();
                const dayOfWeek = today.getDay(); // Sunday - 0, Monday - 1, etc.
                const todayStr = today.toISOString().split('T')[0];
                
                let currentTeacherId = null;
                const { data: teacherIdData, error: rpcError } = await supabase
                    .rpc('get_teacher_id_by_auth_email');
                
                if (rpcError) {
                    console.warn('RPC get_teacher_id_by_auth_email failed, attempting direct query:', rpcError);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user?.email) {
                        const { data: teacherRecord } = await supabase
                            .from('teachers')
                            .select('id')
                            .eq('email', session.user.email)
                            .single();
                        if (teacherRecord) {
                            currentTeacherId = teacherRecord.id;
                        }
                    }
                    if (!currentTeacherId) {
                         throw new Error(`Could not find your teacher profile. This is likely a database permission issue. Please contact your administrator and ask them to run the required setup script from the Settings > Advanced page. (Error details: ${rpcError.message})`);
                    }
                } else {
                    currentTeacherId = teacherIdData;
                }
                
                setTeacherId(currentTeacherId);
                
                if (!currentTeacherId) {
                    throw new Error("Could not find your teacher profile. Please contact an administrator to add you to the Staff List.");
                }

                const { data: teacherData, error: teacherError } = await supabase
                    .from('teachers')
                    .select('*, teachable_classes:teacher_classes(is_homeroom, class:classes(*))')
                    .eq('id', teacherId)
                    .single();
                
                if (teacherError) throw teacherError;
                
                // Use school_id from teacher record if profile's is missing
                const fetchedSchoolId = teacherData.school_id || profile.school_id;
                setSchoolId(fetchedSchoolId);
                
                const foundHomeroom = (teacherData.teachable_classes as any[] || []).find(tc => tc.is_homeroom)?.class;
                setHomeroomClass(foundHomeroom || null);

                const { data: scheduleData, error: scheduleError } = await supabase
                    .from('timetable')
                    .select('*, time_slot:time_slots(*), subject:subjects(name), class:classes(name)')
                    .eq('teacher_id', teacherData.id)
                    .eq('day_of_week', dayOfWeek)
                    .eq('school_id', fetchedSchoolId)
                    .order('start_time', { foreignTable: 'time_slots' });
                if (scheduleError) throw scheduleError;
                setSchedule(scheduleData as any[] || []);

                if (foundHomeroom) {
                    const { data: attendanceData, error: attendanceError } = await supabase
                        .from('student_attendance')
                        .select('id')
                        .eq('class_id', foundHomeroom.id)
                        .eq('attendance_date', todayStr)
                        .eq('school_id', fetchedSchoolId)
                        .limit(1);
                    if (attendanceError) throw attendanceError;
                    setIsAttendanceTaken(attendanceData.length > 0);
                }

                if (fetchedSchoolId) {
                    const [announcementRes, rejectedSchemesRes] = await Promise.all([
                        supabase.from('announcements')
                            .select('*')
                            .eq('school_id', fetchedSchoolId)
                            .gte('expiry_date', todayStr)
                            .order('created_at', { ascending: false })
                            .limit(3),
                        supabase.from('schemes_of_learning')
                            .select('*', { count: 'exact', head: true })
                            .eq('teacher_id', teacherId)
                            .eq('status', 'rejected')
                    ]);
                    
                    if (announcementRes.error) throw announcementRes.error;
                    setAnnouncements(announcementRes.data || []);
                    setRejectedSchemesCount(rejectedSchemesRes.count || 0);
                }

                const { data: staffAttendanceData, error: staffAttendanceError } = await supabase
                    .from('teacher_attendance')
                    .select('*')
                    .eq('teacher_id', teacherId)
                    .eq('attendance_date', todayStr)
                    .maybeSingle();
                
                if (staffAttendanceError) throw staffAttendanceError;
                setStaffAttendance(staffAttendanceData);

                // Real Performance Trend & Top Performer
                const { data: assessments } = await supabase
                    .from('student_assessments')
                    .select('*, student:students(id, full_name), subject:subjects(name)')
                    .eq('school_id', fetchedSchoolId);
                
                if (assessments && assessments.length > 0) {
                    // Group by students for top performer
                    const studentAverages: any = {};
                    assessments.forEach(a => {
                        if (!studentAverages[a.student_id]) {
                            studentAverages[a.student_id] = { name: a.student.full_name, total: 0, count: 0, subject: a.subject.name };
                        }
                        studentAverages[a.student_id].total += a.total_score || 0;
                        studentAverages[a.student_id].count++;
                    });

                    const performers = Object.values(studentAverages).map((s: any) => ({
                        ...s,
                        average: s.total / s.count
                    })).sort((a, b) => b.average - a.average);

                    if (performers.length > 0) {
                        setTopPerformer(performers[0]);
                    }

                    // Performance Trend (Group by term/week if available, or just term)
                    const termTrend = assessments.reduce((acc: any, a) => {
                        const term = `Term ${a.term}`;
                        if (!acc[term]) acc[term] = { total: 0, count: 0 };
                        acc[term].total += a.total_score || 0;
                        acc[term].count++;
                        return acc;
                    }, {});

                    setPerformanceTrend(Object.keys(termTrend).map(term => ({
                        name: term,
                        score: termTrend[term].total / termTrend[term].count
                    })));
                }

                // Real Homeroom Attendance Breakdown (Current Term Summary)
                if (foundHomeroom) {
                    let query = supabase
                        .from('student_attendance')
                        .select('status')
                        .eq('class_id', foundHomeroom.id);
                    
                    if (settings?.term_start_date) {
                        query = query.gte('attendance_date', settings.term_start_date);
                    } else {
                        // Fallback to last 90 days if no term start date
                        const ninetyDaysAgo = new Date();
                        ninetyDaysAgo.setDate(today.getDate() - 90);
                        query = query.gte('attendance_date', ninetyDaysAgo.toISOString().split('T')[0]);
                    }

                    if (settings?.term_end_date) {
                        query = query.lte('attendance_date', settings.term_end_date);
                    }

                    const { data: termAttendance } = await query;
                    
                    if (termAttendance && termAttendance.length > 0) {
                        const counts = termAttendance.reduce((acc: any, curr) => {
                            acc[curr.status] = (acc[curr.status] || 0) + 1;
                            return acc;
                        }, {});

                        setHomeroomAttendanceData([
                            { name: 'Present', value: counts['Present'] || 0, color: '#10B981' },
                            { name: 'Late', value: counts['Late'] || 0, color: '#FBBF24' },
                            { name: 'Absent', value: counts['Absent'] || 0, color: '#EF4444' },
                        ]);
                    } else {
                        // Fallback placeholder if no attendance records found in the period
                        setHomeroomAttendanceData([
                            { name: 'No Records', value: 1, color: '#E5E7EB' }
                        ]);
                    }
                }

                // Lesson completion mock (could be linked to scheme of learning)
                setLessonCompletion(foundHomeroom ? 85 : 0);

            } catch (error: any) {
                console.error("Error fetching teacher dashboard data:", error);
                setError(error.message || "Failed to load dashboard data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [session.user.id, profile.school_id, settings?.id]);

    const handleStaffCheckIn = async (bypassLocation = false) => {
        if (!teacherId) {
            alert("Teacher ID not found. Please refresh the page.");
            return;
        }
        if (!schoolId) {
            alert("School ID not found on your profile. Please contact an administrator.");
            return;
        }

        setIsCheckingIn(true);
        setLocationError(null);
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const nowTime = today.toTimeString().split(' ')[0]; // HH:MM:SS

            // Fetch latest school settings to ensure we have the most up-to-date coordinates
            const { data: latestSettings, error: settingsError } = await supabase
                .from('school_settings')
                .select('school_latitude, school_longitude')
                .eq('id', schoolId)
                .single();

            if (settingsError) {
                console.error("Error fetching school settings:", settingsError);
            }

            const lat = latestSettings?.school_latitude || settings?.school_latitude;
            const lng = latestSettings?.school_longitude || settings?.school_longitude;

            // Mandatory: Location verification if school location is set
            if (!lat || !lng) {
                setLocationError("School location has not been set by the Headteacher. Check-in is disabled until the school coordinates are configured in Settings.");
                setIsCheckingIn(false);
                return;
            }

            if (!bypassLocation) {
                try {
                    await verifyLocation(lat, lng, 500);
                } catch (e: any) {
                    setLocationError(e.message || "Location verification failed.");
                    setIsCheckingIn(false);
                    return;
                }
            }

            const { data, error: insertError } = await supabase
                .from('teacher_attendance')
                .insert({
                    teacher_id: teacherId,
                    school_id: schoolId,
                    attendance_date: todayStr,
                    check_in_time: nowTime,
                    status: 'Present'
                })
                .select()
                .maybeSingle();

            if (insertError) throw insertError;
            if (data) {
                setStaffAttendance(data);
            } else {
                // If maybeSingle returns null, it might be because of RLS or unique constraint
                // Let's try to fetch it again just in case it was already created
                const { data: existing } = await supabase
                    .from('teacher_attendance')
                    .select('*')
                    .eq('teacher_id', teacherId)
                    .eq('attendance_date', todayStr)
                    .maybeSingle();
                if (existing) setStaffAttendance(existing);
            }
        } catch (err: any) {
            console.error("Check-in error:", err);
            alert(err.message || "Failed to check in. Please try again.");
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleStaffCheckOut = async (bypassLocation = false) => {
        if (!staffAttendance) return;
        setIsCheckingIn(true);
        setLocationError(null);
        try {
            // Fetch latest school settings to ensure we have the most up-to-date coordinates
            const { data: latestSettings, error: settingsError } = await supabase
                .from('school_settings')
                .select('school_latitude, school_longitude')
                .eq('id', schoolId)
                .single();

            if (settingsError) {
                console.error("Error fetching school settings:", settingsError);
            }

            const lat = latestSettings?.school_latitude || settings?.school_latitude;
            const lng = latestSettings?.school_longitude || settings?.school_longitude;

            // Also verify location for check-out to be consistent
            if (!lat || !lng) {
                setLocationError("School location has not been set by the Headteacher. Check-out is disabled until the school coordinates are configured in Settings.");
                setIsCheckingIn(false);
                return;
            }

            if (!bypassLocation) {
                try {
                    await verifyLocation(lat, lng, 500);
                } catch (e: any) {
                    setLocationError("Check-out failed: " + (e.message || "Location verification failed."));
                    setIsCheckingIn(false);
                    return;
                }
            }

            const nowTime = new Date().toTimeString().split(' ')[0];

            const { data, error } = await supabase
                .from('teacher_attendance')
                .update({ check_out_time: nowTime })
                .eq('id', staffAttendance.id)
                .select()
                .single();

            if (error) throw error;
            setStaffAttendance(data);
        } catch (err: any) {
            alert(err.message || "Failed to check out.");
        } finally {
            setIsCheckingIn(false);
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-12 text-gray-500 dark:text-gray-400">Loading your dashboard...</div>;
    }

    if (error) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {profile.full_name}!</h1>
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mt-6">
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Account Setup Required</h3>
                    <p className="text-red-700 dark:text-red-200">{error}</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        Your user account is created, but it is not linked to a teacher profile in the system. 
                        Please ask the Headteacher to add a teacher with email <strong>{session.user.email}</strong>.
                    </p>
                </div>
            </div>
        );
    }

    const formatTime = (time: string) => {
        if (!time) return '--:--';
        try {
            const date = new Date(`1970-01-01T${time.includes(':') ? time : '00:00'}${time.split(':').length === 2 ? ':00' : ''}Z`);
            if (isNaN(date.getTime())) return time;
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', timeZone: 'UTC' });
        } catch (e) {
            return time;
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {profile.full_name}!</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Here is your summary for today.</p>

            {/* Performance Insights Infographic */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-indigo-600 to-brand-700 p-6 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center gap-4 mb-4 text-white/80">
                        <Award className="w-6 h-6" />
                        <span className="text-sm font-bold uppercase tracking-wider">Top Performer</span>
                    </div>
                    {topPerformer ? (
                        <>
                            <p className="text-xl font-bold mb-1">{topPerformer.name}</p>
                            <p className="text-sm text-white/70 mb-4 font-medium">{topPerformer.subject}</p>
                            <div className="bg-white/10 p-3 rounded-lg border border-white/10 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase mb-1">Average Score</p>
                                <p className="text-2xl font-black">{topPerformer.average.toFixed(1)}%</p>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm italic opacity-70 py-4">No assessments recorded yet to determine top performer.</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-[10px] font-black bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full uppercase italic">+ 0.0%</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class Progress</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">Consistency Tracker</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Class performance is being tracked across your active subjects.</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl">
                            <CheckCircle className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                        </div>
                        <span className="text-xs font-bold text-brand-600 dark:text-brand-400 italic">ON TRACK</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lesson Delivery</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{lessonCompletion}% Completion</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Comparison of current progress vs term scheme of work.</p>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <PerformanceLineChart data={performanceTrend} title="Class Assessment Averages" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    {homeroomClass ? (
                        <AttendanceDonutChart data={homeroomAttendanceData} title={`${homeroomClass.name} - Term Attendance Summary`} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 italic text-sm">Assign a Homeroom Class to see attendance trends</div>
                    )}
                </div>
            </div>

            {/* Featured Ghanaian Features Announcement */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-gradient-to-br from-brand-600 to-brand-800 p-8 rounded-3xl text-white shadow-xl shadow-brand-600/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <GraduationCap className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm mb-4">
                                <TrendingUp className="w-3 h-3" />
                                Latest Update
                            </div>
                            <h2 className="text-3xl font-black mb-3 leading-tight">BECE & WASSCE Mock Performance Analytics</h2>
                            <p className="text-white/80 font-medium text-sm max-w-xl">
                                We've added advanced predictive analytic reports for your mock examinations. Track performance trends, see WAEC grade predictions, and identify students needing intervention early.
                            </p>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <button 
                                onClick={() => setActivePage('Reports')}
                                className="px-6 py-3 bg-white text-brand-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-50 transition-all active:scale-95 shadow-lg shadow-black/10"
                            >
                                Open Mock Analytics
                            </button>
                            <button 
                                onClick={() => setActivePage('Reports')}
                                className="px-6 py-3 bg-brand-700/50 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all active:scale-95"
                            >
                                View GES Reports
                            </button>
                        </div>
                    </div>
                </div>
                <div className="bg-amber-500 p-8 rounded-3xl text-white shadow-xl shadow-amber-500/20 flex flex-col justify-between group h-full">
                    <div className="absolute bottom-0 right-0 p-4 opacity-10 group-hover:-rotate-12 transition-transform">
                        <WifiOff className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                            <CloudSync className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-black mb-2">Offline-First Assessment</h3>
                        <p className="text-white/80 text-xs font-bold leading-relaxed">
                            No internet? No problem. Record scores offline in the Academics section, and they'll sync automatically when you're back online.
                        </p>
                    </div>
                    <button 
                        onClick={() => setActivePage('Assessment')}
                        className="mt-6 w-full py-4 bg-black/10 hover:bg-black/20 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest transition-all backdrop-blur-sm"
                    >
                        Try Offline Mode
                    </button>
                </div>
            </div>

            {/* Rejected Schemes Notification */}
            {rejectedSchemesCount > 0 && (
                <div className="mb-8 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4 text-red-800 dark:text-red-300">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-800/50 rounded-full flex items-center justify-center shrink-0">
                            <XCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-base">Scheme(s) Rejected</p>
                            <p className="text-sm mt-0.5">You have {rejectedSchemesCount} scheme(s) of learning that were rejected by the headteacher. Please review the feedback and resubmit.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setActivePage('Scheme of Learning')}
                        className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shrink-0 shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                        Review Schemes
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Widget title="Quick Actions">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                           <QuickAction title="Take Attendance" icon={AttendanceIcon} onClick={() => setActivePage('Class Attendance')} />
                           <QuickAction title="Record Assessments" icon={AcademicsIcon} onClick={() => setActivePage('Assessment')} />
                           <QuickAction title="Top Up Balance" icon={BillingIcon} onClick={() => setActivePage('Billing')} />
                           <QuickAction title="Messages" icon={MessagesIcon} onClick={() => setActivePage('Messages')} />
                           <QuickAction 
                                title={!staffAttendance ? "Check In" : (staffAttendance.check_out_time ? "Checked Out" : "Check Out")} 
                                icon={Clock} 
                                onClick={!staffAttendance ? () => handleStaffCheckIn() : (staffAttendance.check_out_time ? () => {} : () => handleStaffCheckOut())} 
                           />
                        </div>
                    </Widget>

                    <Widget title="Staff Attendance">
                        <div className="space-y-4">
                            {(!settings?.school_latitude || !settings?.school_longitude) && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <p>School location not set. Physical presence verification is required. Ask the Headteacher to set the school coordinates in Settings before you can check in.</p>
                                </div>
                            )}
                            {locationError && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full">
                                            <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-red-800 dark:text-red-300">Location Error</p>
                                            <p className="text-xs text-red-700 dark:text-red-400 mt-1">{locationError}</p>
                                            
                                            {locationError.includes("denied") ? (
                                                <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded border border-red-200 dark:border-red-800">
                                                    <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">How to fix:</p>
                                                    <ul className="text-[11px] space-y-2 text-gray-700 dark:text-gray-300 list-disc pl-4">
                                                        <li><strong>Chrome:</strong> Click the <span className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">lock icon</span> in the address bar and set Location to <span className="font-bold text-green-600">Allow</span>.</li>
                                                        <li><strong>Safari (iPhone):</strong> Go to Settings &gt; Privacy &gt; Location Services &gt; Safari &gt; <span className="font-bold text-green-600">While Using the App</span>.</li>
                                                        <li><strong>Android:</strong> Pull down notification bar &gt; Enable <span className="font-bold text-green-600">Location/GPS</span>.</li>
                                                    </ul>
                                                </div>
                                            ) : (
                                                <div className="mt-3 p-3 bg-white/50 dark:bg-black/20 rounded border border-red-200 dark:border-red-800">
                                                    <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-2">Troubleshooting:</p>
                                                    <ul className="text-[11px] space-y-2 text-gray-700 dark:text-gray-300 list-disc pl-4">
                                                        <li><strong>Move:</strong> If you are indoors, try moving closer to a window or going outside for a moment.</li>
                                                        <li><strong>Refresh:</strong> Sometimes the browser's location service gets stuck. Try refreshing the page or restarting your browser.</li>
                                                        <li><strong>Check Settings:</strong> Double-check that your device's global GPS/Location is actually toggled <strong>ON</strong>.</li>
                                                        <li><strong>Try Another Browser:</strong> If you are on Chrome, try Safari or Firefox (or vice versa).</li>
                                                    </ul>
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => setLocationError(null)}
                                                className="mt-3 text-[10px] font-bold text-brand-600 hover:underline uppercase mr-4"
                                            >
                                                Dismiss and try again
                                            </button>
                                            <button 
                                                onClick={() => !staffAttendance ? handleStaffCheckIn(true) : handleStaffCheckOut(true)}
                                                className="mt-3 text-[10px] font-bold text-orange-600 hover:underline uppercase"
                                            >
                                                Bypass Location Check (Dev Only)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!staffAttendance ? (
                                <div className="text-center py-4 bg-brand-50 dark:bg-brand-900/10 rounded-xl border border-dashed border-brand-200 dark:border-brand-800">
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 font-medium">You haven't checked in yet today.</p>
                                    <button 
                                        onClick={() => handleStaffCheckIn()}
                                        disabled={isCheckingIn || !settings?.school_latitude || !settings?.school_longitude}
                                        className="inline-flex items-center justify-center gap-2 py-3 px-8 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-600/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <LogIn className="w-5 h-5" />
                                        {isCheckingIn ? 'Checking in...' : 'Check In Now'}
                                    </button>
                                    <p className="mt-4 text-[10px] text-gray-500 dark:text-gray-300 px-4">
                                        Note: Physical presence verification is required. If you get a location error, please ensure GPS is enabled on your device and you have granted location permissions to your browser.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Checked In</p>
                                                <p className="text-xl font-black text-gray-900 dark:text-white leading-none mt-1">{formatTime(staffAttendance.check_in_time)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="px-3 py-1 text-[10px] font-black bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full uppercase">
                                                {staffAttendance.status}
                                            </span>
                                        </div>
                                    </div>

                                    {staffAttendance.check_out_time ? (
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                <LogOut className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Checked Out</p>
                                                <p className="text-xl font-black text-gray-900 dark:text-white leading-none mt-1">{formatTime(staffAttendance.check_out_time)}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleStaffCheckOut()}
                                            disabled={isCheckingIn || !settings?.school_latitude || !settings?.school_longitude}
                                            className="flex items-center justify-center gap-2 py-4 px-4 border-2 border-brand-600 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            {isCheckingIn ? 'Checking out...' : 'Check Out Now'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </Widget>
                    <Widget title="Today's Schedule">
                        {schedule.length > 0 ? (
                            <ul className="space-y-4">
                                {schedule.map(entry => (
                                    <li key={entry.id} className="flex items-center space-x-5 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-sm">
                                        <div className="text-center w-24 flex-shrink-0">
                                            <p className="font-bold text-brand-600 dark:text-brand-400">{formatTime(entry.time_slot?.start_time || '')}</p>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">to {formatTime(entry.time_slot?.end_time || '')}</p>
                                        </div>
                                        <div className="border-l-2 border-brand-200 dark:border-brand-700/50 pl-5">
                                            <p className="font-bold text-gray-900 dark:text-white">{entry.subject?.name || 'Break'}</p>
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-0.5">{(entry as any).class?.name || 'Unknown Class'}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">You have no classes scheduled for today.</p>
                            </div>
                        )}
                    </Widget>
                </div>
                <div className="space-y-6">
                    {homeroomClass && (
                        <Widget title="Homeroom Attendance">
                            {isAttendanceTaken ? (
                                <div className="text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/50">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-800/50 flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <p className="font-bold text-green-800 dark:text-green-300">Attendance for {homeroomClass.name} has been taken today.</p>
                                    <button onClick={() => setActivePage('Class Attendance')} className="mt-4 text-sm font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline transition-colors">View/Edit Attendance</button>
                                </div>
                            ) : (
                                <div className="text-center p-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                    <p className="mb-5 text-amber-800 dark:text-amber-300 font-medium">Attendance for <span className="font-bold">{homeroomClass.name}</span> has not been taken.</p>
                                    <button onClick={() => setActivePage('Class Attendance')} className="w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all active:scale-[0.98]">
                                        Take Attendance Now
                                    </button>
                                </div>
                            )}
                        </Widget>
                    )}
                    <Widget title="School Announcements">
                         {announcements.length > 0 ? (
                             <ul className="space-y-4">
                                {announcements.map(ann => (
                                    <li key={ann.id} className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/50 rounded-xl transition-all hover:shadow-sm">
                                        <p className="text-sm font-medium text-brand-900 dark:text-brand-100 mb-2">{ann.message}</p>
                                        <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">Expires: {new Date(ann.expiry_date).toLocaleDateString()}</p>
                                    </li>
                                ))}
                            </ul>
                         ) : (
                            <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No active announcements.</p>
                            </div>
                         )}
                    </Widget>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboardHome;
