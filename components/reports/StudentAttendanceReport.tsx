
import React from 'react';
import { StudentProfile, StudentAttendance } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ReportData {
    student: StudentProfile;
    records: StudentAttendance[];
    startDate: string;
    endDate: string;
}

const getDatesInRange = (startDate: string, endDate: string): Date[] => {
    const dates = [];
    let currentDate = new Date(startDate);
    currentDate.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(0, 0, 0, 0);

    while (currentDate <= end) {
        const day = currentDate.getUTCDay();
        if (day > 0 && day < 6) { // Monday to Friday
            dates.push(new Date(currentDate));
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return dates;
};

export const StudentAttendanceReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { student, records, startDate, endDate } = data;

    const dates = getDatesInRange(startDate, endDate);
    const attendanceMap = new Map<string, StudentAttendance['status']>();
    (records || []).forEach(rec => {
        attendanceMap.set(rec.attendance_date, rec.status);
    });

    let present = 0, absent = 0, late = 0;
    dates.forEach(date => {
        const dateString = date.toISOString().split('T')[0];
        const status = attendanceMap.get(dateString);
        if (status === 'Present') present++;
        else if (status === 'Late') late++;
        else absent++;
    });

    const chartData = [
        { name: 'Present', value: present },
        { name: 'Late', value: late },
        { name: 'Absent', value: absent },
    ].filter(d => d.value > 0);

    const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

    const statusInfo: Record<StudentAttendance['status'] | 'unmarked', { text: string, color: string }> = {
        'Present': { text: 'Present', color: 'bg-green-100 text-green-800' },
        'Absent': { text: 'Absent', color: 'bg-red-100 text-red-800' },
        'Late': { text: 'Late', color: 'bg-yellow-100 text-yellow-800' },
        'unmarked': { text: 'Absent (Unmarked)', color: 'bg-gray-100 text-gray-800' }
    };

    return (
        <div className="flex flex-col p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-black my-8 text-brand-600 uppercase tracking-widest">Attendance Summary</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 items-center">
                    <div className="p-8 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Student Name</p>
                                <p className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">{student.full_name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Admission No</p>
                                    <p className="font-bold">{student.admission_number}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Class</p>
                                    <p className="font-bold">{student.class?.name}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Assessment Period</p>
                                <p className="text-sm font-bold">{new Date(startDate).toLocaleDateString(undefined, { dateStyle: 'long' })} — {new Date(endDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-700 p-4">
                         <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 font-mono">Term Distribution</p>
                         <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                                />
                                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 text-center">
                    <div className="p-4 bg-green-100 rounded-md"><div className="text-sm font-bold">PRESENT</div><div className="text-2xl font-bold">{present}</div></div>
                    <div className="p-4 bg-red-100 rounded-md"><div className="text-sm font-bold">ABSENT</div><div className="text-2xl font-bold">{absent}</div></div>
                    <div className="p-4 bg-yellow-100 rounded-md"><div className="text-sm font-bold">LATE</div><div className="text-2xl font-bold">{late}</div></div>
                    <div className="p-4 bg-gray-100 rounded-md"><div className="text-sm font-bold">TOTAL DAYS</div><div className="text-2xl font-bold">{dates.length}</div></div>
                </div>
                
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[500px]">
                    <thead className="bg-gray-100 text-[#722F37]">
                        <tr>
                            <th className="border p-2">Date</th>
                            <th className="border p-2">Day</th>
                            <th className="border p-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dates.map(date => {
                            const dateString = date.toISOString().split('T')[0];
                            const status = attendanceMap.get(dateString);
                            const info = status ? statusInfo[status] : statusInfo['unmarked'];
                            return (
                                <tr key={dateString}>
                                    <td className="border p-2">{new Date(date).toLocaleDateString()}</td>
                                    <td className="border p-2">{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</td>
                                    <td className={`border p-2 font-medium ${info.color}`}>{info.text}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
