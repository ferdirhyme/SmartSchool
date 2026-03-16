
import React from 'react';
import { Student, StudentAttendance } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    students: Student[];
    attendanceRecords: StudentAttendance[];
}

interface FilterData {
    class_id: string;
    startDate: string;
    endDate: string;
}

const getDatesInRange = (startDate: string, endDate: string): Date[] => {
    const dates = [];
    let currentDate = new Date(startDate);
    // Adjust for timezone issues by working in UTC
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

export const AttendanceReport: React.FC<{ data: ReportData, filters: FilterData }> = ({ data, filters }) => {
    const { students = [], attendanceRecords } = data;
    const { startDate, endDate } = filters;

    const dates = getDatesInRange(startDate, endDate);

    const attendanceMap = new Map<string, Map<string, StudentAttendance['status']>>();
    (attendanceRecords || []).forEach(rec => {
        if (!attendanceMap.has(rec.student_id)) {
            attendanceMap.set(rec.student_id, new Map());
        }
        attendanceMap.get(rec.student_id)!.set(rec.attendance_date, rec.status);
    });

    const getStudentSummary = (studentId: string) => {
        const studentRecords = attendanceMap.get(studentId);
        let present = 0, absent = 0, late = 0;
        
        dates.forEach(date => {
            const dateString = date.toISOString().split('T')[0];
            const status = studentRecords?.get(dateString);

            switch (status) {
                case 'Present':
                    present++;
                    break;
                case 'Late':
                    late++;
                    break;
                case 'Absent':
                    absent++;
                    break;
                default:
                    // If no record, it's counted as absent for the purpose of the report
                    absent++;
                    break;
            }
        });
        return { present, absent, late, total: dates.length };
    };
    
    const statusInfo: Record<StudentAttendance['status'] | 'unmarked', { char: string, color: string }> = {
        'Present': { char: 'P', color: 'bg-green-200' },
        'Absent': { char: 'A', color: 'bg-red-200' },
        'Late': { char: 'L', color: 'bg-yellow-200' },
        'unmarked': { char: 'A', color: 'bg-gray-100' }
    };

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Class Attendance Report</h2>
                <div className="text-center mb-8">
                    <p><strong>Date Range:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-gray-400 min-w-[500px]">
                        <thead className="bg-gray-100 text-[#722F37]">
                            <tr>
                                <th className="border p-1 text-left min-w-[150px]">Student Name</th>
                                {dates.map(date => (
                                    <th key={date.toISOString()} className="border p-1 text-center whitespace-nowrap">
                                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </th>
                                ))}
                                <th className="border p-1 text-center bg-green-100">P</th>
                                <th className="border p-1 text-center bg-red-100">A</th>
                                <th className="border p-1 text-center bg-yellow-100">L</th>
                                <th className="border p-1 text-center">Total Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(student => {
                                const summary = getStudentSummary(student.id!);
                                return (
                                    <tr key={student.id}>
                                        <td className="border p-1 font-medium">{student.full_name}</td>
                                        {dates.map(date => {
                                            const dateString = date.toISOString().split('T')[0];
                                            const status = attendanceMap.get(student.id!)?.get(dateString);
                                            const info = status ? statusInfo[status] : statusInfo['unmarked'];
                                            return (
                                                <td key={dateString} className={`border p-1 text-center ${info.color}`}>
                                                    {info.char}
                                                </td>
                                            );
                                        })}
                                        <td className="border p-1 text-center font-bold bg-green-100">{summary.present}</td>
                                        <td className="border p-1 text-center font-bold bg-red-100">{summary.absent}</td>
                                        <td className="border p-1 text-center font-bold bg-yellow-100">{summary.late}</td>
                                        <td className="border p-1 text-center font-bold">{summary.total}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-8 text-sm">
                    <h4 className="font-bold mb-2">Legend:</h4>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center"><div className="w-4 h-4 bg-green-200 mr-2 border border-gray-400"></div> P = Present</div>
                        <div className="flex items-center"><div className="w-4 h-4 bg-red-200 mr-2 border border-gray-400"></div> A = Absent</div>
                        <div className="flex items-center"><div className="w-4 h-4 bg-yellow-200 mr-2 border border-gray-400"></div> L = Late</div>
                    </div>
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
