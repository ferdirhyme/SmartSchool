
import React from 'react';
import { StudentProfile, StudentAssessment, StudentTermReport } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    student: StudentProfile & { class: { id: string; name: string } | null };
    assessments?: (StudentAssessment & { subject: { name: string } })[] | null;
    allClassAssessments?: (Pick<StudentAssessment, 'student_id' | 'subject_id' | 'total_score'>)[] | null;
    termDetails?: StudentTermReport;
    term: string;
    year: number;
    classStudentsCount: number;
    vacationDate?: string;
    reopeningDate?: string;
}

const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getGradeInfo = (score: number | null) => {
    if (score === null || isNaN(score)) return { grade: '-', point: '-', remark: '-' };
    if (score >= 80) return { grade: 'A1', point: '1', remark: 'Excellent' };
    if (score >= 70) return { grade: 'B2', point: '2', remark: 'Very Good' };
    if (score >= 65) return { grade: 'B3', point: '3', remark: 'Good' };
    if (score >= 60) return { grade: 'C4', point: '4', remark: 'Credit' };
    if (score >= 55) return { grade: 'C5', point: '5', remark: 'Credit' };
    if (score >= 50) return { grade: 'C6', point: '6', remark: 'Credit' };
    if (score >= 45) return { grade: 'D7', point: '7', remark: 'Pass' };
    if (score >= 40) return { grade: 'E8', point: '8', remark: 'Pass' };
    return { grade: 'F9', point: '9', remark: 'Fail' };
};

