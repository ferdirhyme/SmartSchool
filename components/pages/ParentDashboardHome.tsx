import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Student, StudentAssessment, FeePayment, FeeType } from '../../types.ts';
import { AcademicsIcon, ReportsIcon, MessagesIcon } from '../icons/NavIcons.tsx';
import { CashIcon, UserCheckIcon } from '../icons/WidgetIcons.tsx';

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
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex items-center mb-4">
            <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
        </div>
        {children}
    </div>
);

const QuickAction: React.FC<{ title: string; icon: React.FC<{ className?: string }>; onClick: () => void; }> = ({ title, icon: Icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-full h-full">
        <Icon className="w-8 h-8 text-brand-600 dark:text-brand-400 mb-2" />
        <span className="text-sm font-semibold text-gray-700 dark:text-white text-center">{title}</span>
    </button>
);

const ParentDashboardHome: React.FC<ParentDashboardHomeProps> = ({ profile, setActivePage }) => {
    const [children, setChildren] = useState<(Student & { class: { name: string } | null })[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [childData, setChildData] = useState<ChildData | null>(null);
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
                
                // Fetch attendance for the last 30 days
                const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
                const { data: attendanceData } = await supabase.from('student_attendance').select('status').eq('student_id', selectedChildId).gte('attendance_date', thirtyDaysAgo);

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

            } catch (error) {
                console.error("Error fetching child data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchChildData();
    }, [selectedChildId, children]);

    if (children.length === 0 && !isLoading) {
        return <p>No children linked to this account. Please ensure your ward's admission number is correct in your profile.</p>;
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
            
            {isLoading ? <p>Loading dashboard for {children.find(c=>c.id === selectedChildId)?.full_name}...</p> : childData && (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                         <Widget icon={ReportsIcon} title="Quick Links">
                             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                <QuickAction title="View Ward's Reports" icon={ReportsIcon} onClick={() => setActivePage('Reports')} />
                                <QuickAction title="Top Up Balance" icon={CashIcon} onClick={() => setActivePage('Billing')} />
                                <QuickAction title="Messages" icon={MessagesIcon} onClick={() => setActivePage('Messages')} />
                            </div>
                        </Widget>
                        <Widget icon={AcademicsIcon} title="Performance Snapshot">
                            {childData.assessments.length > 0 ? (
                                <ul className="space-y-3">
                                    {childData.assessments.map(p => (
                                        <li key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                            <span className="font-semibold text-gray-800 dark:text-white">{p.subject.name}</span>
                                            <span className={`font-bold text-lg ${p.total_score && p.total_score >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{p.total_score}/100</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">No recent assessment scores available.</p>
                            )}
                        </Widget>
                    </div>

                     <div className="space-y-6">
                        <Widget icon={CashIcon} title="Fee & Billing Status">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding Balance</p>
                                <p className={`text-3xl font-bold ${childData.fees.outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    GHS {childData.fees.outstanding.toFixed(2)}
                                </p>
                            </div>
                             <div className="mt-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Credit Balance</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                    GHS {profile.credit_balance.toFixed(2)}
                                </p>
                            </div>
                            <button onClick={() => setActivePage('Billing')} className="mt-4 w-full text-sm font-medium text-brand-600 hover:underline">Pay Fees / Top Up Credit</button>
                        </Widget>

                        <Widget icon={UserCheckIcon} title="Attendance (Last 30 Days)">
                             {childData.attendance.total > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><span className="text-green-600 dark:text-green-400">Present</span><span className="font-bold">{childData.attendance.present}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-yellow-600 dark:text-yellow-400">Late</span><span className="font-bold">{childData.attendance.late}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-red-500 dark:text-red-400">Absent</span><span className="font-bold">{childData.attendance.absent}</span></div>
                                </div>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">No data available.</p>
                            )}
                        </Widget>
                     </div>
                 </div>
            )}
        </div>
    );
};

export default ParentDashboardHome;