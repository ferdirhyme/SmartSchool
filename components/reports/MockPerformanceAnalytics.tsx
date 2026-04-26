
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface MockAnalyticsData {
    analytics: {
        student: { full_name: string; admission_number: string };
        scores: any[];
        total: number;
    }[];
    classId: string;
    mockTag: string;
    subjects: any[];
}

const getPredictiveGrade = (avg: number) => {
    if (avg >= 80) return { grade: '1', remark: 'Excellent (Certain A1)' };
    if (avg >= 70) return { grade: '2', remark: 'Very Good (Strong A1/B2)' };
    if (avg >= 60) return { grade: '3', remark: 'Good (Likely B3)' };
    if (avg >= 50) return { grade: '4', remark: 'Average (Passable)' };
    return { grade: '9', remark: 'Critical (Likely Fail)' };
};

export const MockPerformanceAnalytics: React.FC<{ data: MockAnalyticsData }> = ({ data }) => {
    const { analytics, mockTag } = data;

    const chartData = analytics.slice(0, 10).map(item => ({
        name: item.student.full_name.split(' ')[0],
        total: item.total,
        average: parseFloat((item.total / (item.scores.length || 1)).toFixed(2))
    }));

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <ReportHeader />
            
            <div className="mt-8 mb-4 flex flex-col items-center text-center">
                <h2 className="text-2xl font-black text-brand-600 uppercase tracking-widest">{mockTag} Performance Analytics</h2>
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">WAEC Examination Predictive Model</p>
            </div>

            {/* Performance Overview Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Top 10 Performance Trend</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend iconType="circle" />
                            <Bar dataKey="average" name="Average Score %" fill="#722F37" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Table & Prediction */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                            <th className="p-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Position</th>
                            <th className="p-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Student Name</th>
                            <th className="p-4 text-center text-xs font-black uppercase tracking-widest text-gray-400">Total Score</th>
                            <th className="p-4 text-center text-xs font-black uppercase tracking-widest text-gray-400">Avg %</th>
                            <th className="p-4 text-center text-xs font-black uppercase tracking-widest text-gray-400">WAEC Prediction</th>
                            <th className="p-4 text-left text-xs font-black uppercase tracking-widest text-gray-400">Recommendation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {analytics.map((item, index) => {
                            const avg = item.total / (item.scores.length || 1);
                            const prediction = getPredictiveGrade(avg);
                            return (
                                <tr key={item.student.admission_number} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4 font-black text-lg text-gray-400">#{index + 1}</td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900 dark:text-white">{item.student.full_name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">{item.student.admission_number}</div>
                                    </td>
                                    <td className="p-4 text-center font-bold text-gray-700 dark:text-gray-300">{item.total}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${avg >= 70 ? 'bg-green-100 text-green-700' : avg >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                            {avg.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className={`text-xl font-black ${avg >= 80 ? 'text-green-600' : avg >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                                            Grade {prediction.grade}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400">{prediction.remark}</div>
                                        {avg < 50 && (
                                            <div className="text-[10px] text-red-500 font-black uppercase mt-1">Intervention Required</div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="my-10 text-center">
                <p className="text-[10px] text-gray-400 font-medium italic">
                    * This WAEC prediction is based on standard Ghanaian performance models and previous years' entry metrics. 
                    Actual results may vary depending on final external examination conditions.
                </p>
            </div>

            <ReportFooter />
        </div>
    );
};
