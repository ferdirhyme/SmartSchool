
import React from 'react';
import { Student, StudentAssessment, Subject, Class } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    students: Student[];
    assessments: StudentAssessment[];
    subjects: Subject[];
}

interface FilterData {
    class?: Class;
    term?: string;
    year?: number;
}

export const BroadsheetReport: React.FC<{ data: ReportData, filters: FilterData }> = ({ data, filters }) => {
    const { students = [], assessments = [], subjects = [] } = data;
    
    // Create a map for quick lookup: studentId -> { subjectId -> score }
    const studentScoresMap = new Map<string, Map<string, number | null>>();
    assessments.forEach(a => {
        if (!studentScoresMap.has(a.student_id)) {
            studentScoresMap.set(a.student_id, new Map());
        }
        studentScoresMap.get(a.student_id)!.set(a.subject_id, a.total_score);
    });

    const studentTotals = students.map(student => {
        const scores = subjects.map(subject => studentScoresMap.get(student.id!)?.get(subject.id) || 0);
        const total = scores.reduce((sum, score) => sum + (score || 0), 0);
        const average = scores.length > 0 ? total / scores.length : 0;
        return { studentId: student.id, total, average };
    });
    
    // Sort students by average score to determine rank
    studentTotals.sort((a, b) => b.total - a.total);
    
    const studentRankMap = new Map<string, number>();
    studentTotals.forEach((s, index) => studentRankMap.set(s.studentId!, index + 1));
    
    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Broadsheet</h2>
                <div className="text-center mb-8">
                    <p>{filters.class?.name} - {filters.term} {filters.year}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-gray-400 min-w-[800px]">
                        <thead className="bg-gray-100 text-[#722F37]">
                            <tr>
                                <th className="border p-1">Rank</th>
                                <th className="border p-1 text-left">Student Name</th>
                                {subjects.map(s => <th key={s.id} className="border p-1 rotate-[-45deg] whitespace-nowrap">{s.name}</th>)}
                                <th className="border p-1">Total</th>
                                <th className="border p-1">Average</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(student => {
                                const totals = studentTotals.find(s => s.studentId === student.id);
                                return (
                                    <tr key={student.id}>
                                        <td className="border p-1 text-center">{studentRankMap.get(student.id!) || ''}</td>
                                        <td className="border p-1">{student.full_name}</td>
                                        {subjects.map(subject => (
                                            <td key={subject.id} className="border p-1 text-center">
                                                {studentScoresMap.get(student.id!)?.get(subject.id) ?? '-'}
                                            </td>
                                        ))}
                                        <td className="border p-1 text-center font-bold">{totals?.total.toFixed(2)}</td>
                                        <td className="border p-1 text-center font-bold">{totals?.average.toFixed(2)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
