
import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { Profile, TimetableEntry, StudentAssessment, StudentAttendance, Student } from '../../types.ts';
import { ReportsIcon, MessagesIcon } from '../icons/NavIcons.tsx';

interface StudentDashboardHomeProps {
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

const StudentDashboardHome: React.FC<StudentDashboardHomeProps> = ({ session, profile, setActivePage }) => {
    const [student, setStudent] = useState<Student | null>(null);
    const [nextClass, setNextClass] = useState<TimetableEntry | null>(null);
    const [performance, setPerformance] = useState<(StudentAssessment & {subject: {name: string}})[]>([]);
    const [attendance, setAttendance] = useState({ present: 0, late: 0, absent: 0, total: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const currentTime = today.toTimeString().slice(0, 5); // HH:MM

                const admissionNumber = profile.admission_numbers?.[0];
                if (!admissionNumber) throw new Error("Student admission number not found in profile.");

                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('*')
                    .eq('admission_number', admissionNumber)
                    .single();
                if (studentError || !studentData) throw new Error("Could not find student profile with your admission number.");
                setStudent(studentData);

                if (studentData.class_id) {
                    const { data: scheduleData, error: scheduleError } = await supabase
                        .from('timetable')
                        .select('*, time_slot:time_slots(*), subject:subjects(name)')
                        .eq('class_id', studentData.class_id)
                        .eq('day_of_week', dayOfWeek)
                        .gte('time_slot.start_time', currentTime)
                        .order('start_time', { foreignTable: 'time_slots' })
                        .limit(1);
                    if (scheduleError) throw scheduleError;
                    if (scheduleData && scheduleData.length > 0) setNextClass(scheduleData[0] as any);
                }

                const { data: assessments, error: assessmentError } = await supabase
                    .from('student_assessments')
                    .select('*, subject:subjects(name)')
                    .eq('student_id', studentData.id)
                    .order('year', { ascending: false })
                    .order('term', { ascending: false })
                    .limit(5);
                if (assessmentError) throw assessmentError;
                setPerformance(assessments as any[] || []);
                
                const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)).toISOString().split('T')[0];
                const { data: attendanceData, error: attendanceError } = await supabase
                    .from('student_attendance')
                    .select('status')
                    .eq('student_id', studentData.id)
                    .gte('attendance_date', thirtyDaysAgo);

                if (attendanceError) throw attendanceError;

                let present = 0, late = 0, absent = 0;
                (attendanceData || []).forEach(rec => {
                    if (rec.status === 'Present') present++;
                    else if (rec.status === 'Late') late++;
                    else if (rec.status === 'Absent') absent++;
                });
                setAttendance({ present, late, absent, total: (attendanceData || []).length });

            } catch (error: any) {
                console.error("Error fetching student dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [session.user.id, profile.admission_numbers]);
    
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

    if (isLoading) {
        return <div className="flex items-center justify-center p-12 text-gray-500 dark:text-gray-400">Loading your dashboard...</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome, {profile.full_name}!</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Here's what's happening.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Widget title="Next Class Today">
                        {nextClass && nextClass.time_slot ? (
                             <div className="flex items-center space-x-5 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-sm">
                                <div className="text-center w-24 flex-shrink-0">
                                    <p className="font-bold text-brand-600 dark:text-brand-400">{formatTime(nextClass.time_slot.start_time)}</p>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">to {formatTime(nextClass.time_slot.end_time)}</p>
                                </div>
                                <div className="border-l-2 border-brand-200 dark:border-brand-700/50 pl-5">
                                    <p className="font-bold text-gray-900 dark:text-white">{nextClass.subject?.name || 'Break'}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-24 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No more classes scheduled for today.</p>
                            </div>
                        )}
                    </Widget>
                    <Widget title="Recent Performance">
                        {performance.length > 0 ? (
                            <ul className="space-y-4">
                                {performance.map(p => (
                                    <li key={p.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 transition-all hover:shadow-sm">
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white">{p.subject.name}</span>
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-2 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">{p.term}</span>
                                        </div>
                                        <span className={`font-black text-lg ${p.total_score && p.total_score >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{p.total_score}/100</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No recent assessment scores available.</p>
                            </div>
                        )}
                    </Widget>
                </div>
                <div className="space-y-6">
                    <Widget title="Quick Links" className="h-full">
                        <div className="grid grid-cols-2 gap-4">
                            <QuickAction title="View My Reports" icon={ReportsIcon} onClick={() => setActivePage('Reports')} />
                            <QuickAction title="Messages" icon={MessagesIcon} onClick={() => setActivePage('Messages')} />
                        </div>
                    </Widget>
                    <Widget title="Attendance (Last 30 School Days)">
                        {attendance.total > 0 ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/50">
                                    <span className="text-sm font-bold text-green-700 dark:text-green-400">Present</span>
                                    <span className="font-black text-green-700 dark:text-green-400">{attendance.present}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Late</span>
                                    <span className="font-black text-amber-700 dark:text-amber-400">{attendance.late}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/50">
                                    <span className="text-sm font-bold text-red-700 dark:text-red-400">Absent</span>
                                    <span className="font-black text-red-700 dark:text-red-400">{attendance.absent}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No attendance data available.</p>
                            </div>
                        )}
                    </Widget>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboardHome;
