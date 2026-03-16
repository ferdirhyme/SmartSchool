
import React from 'react';
import { StudentProfile, StudentAttendance } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

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

    const statusInfo: Record<StudentAttendance['status'] | 'unmarked', { text: string, color: string }> = {
        'Present': { text: 'Present', color: 'bg-green-100 text-green-800' },
        'Absent': { text: 'Absent', color: 'bg-red-100 text-red-800' },
        'Late': { text: 'Late', color: 'bg-yellow-100 text-yellow-800' },
        'unmarked': { text: 'Absent (Unmarked)', color: 'bg-gray-100 text-gray-800' }
    };

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Student Attendance Report</h2>
                <div className="mb-8 p-4 border border-gray-300 rounded-md">
                    <p><strong>Student:</strong> {student.full_name}</p>
                    <p><strong>Admission No:</strong> {student.admission_number}</p>
                    <p><strong>Class:</strong> {student.class?.name}</p>
                    <p><strong>Date Range:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
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
