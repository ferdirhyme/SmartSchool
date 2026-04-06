
import React from 'react';
import { Teacher, TeacherAttendance } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    teachers: Teacher[];
    records: (TeacherAttendance & { teacher: { full_name: string } })[];
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

export const TeacherAttendanceReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { teachers = [], records, startDate, endDate } = data;
    const dates = getDatesInRange(startDate, endDate);

    const attendanceMap = new Map<string, Map<string, string>>();
    (records || []).forEach(rec => {
        if (!attendanceMap.has(rec.teacher_id)) {
            attendanceMap.set(rec.teacher_id, new Map());
        }
        attendanceMap.get(rec.teacher_id)!.set(rec.attendance_date, rec.check_in_time);
    });

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Teacher Attendance Report</h2>
                <div className="text-center mb-8">
                    <p><strong>Date Range:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-gray-400 min-w-[500px]">
                        <thead className="bg-gray-100 text-[#722F37]">
                            <tr>
                                <th className="border p-1 text-left min-w-[150px]">Teacher Name</th>
                                {dates.map(date => (
                                    <th key={date.toISOString()} className="border p-1 text-center whitespace-nowrap">
                                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </th>
                                ))}
                                <th className="border p-1 text-center">Present</th>
                                <th className="border p-1 text-center">Absent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.map(teacher => {
                                let presentCount = 0;
                                return (
                                    <tr key={teacher.id}>
                                        <td className="border p-1 font-medium">{teacher.full_name}</td>
                                        {dates.map(date => {
                                            const dateString = date.toISOString().split('T')[0];
                                            const checkInTime = attendanceMap.get(teacher.id!)?.get(dateString);
                                            if (checkInTime) {
                                                presentCount++;
                                            }
                                            return (
                                                <td key={dateString} className={`border p-1 text-center ${checkInTime ? 'bg-green-100' : 'bg-red-100'}`}>
                                                    {checkInTime ? new Date(`1970-01-01T${checkInTime}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Absent'}
                                                </td>
                                            );
                                        })}
                                        <td className="border p-1 text-center font-bold bg-green-100">{presentCount}</td>
                                        <td className="border p-1 text-center font-bold bg-red-100">{dates.length - presentCount}</td>
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