export const StudentReportCard: React.FC<{ data: ReportData }> = ({ data }) => {
    const { student, term, year, classStudentsCount, vacationDate, reopeningDate, termDetails } = data;
    const assessments = data.assessments || [];
    const allClassAssessments = data.allClassAssessments || [];
    
    if (!student) {
        return (
            <div className="p-4 font-sans flex flex-col bg-gray-50 text-gray-900">
                <ReportHeader />
                <div className="text-center my-16">
                    <h2 className="text-xl font-semibold">Student Not Found</h2>
                    <p className="text-gray-600 mt-2">
                        The student's data could not be loaded for this report.
                    </p>
                </div>
                <ReportFooter />
            </div>
        );
    }

    // Gracefully handle no assessment data
    if (!assessments || assessments.length === 0) {
        return (
            <div className="p-4 font-sans flex flex-col bg-gray-50 text-gray-900">
                <ReportHeader />
                <div className="text-center my-16">
                    <h2 className="text-xl font-semibold">No Assessment Records Found</h2>
                    <p className="text-gray-600 mt-2">
                        There are no scores recorded for {student.full_name} for {term}, {year} in {student.class?.name}.
                    </p>
                </div>
                <ReportFooter />
            </div>
        );
    }

    // --- Calculation Helpers ---
    const getSubjectPosition = (subjectId: string): string => {
        const subjectScores = allClassAssessments
            .filter(a => a.subject_id === subjectId && a.total_score !== null)
            .map(a => a.total_score as number)
            .sort((a, b) => b - a);
        const studentScore = assessments.find(a => a.subject_id === subjectId)?.total_score;
        if (studentScore === null || studentScore === undefined) return '-';
        
        const rank = subjectScores.indexOf(studentScore) + 1;
        return rank > 0 ? getOrdinal(rank) : '-';
    };

    const getClassPosition = (): string => {
        const totalScoresByStudent: Record<string, number> = {};
        allClassAssessments.forEach(a => {
            if(a.total_score !== null) {
                totalScoresByStudent[a.student_id] = (totalScoresByStudent[a.student_id] || 0) + a.total_score;
            }
        });
        const allTotals = Object.values(totalScoresByStudent).sort((a, b) => b - a);
        const studentTotal = assessments.reduce((sum, a) => sum + (a.total_score || 0), 0);
        const rank = allTotals.indexOf(studentTotal) + 1;
        return rank > 0 ? getOrdinal(rank) : '-';
    };

    const grandTotal = assessments.reduce((sum, a) => sum + (a.total_score || 0), 0);
    const maxScore = assessments.length * 100;
    const average = maxScore > 0 ? (grandTotal / assessments.length) : 0;
    const academicYear = `${year}/${year + 1}`;
    const age = student.date_of_birth ? new Date().getFullYear() - new Date(student.date_of_birth).getFullYear() : 'N/A';
    
    // Use termDetails attendance if available, otherwise fallback to calculated from class count (which is a placeholder)
    const attendanceString = termDetails?.attendance_present !== undefined && termDetails?.attendance_total !== undefined
        ? `${termDetails.attendance_present} / ${termDetails.attendance_total}`
        : `${classStudentsCount-1} / ${classStudentsCount}`; // Fallback logic from previous version

    const InfoField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
        <>
            <div className="font-bold border border-black px-2 py-1 bg-gray-100">{label}</div>
            <div className="border border-black px-2 py-1">{value || 'N/A'}</div>
        </>
    );
    

    return (
        <div className="p-4 font-sans flex flex-col bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-xl md:text-2xl font-bold my-4 text-[#722F37]">Terminal Report</h2>
                
                {/* Student Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-0 mb-4 text-[10px] md:text-xs">
                    <div className="md:col-span-10 grid grid-cols-2 md:grid-cols-6 gap-0">
                        <InfoField label="Full Name" value={student.full_name} />
                        <InfoField label="Student ID" value={student.admission_number} />
                        <InfoField label="Gender" value={student.gender} />
                        <InfoField label="Class" value={student.class?.name} />
                        <InfoField label="Academic Year" value={academicYear} />
                        <InfoField label="Academic Term" value={term} />
                        <InfoField label="Age" value={age} />
                        <InfoField label="Grand Score" value={`${grandTotal.toFixed(0)} / ${maxScore}`} />
                        <InfoField label="Class Position" value={getClassPosition()} />
                        <InfoField label="Attendance" value={attendanceString} />
                        {(vacationDate || reopeningDate) ? (
                           <>
                             <InfoField label="Vacation Date" value={vacationDate} />
                             <InfoField label="Re-Opening Date" value={reopeningDate} />
                           </>
                        ) : (
                           <>
                             <div className="font-bold border border-black px-2 py-1 bg-gray-100 hidden md:block"></div>
                             <div className="border border-black px-2 py-1 hidden md:block"></div>
                             <div className="font-bold border border-black px-2 py-1 bg-gray-100 hidden md:block"></div>
                             <div className="border border-black px-2 py-1 hidden md:block"></div>
                           </>
                        )}
                    </div>
                    <div className="md:col-span-2 flex items-center justify-center border border-black p-2 bg-gray-100">
                        <div className="w-20 h-24 md:w-24 md:h-28 border-2 border-gray-400 flex items-center justify-center text-gray-400 bg-white">
                           {student.image_url ? (
                                <img src={student.image_url} alt={student.full_name} className="w-full h-full object-cover"/>
                           ) : (
                                <span>Photo</span>
                           )}
                        </div>
                    </div>
                </div>

                {/* Scores Table */}
                <div className="overflow-x-auto mb-4">
                    <table className="w-full text-xs border-collapse border border-black min-w-[600px]">
                        <thead>
                            <tr className="font-bold bg-gray-200 text-[#722F37]">
                                <td className="border border-black p-1">Subjects</td>
                                <td className="border border-black p-1 text-center">Class Score /50</td>
                                <td className="border border-black p-1 text-center">Exam Score /50</td>
                                <td className="border border-black p-1 text-center">Total /100</td>
                                <td className="border border-black p-1 text-center">Grade</td>
                                <td className="border border-black p-1 text-center">Point</td>
                                <td className="border border-black p-1 text-center">Remark</td>
                                <td className="border border-black p-1 text-center">Subject Position</td>
                            </tr>
                        </thead>
                        <tbody>
                            {assessments.map(a => {
                                const classScore = a.continuous_assessment_score ? (a.continuous_assessment_score / 60) * 50 : 0;
                                const examScore = a.exam_score ? (a.exam_score / 40) * 50 : 0;
                                const gradeInfo = getGradeInfo(a.total_score);
                                return (
                                    <tr key={a.id}>
                                        <td className="border border-black p-1">{a.subject.name}</td>
                                        <td className="border border-black p-1 text-center">{Math.round(classScore)}/50</td>
                                        <td className="border border-black p-1 text-center">{Math.round(examScore)}/50</td>
                                        <td className="border border-black p-1 text-center font-bold">{a.total_score}</td>
                                        <td className="border border-black p-1 text-center">{gradeInfo.grade}</td>
                                        <td className="border border-black p-1 text-center">{gradeInfo.point}</td>
                                        <td className="border border-black p-1">{gradeInfo.remark}</td>
                                        <td className="border border-black p-1 text-center">{getSubjectPosition(a.subject_id)}</td>
                                    </tr>
                                );
                            })}
                            <tr className="font-bold">
                                    <td colSpan={3} className="border border-black p-1 text-right bg-gray-200">GRAND TOTAL :</td>
                                    <td className="border border-black p-1" colSpan={5}>{grandTotal.toFixed(0)}/{maxScore}, Average : {average.toFixed(2)}%</td>
                            </tr>
                            <tr className="font-bold">
                                    <td colSpan={3} className="border border-black p-1 text-right bg-gray-200">RESULT :</td>
                                    <td className="border border-black p-1" colSpan={5}>{average >= 45 ? 'Pass' : 'Fail'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                {/* Remarks & Grading Scale */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-[10px] md:text-xs">
                    <div className="md:col-span-8 space-y-2">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-black min-w-[400px]">
                            <thead>
                                <tr className="font-bold bg-gray-200 text-[#722F37]">
                                    <td className="border border-black p-1">Attitude</td>
                                    <td className="border border-black p-1">Conduct</td>
                                    <td className="border border-black p-1">Interest</td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 h-12">{termDetails?.attitude || ''}</td>
                                    <td className="border border-black p-1 h-12">{termDetails?.conduct || ''}</td>
                                    <td className="border border-black p-1 h-12">{termDetails?.interest || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-black min-w-[400px]">
                            <thead>
                                <tr className="font-bold bg-gray-200 text-[#722F37]">
                                    <td className="border border-black p-1">Class Teacher's Remarks</td>
                                    <td className="border border-black p-1">Headteacher's Remarks</td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 h-16">{termDetails?.class_teacher_remarks || ''}</td>
                                    <td className="border border-black p-1 h-16">{termDetails?.headteacher_remarks || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <div className="md:col-span-4">
                        <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-black min-w-[200px]">
                                <thead>
                                <tr className="font-bold bg-gray-200 text-[#722F37]">
                                    <td colSpan={3} className="border border-black p-1 text-center">Grading Scale</td>
                                </tr>
                                <tr className="font-bold bg-gray-100">
                                    <td className="border border-black p-1">Grade</td>
                                    <td className="border border-black p-1">Min %</td>
                                    <td className="border border-black p-1">Max %</td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td className="border border-black p-1">A</td><td className="border border-black p-1">80%</td><td className="border border-black p-1">100%</td></tr>
                                <tr><td className="border border-black p-1">B</td><td className="border border-black p-1">70%</td><td className="border border-black p-1">79%</td></tr>
                                <tr><td className="border border-black p-1">C</td><td className="border border-black p-1">65%</td><td className="border border-black p-1">69%</td></tr>
                                <tr><td className="border border-black p-1">D</td><td className="border border-black p-1">55%</td><td className="border border-black p-1">64%</td></tr>
                                <tr><td className="border border-black p-1">E</td><td className="border border-black p-1">45%</td><td className="border border-black p-1">54%</td></tr>
                                <tr><td className="border border-black p-1">F</td><td className="border border-black p-1">0%</td><td className="border border-black p-1">44%</td></tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-sm">
                    <p>Headteacher's Signature: ...................................................</p>
                </div>
            </main>
            <ReportFooter />
        </div>
    );
};
