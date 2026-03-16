
import React, { useMemo } from 'react';
import { StudentProfile, StudentAssessment } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    student: StudentProfile & { class: { id: string; name: string } | null };
    assessments?: (StudentAssessment & { subject: { name: string }; class: { id: string, name: string } | null })[] | null;
}

// A simple component to render the SVG line chart
const ProgressChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    const width = 800;
    const height = 400;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    if (!data || data.length === 0) return null;

    const maxValue = 100;
    const xScale = (index: number) => (index / (data.length - 1)) * chartWidth;
    const yScale = (value: number) => chartHeight - (value / maxValue) * chartHeight;

    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.value)}`).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y-axis lines and labels */}
                {[0, 25, 50, 75, 100].map(val => (
                    <g key={val}>
                        <line x1="0" x2={chartWidth} y1={yScale(val)} y2={yScale(val)} stroke="#e5e7eb" strokeDasharray="2" />
                        <text x="-10" y={yScale(val) + 5} textAnchor="end" fill="#6b7280" fontSize="12">{val}</text>
                    </g>
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => (
                    <text key={i} x={xScale(i)} y={chartHeight + 20} textAnchor="middle" fill="#6b7280" fontSize="12">{d.label}</text>
                ))}
                
                {/* Line and Points */}
                <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
                {data.map((d, i) => (
                    <circle key={i} cx={xScale(i)} cy={yScale(d.value)} r="4" fill="#3b82f6" />
                ))}
            </g>
        </svg>
    );
};

type AssessmentItem = StudentAssessment & { subject: { name: string }; class: { id: string, name: string } | null };

export const StudentProgressReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { student } = data;
    const assessments = data.assessments || [];

    const processedData: {
        byTerm: Record<string, AssessmentItem[]>;
        stats: { overallAverage: number; highest: number; lowest: number };
        chartData: { label: string; value: number }[];
    } = useMemo(() => {
        if (!assessments || assessments.length === 0) {
            return { 
                byTerm: {} as Record<string, AssessmentItem[]>, 
                stats: { overallAverage: 0, highest: 0, lowest: 0 }, 
                chartData: [] 
            };
        }
        
        const byTerm: Record<string, AssessmentItem[]> = {};
        assessments.forEach(a => {
            const className = a.class?.name || 'Unknown Class';
            const key = `${className} - ${a.year} - ${a.term}`;
            if (!byTerm[key]) byTerm[key] = [];
            byTerm[key].push(a);
        });

        const termAverages = Object.entries(byTerm).map(([key, termAssessments]) => {
            const assessmentsList = termAssessments as AssessmentItem[];
            const total = assessmentsList.reduce((sum, a) => sum + (a.total_score || 0), 0);
            const average = assessmentsList.length > 0 ? total / assessmentsList.length : 0;
            return { termKey: key, average };
        }) as { termKey: string; average: number }[];

        const overallAverage = termAverages.length > 0 ? termAverages.reduce((sum, t) => sum + t.average, 0) / termAverages.length : 0;
        const highest = termAverages.length > 0 ? Math.max(...termAverages.map(t => t.average)) : 0;
        const lowest = termAverages.length > 0 ? Math.min(...termAverages.map(t => t.average)) : 0;
        
        const chartData = termAverages.map(t => ({ label: t.termKey, value: t.average }));

        return { 
            byTerm, 
            stats: { overallAverage, highest, lowest },
            chartData
        };
    }, [assessments]);

    if (!assessments || assessments.length === 0) {
        return (
            <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
                <ReportHeader />
                <div className="text-center my-16">
                    <h2 className="text-xl font-semibold">No Assessment Records Found</h2>
                    <p className="text-gray-600 mt-2">
                        No historical performance data is available for {student.full_name}.
                    </p>
                </div>
                <ReportFooter />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Student Progress Report</h2>

                {/* Student Info */}
                <div className="mb-8 p-4 border border-gray-300 rounded-md">
                    <p><strong>Student:</strong> {student.full_name}</p>
                    <p><strong>Admission No:</strong> {student.admission_number}</p>
                    <p><strong>Current Class:</strong> {student.class?.name}</p>
                </div>

                {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
                    <div className="p-4 bg-blue-100 rounded-md"><div className="text-sm font-bold">OVERALL AVERAGE</div><div className="text-2xl font-bold">{processedData.stats.overallAverage?.toFixed(2)}%</div></div>
                    <div className="p-4 bg-green-100 rounded-md"><div className="text-sm font-bold">HIGHEST TERM AVG</div><div className="text-2xl font-bold">{processedData.stats.highest?.toFixed(2)}%</div></div>
                    <div className="p-4 bg-red-100 rounded-md"><div className="text-sm font-bold">LOWEST TERM AVG</div><div className="text-2xl font-bold">{processedData.stats.lowest?.toFixed(2)}%</div></div>
                </div>

                {/* Chart */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-center mb-4">Performance Trend</h3>
                    <ProgressChart data={processedData.chartData} />
                </div>

                {/* Detailed Breakdown Table */}
                <div>
                    <h3 className="text-lg font-bold text-center mb-4">Detailed Performance History</h3>
                    {Object.entries(processedData.byTerm).map(([termKey, termAssessmentsUntyped]) => {
                        const termAssessments = termAssessmentsUntyped as AssessmentItem[];
                        const termTotal = termAssessments.reduce((sum, a) => sum + (a.total_score || 0), 0);
                        const termAverage = termAssessments.length > 0 ? termTotal / termAssessments.length : 0;
                        return (
                            <div key={termKey} className="mb-6">
                                <h4 className="font-bold bg-gray-100 p-2 border border-b-0 border-gray-400">{termKey}</h4>
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse border border-gray-400 min-w-[300px]">
                                    <thead className="bg-gray-100 text-[#722F37]">
                                        <tr>
                                            <th className="border p-2 text-left">Subject</th>
                                            <th className="border p-2">Score (/100)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {termAssessments.map(a => (
                                            <tr key={a.id}>
                                                <td className="border p-2">{a.subject.name}</td>
                                                <td className="border p-2 text-center">{a.total_score}</td>
                                            </tr>
                                        ))}
                                            <tr className="font-bold bg-gray-100">
                                            <td className="border p-2 text-right">Term Average:</td>
                                            <td className="border p-2 text-center">{termAverage.toFixed(2)}%</td>
                                        </tr>
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
