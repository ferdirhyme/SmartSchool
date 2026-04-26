import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, StudentAttendance, Student, StudentAssessment } from '../../types.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { AcademicsIcon, ReportsIcon, MessagesIcon } from '../icons/NavIcons.tsx';
import { CashIcon, UserCheckIcon } from '../icons/WidgetIcons.tsx';
import { PerformanceLineChart, AttendanceDonutChart } from '../DashboardCharts.tsx';
import { TrendingUp, Target, Award } from 'lucide-react';

interface ParentDashboardHomeProps {
  profile: Profile;
  setActivePage: (page: string) => void;
}

interface ChildData {
  student: Student & { class: { name: string } | null };
  assessments: (StudentAssessment & { subject: { name: string } })[];
  attendance: { present: number, late: number, absent: number, total: number };
  fees: { outstanding: number, totalBilled: number };
}

const Widget: React.FC<{ icon: React.FC<{ className?: string }>; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
        <div className="flex items-center mb-6">
            <div className="p-3 bg-brand-50 dark:bg-brand-900/50 rounded-xl mr-4">
                <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
        </div>
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

const ParentDashboardHome: React.FC<ParentDashboardHomeProps> = ({ profile, setActivePage }) => {
    const { settings } = useSettings();
    const [children, setChildren] = useState<(Student & { class: { name: string } | null })[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [childData, setChildData] = useState<ChildData | null>(null);
    const [performanceTrend, setPerformanceTrend] = useState<any[]>([]);
    const [attendanceBreakdown, setAttendanceBreakdown] = useState<any[]>([]);
    const [classRank, setClassRank] = useState<{ rank: number, total: number } | null>(null);
    const [gradeGrowth, setGradeGrowth] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchChildren = async () => {
            if (!profile.admission_numbers || profile.admission_numbers.length === 0) {
                setIsLoading(false);
                return;
            }
            const { data, error } = await supabase
                .from('students')
                .select('*, class:classes(name)')
                .in('admission_number', profile.admission_numbers);

            if (data) {
                setChildren(data as any[]);
                if (data.length > 0) {
                    setSelectedChildId(data[0].id!);
                }
            }
             setIsLoading(false);
        };
        fetchChildren();
    }, [profile.admission_numbers]);
    
    useEffect(() => {
        if (!selectedChildId) {
            setChildData(null);
            return;
        }

        const selectedChild = children.find(c => c.id === selectedChildId);
        if (!selectedChild) {
            // This is a transient state while children array updates, so we wait.
            return;
        }

        const fetchChildData = async () => {
            setIsLoading(true);
            try {
                // Fetch assessments
                const { data: assessments } = await supabase.from('student_assessments').select('*, subject:subjects(name)').eq('student_id', selectedChildId).order('year', { ascending: false }).order('term', { ascending: false }).limit(5);
                
                // Fetch attendance
                let startDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
                if (settings?.term_start_date) {
                    startDate = settings.term_start_date;
                }
                
                let attendanceQuery = supabase
                    .from('student_attendance')
                    .select('status')
                    .eq('student_id', selectedChildId)
                    .gte('attendance_date', startDate);
                
                if (settings?.term_end_date) {
                    attendanceQuery = attendanceQuery.lte('attendance_date', settings.term_end_date);
                }

                const { data: attendanceData } = await attendanceQuery;

                let present = 0, late = 0, absent = 0;
                (attendanceData || []).forEach(rec => {
                    if (rec.status === 'Present') present++; else if (rec.status === 'Late') late++; else absent++;
                });

                // Fetch fee status
                const { data: feeTypes } = await supabase.from('fee_types').select('id, default_amount').gt('default_amount', 0);
                const { data: payments } = await supabase.from('fee_payments').select('fee_type_id, amount_paid').eq('student_id', selectedChildId);

                let totalBilled = (feeTypes || []).reduce((sum, ft) => sum + (ft.default_amount || 0), 0);
                let totalPaid = (payments || []).reduce((sum, p) => sum + p.amount_paid, 0);

                setChildData({
                    student: selectedChild,
                    assessments: (assessments || []) as any[],
                    attendance: { present, late, absent, total: (attendanceData || []).length },
                    fees: { outstanding: Math.max(0, totalBilled - totalPaid), totalBilled }
                });

                // Performance Trend for Line Chart
                const { data: allAssessments } = await supabase
                    .from('student_assessments')
                    .select('*')
                    .eq('student_id', selectedChildId)
                    .order('year', { ascending: true })
                    .order('term', { ascending: true });

                const trend = (allAssessments || []).reduce((acc: any, a) => {
                    const key = `T${a.term} ${a.year}`;
                    if (!acc[key]) acc[key] = { name: key, total: 0, count: 0 };
                    acc[key].total += a.total_score || 0;
                    acc[key].count++;
                    return acc;
                }, {});

                const trendData = Object.values(trend).map((t: any) => ({
                    name: t.name,
                    score: t.total / t.count
                }));
                setPerformanceTrend(trendData);

                // Class Rank Calculation (Heuristic: Average of recent assessments vs peers)
                if (selectedChild.class_id) {
                    const { data: classAssessments } = await supabase
                        .from('student_assessments')
                        .select('student_id, total_score')
                        .eq('class_id', selectedChild.class_id);
                    
                    if (classAssessments && classAssessments.length > 0) {
                        const studentTotals: any = {};
                        classAssessments.forEach(a => {
                            if (!studentTotals[a.student_id]) studentTotals[a.student_id] = { total: 0, count: 0 };
                            studentTotals[a.student_id].total += a.total_score || 0;
                            studentTotals[a.student_id].count++;
                        });

                        const sortedStudents = Object.keys(studentTotals).map(sid => ({
                            id: sid,
                            avg: studentTotals[sid].total / studentTotals[sid].count
                        })).sort((a, b) => b.avg - a.avg);

                        const myRank = sortedStudents.findIndex(s => s.id === selectedChildId) + 1;
                        setClassRank({ rank: myRank, total: sortedStudents.length });
                    }
                }

                // Grade Growth
                if (trendData.length >= 2) {
                    const latest = trendData[trendData.length - 1].score;
                    const secondLatest = trendData[trendData.length - 2].score;
                    setGradeGrowth(secondLatest > 0 ? ((latest - secondLatest) / secondLatest) * 100 : 0);
                }

                // Attendance Breakdown
                setAttendanceBreakdown([
                    { name: 'Present', value: present, color: '#10B981' },
                    { name: 'Late', value: late, color: '#FBBF24' },
                    { name: 'Absent', value: absent, color: '#EF4444' },
                ]);

            } catch (error) {
                console.error("Error fetching child data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChildData();
    }, [selectedChildId, children]);

    if (children.length === 0 && !isLoading) {
        return <p className="p-12 text-center text-gray-500 italic">No children linked to this account. Please ensure your ward's admission number is correct in your profile settings.</p>;
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {profile.full_name}!</h1>
                {children.length > 1 && (
                    <div>
                        <label htmlFor="child-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Viewing Dashboard For</label>
                        <select id="child-selector" value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            {children.map(child => <option key={child.id} value={child.id}>{child.full_name}</option>)}
                        </select>
                    </div>
                )}
            </div>
            
            {isLoading ? <p className="p-8 text-center text-gray-500 font-medium">Updating dashboard analytics...</p> : childData && (
                 <div className="space-y-6">
                    {/* Infographic Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                            <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl">
                                <Award className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Class Rank</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {classRank ? `${classRank.rank}${['st','nd','rd','th'][Math.min(((classRank.rank%10)-1), 3)] || 'th'} / ${classRank.total}` : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Grade Growth</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {gradeGrowth !== null ? `${gradeGrowth > 0 ? '+' : ''}${gradeGrowth.toFixed(1)}%` : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-5">
                            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl">
                                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Attendance</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{((childData.attendance.present / (childData.attendance.total || 1)) * 100).toFixed(0)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <PerformanceLineChart data={performanceTrend} title="Academic Growth Trend" />
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <AttendanceDonutChart data={attendanceBreakdown} title="Recent Attendance Breakdown" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Widget icon={ReportsIcon} title="Quick Links">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    <QuickAction title="View Ward's Reports" icon={ReportsIcon} onClick={() => setActivePage('Reports')} />
                                    <QuickAction title="Top Up Balance" icon={CashIcon} onClick={() => setActivePage('Billing')} />
                                    <QuickAction title="Messages" icon={MessagesIcon} onClick={() => setActivePage('Messages')} />
                                </div>
                            </Widget>
                            <Widget icon={AcademicsIcon} title="Performance Snapshot">
                                {childData.assessments.length > 0 ? (
                                    <ul className="space-y-4">
                                        {childData.assessments.map(p => (
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
                            <Widget icon={CashIcon} title="Fee & Billing Status">
                                <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 mb-4">
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Outstanding Balance</p>
                                    <p className={`text-4xl font-black ${childData.fees.outstanding > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        GHS {childData.fees.outstanding.toFixed(2)}
                                    </p>
                                </div>
                                <div className="p-5 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800/50">
                                    <p className="text-sm font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-1">Credit Balance</p>
                                    <p className="text-3xl font-black text-brand-900 dark:text-brand-100">
                                        GHS {profile.credit_balance.toFixed(2)}
                                    </p>
                                </div>
                                <button onClick={() => setActivePage('Billing')} className="mt-5 w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-all active:scale-[0.98]">Pay Fees / Top Up Credit</button>
                            </Widget>

                            <Widget icon={UserCheckIcon} title={`Attendance (${settings?.current_term || 'This Term'})`}>
                                 {childData.attendance.total > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/50">
                                            <span className="text-sm font-bold text-green-700 dark:text-green-400">Present</span>
                                            <span className="font-black text-green-700 dark:text-green-400">{childData.attendance.present}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/50">
                                            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">Late</span>
                                            <span className="font-black text-amber-700 dark:text-amber-400">{childData.attendance.late}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/50">
                                            <span className="text-sm font-bold text-red-700 dark:text-red-400">Absent</span>
                                            <span className="font-black text-red-700 dark:text-red-400">{childData.attendance.absent}</span>
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
            )}
        </div>
    );
};

export default ParentDashboardHome;
