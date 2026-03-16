
import React from 'react';
import { Student } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface StudentWithClass extends Student {
    class: { name: string } | null;
}

interface ReportData {
    students: StudentWithClass[];
}

export const ClassListReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { students = [] } = data;
    const className = students[0]?.class?.name || 'Selected Class';

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader title="Class List" />
                <div className="text-center mb-8">
                    <p className="text-xl font-semibold">{className}</p>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[500px]">
                    <thead className="bg-gray-100 text-[#722F37]">
                        <tr>
                            <th className="border p-2">#</th>
                            <th className="border p-2">Admission No.</th>
                            <th className="border p-2">Full Name</th>
                            <th className="border p-2">Gender</th>
                            <th className="border p-2">Guardian's Contact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s, index) => (
                            <tr key={s.id}>
                                <td className="border p-2">{index + 1}</td>
                                <td className="border p-2">{s.admission_number}</td>
                                <td className="border p-2">{s.full_name}</td>
                                <td className="border p-2">{s.gender}</td>
                                <td className="border p-2">{s.guardian_contact}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                    {students.length === 0 && <p className="text-center p-4">No students found in this class.</p>}
            </main>
            <ReportFooter />
        </div>
    );
};
