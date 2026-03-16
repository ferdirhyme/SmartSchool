import React from 'react';
import { Teacher, TeacherAttendance } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    teacher: Teacher;
    records: TeacherAttendance[];
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

export const IndividualTeacherAttendanceReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { teacher, records = [], startDate, endDate } = data;

    const handlePrint = () => {
        const printArea = document.querySelector('.print-area');
        if (printArea) {
            const printWindow = window.open('', '_blank', 'width=900,height=650');
            if(!printWindow) {
                alert('Please allow pop-ups to print the report.');
                return;
            }
            const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(el => el.outerHTML)
                .join('');
            const tailwindScript = `<script src="https://cdn.tailwindcss.com"></script>`;
            const tailwindConfigScript = Array.from(document.head.querySelectorAll('script'))
                .find(s => s.textContent?.includes('tailwind.config'))?.outerHTML || '';
            const printStyles = `<style>body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>`;

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Teacher Attendance Report</title>
                        ${styles}
                        ${tailwindScript}
                        ${tailwindConfigScript}
                        ${printStyles}
                    </head>
                    <body class="bg-white">
                        ${printArea.innerHTML}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                }, 500);
            };
        }
    };

    const dates = getDatesInRange(startDate, endDate);
    const attendanceMap = new Map<string, string>();
    records.forEach(rec => {
        attendanceMap.set(rec.attendance_date, rec.check_in_time);
    });

    const presentCount = records.length;
    const absentCount = dates.length - presentCount;

    return (
        <div>
            <div className="flex justify-end mb-4 no-print">
                <button onClick={handlePrint} className="px-4 py-2 bg-brand-600 text-white rounded-md">Print Report</button>
            </div>
            <div className="print-area flex flex-col p-4 bg-gray-50 text-gray-900">
                <main className="flex-grow">
                    <ReportHeader />
                    <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Teacher Attendance Report</h2>
                    <div className="mb-8 p-4 border border-gray-300 rounded-md">
                        <p><strong>Teacher:</strong> {teacher.full_name}</p>
                        <p><strong>Staff ID:</strong> {teacher.staff_id}</p>
                        <p><strong>Date Range:</strong> {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                        <div className="p-4 bg-green-100 rounded-md"><div className="text-sm font-bold">PRESENT</div><div className="text-2xl font-bold">{presentCount}</div></div>
                        <div className="p-4 bg-red-100 rounded-md"><div className="text-sm font-bold">ABSENT</div><div className="text-2xl font-bold">{absentCount}</div></div>
                        <div className="p-4 bg-gray-100 rounded-md"><div className="text-sm font-bold">TOTAL DAYS</div><div className="text-2xl font-bold">{dates.length}</div></div>
                    </div>
                    
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[500px]">
                        <thead className="bg-gray-100 text-[#722F37]">
                            <tr>
                                <th className="border p-2">Date</th>
                                <th className="border p-2">Day</th>
                                <th className="border p-2">Status</th>
                                <th className="border p-2">Check-in Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dates.map(date => {
                                const dateString = date.toISOString().split('T')[0];
                                const checkInTime = attendanceMap.get(dateString);
                                return (
                                    <tr key={dateString}>
                                        <td className="border p-2">{new Date(date).toLocaleDateString()}</td>
                                        <td className="border p-2">{new Date(date).toLocaleDateString('en-US', { weekday: 'long' })}</td>
                                        <td className={`border p-2 font-medium ${checkInTime ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {checkInTime ? 'Present' : 'Absent'}
                                        </td>
                                        <td className="border p-2">{checkInTime ? new Date(checkInTime).toLocaleTimeString() : 'N/A'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </main>
                <ReportFooter />
            </div>
        </div>
    );
};