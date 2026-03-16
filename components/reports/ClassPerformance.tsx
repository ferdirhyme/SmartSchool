
import React from 'react';
import { StudentAssessment, Class, Subject } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    scores: (StudentAssessment & {student: {full_name: string}})[];
}
interface FilterData {
    class?: Class;
    subject?: Subject;
    term?: string;
    year?: number;
}

export const ClassPerformanceReport: React.FC<{ data: ReportData; filters: FilterData }> = ({ data, filters }) => {
    const scores = data.scores || [];
    scores.sort((a,b) => (b.total_score || 0) - (a.total_score || 0)); // Sort descending by score
    
    const totalScores = scores.map(s => s.total_score || 0);
    const classAverage = totalScores.length ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0;
    const highestScore = totalScores.length ? Math.max(...totalScores) : 0;
    const lowestScore = totalScores.length ? Math.min(...totalScores) : 0;

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Class Performance Summary</h2>
                <div className="text-center mb-8">
                    <p>{filters.class?.name} - {filters.subject?.name} - {filters.term} {filters.year}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
                    <div className="p-4 bg-blue-100 rounded-md"><div className="text-sm font-bold">CLASS AVERAGE</div><div className="text-2xl font-bold">{classAverage.toFixed(2)}</div></div>
                    <div className="p-4 bg-green-100 rounded-md"><div className="text-sm font-bold">HIGHEST SCORE</div><div className="text-2xl font-bold">{highestScore}</div></div>
                    <div className="p-4 bg-red-100 rounded-md"><div className="text-sm font-bold">LOWEST SCORE</div><div className="text-2xl font-bold">{lowestScore}</div></div>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[500px]">
                    <thead className="bg-gray-100 text-[#722F37]">
                        <tr>
                            <th className="border p-2">Rank</th>
                            <th className="border p-2">Student Name</th>
                            <th className="border p-2">CA Score (/60)</th>
                            <th className="border p-2">Exam Score (/40)</th>
                            <th className="border p-2">Total Score (/100)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.map((s, index) => (
                            <tr key={s.id}>
                                <td className="border p-2 text-center">{index + 1}</td>
                                <td className="border p-2">{s.student?.full_name || 'N/A'}</td>
                                <td className="border p-2 text-center">{s.continuous_assessment_score}</td>
                                <td className="border p-2 text-center">{s.exam_score}</td>
                                <td className="border p-2 text-center font-bold">{s.total_score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
