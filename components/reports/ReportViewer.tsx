
import React, { useState, useEffect, useMemo } from 'react';
import { ReportType, Class, Subject, Student, FeeType, StudentAssessment, Profile, UserRole, Teacher, StudentTermReport } from '../../types.ts';
import { supabase } from '../../lib/supabase.ts';
import { StudentReportCard } from './StudentReportCard.tsx';
import { ClassPerformanceReport } from './ClassPerformance.tsx';
import { BroadsheetReport } from './Broadsheet.tsx';
import { FeeDefaultersReport } from './FeeDefaulters.tsx';
import { PaymentHistoryReport } from './PaymentHistory.tsx';
import { ClassListReport } from './ClassList.tsx';
import { AttendanceReport } from './AttendanceReport.tsx';
import { StudentAttendanceReport } from './StudentAttendanceReport.tsx';
import { StudentProgressReport } from './StudentProgressReport.tsx';
import { Session } from '@supabase/supabase-js';

interface ReportViewerProps {
    reportType: ReportType;
    onBack: () => void;
    session: Session;
    profile: Profile;
}

const reportTitles: Record<ReportType, string> = {
    StudentReportCard: 'Student Report Card',
    ClassPerformance: 'Class Performance Summary',
    Broadsheet: 'Broadsheet (Mark Sheet)',
    FeeDefaulters: 'Fee Defaulters List',
    PaymentHistory: 'Student Payment History',
    ClassList: 'Class List / Roster',
    AttendanceReport: 'Class Attendance Report',
    StudentAttendanceReport: 'Individual Student Attendance Report',
    StudentProgressReport: 'Student Progress Report',
};

const REPORT_COST = 1.00;

export const ReportViewer: React.FC<ReportViewerProps> = ({ reportType, onBack, session, profile }) => {
    const [filters, setFilters] = useState<any>({
        year: new Date().getFullYear(),
        vacationDate: '',
        reopeningDate: '',
        class_id: '',
        student_id: '',
        subject_id: '',
        teacher_id: '',
        termName: '',
        fee_type_id: '',
        startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    const [generateForAll, setGenerateForAll] = useState(false);
    const [reportData, setReportData] = useState<any | any[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

    // Payment States
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    useEffect(() => {
        setGenerateForAll(false);
    }, [reportType]);

    // --- Fetch filter data ---
    useEffect(() => {
        let mounted = true;
        const fetchFilters = async () => {
            try {
                let classList: Class[] = [];

                if (profile.role === UserRole.Teacher) {
                    const { data: teacherData } = await supabase
                        .from('teachers')
                        .select('teachable_classes:teacher_classes(class:classes(*))')
                        .eq('email', session.user?.email)
                        .single();

                    const classesFromData = ((teacherData?.teachable_classes as any[]) || [])
                        .map(tc => tc.class)
                        .filter((c): c is Class => !!c?.id);

                    const unique = new Map(classesFromData.map(c => [c.id, c]));
                    classList = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    const { data: classData } = await supabase.from('classes').select('*').order('name');
                    classList = classData || [];
                }

                if (!mounted) return;
                setClasses(classList);

                if (['StudentReportCard', 'ClassPerformance', 'Broadsheet'].includes(reportType)) {
                    const { data: subjectData } = await supabase.from('subjects').select('*').order('name');
                    if (mounted) setSubjects(subjectData || []);
                }
                
                if (reportType === 'FeeDefaulters') {
                    const { data: feeTypeData } = await supabase.from('fee_types').select('*').order('name');
                    if (mounted) setFeeTypes(feeTypeData || []);
                }
            } catch (err: any) {
                console.error(err);
                if (mounted) setError(err.message || 'Failed to load filters');
            }
        };

        fetchFilters();
        return () => { mounted = false; };
    }, [reportType, profile.role, session.user?.email]);

    // --- Fetch students when class changes ---
    useEffect(() => {
        let mounted = true;
        const fetchStudents = async () => {
            if (!filters.class_id) {
                if (mounted) setStudents([]);
                return;
            }
            const { data } = await supabase.from('students').select('*').eq('class_id', filters.class_id).order('full_name');
            if (mounted) setStudents(data || []);
        };

        if (['StudentReportCard', 'PaymentHistory', 'StudentAttendanceReport', 'StudentProgressReport'].includes(reportType)) fetchStudents();
        else setStudents([]);

        return () => { mounted = false; };
    }, [filters.class_id, reportType]);

    // --- Disable Generate button logic ---
    const missingFilters = useMemo(() => {
        const missing: string[] = [];
        switch (reportType) {
            case 'StudentReportCard':
                if (!filters.termName) missing.push('Term');
                if (!filters.year) missing.push('Year');
                if (!filters.class_id) missing.push('Class');
                if (!generateForAll && !filters.student_id) missing.push('Student');
                break;
            case 'StudentProgressReport':
                if (!filters.class_id) missing.push('Class');
                if (!filters.student_id) missing.push('Student');
                break;
            case 'ClassPerformance':
                if (!filters.termName) missing.push('Term');
                if (!filters.year) missing.push('Year');
                if (!filters.class_id) missing.push('Class');
                if (!filters.subject_id) missing.push('Subject');
                break;
            case 'Broadsheet':
                if (!filters.termName) missing.push('Term');
                if (!filters.year) missing.push('Year');
                if (!filters.class_id) missing.push('Class');
                break;
            case 'PaymentHistory':
                if (!filters.class_id) missing.push('Class');
                if (!filters.student_id) missing.push('Student');
                break;
            case 'ClassList':
                if (!filters.class_id) missing.push('Class');
                break;
            case 'FeeDefaulters':
                if (!filters.fee_type_id) missing.push('Fee Type');
                break;
            case 'AttendanceReport':
                if (!filters.class_id) missing.push('Class');
                if (!filters.startDate) missing.push('Start Date');
                if (!filters.endDate) missing.push('End Date');
                break;
            case 'StudentAttendanceReport':
                if (!filters.class_id) missing.push('Class');
                if (!filters.student_id) missing.push('Student');
                if (!filters.startDate) missing.push('Start Date');
                if (!filters.endDate) missing.push('End Date');
                break;
        }
        return missing;
    }, [filters, reportType, generateForAll]);

    const isGenerateDisabled = isLoading || missingFilters.length > 0;

    // --- Main Report Generation Logic ---
    const executeReportGeneration = async () => {
        setIsLoading(true);
        setError(null);
        setReportData(null);

        try {
            let data: any = null;

            switch (reportType) {
                case 'StudentReportCard': {
                    if (generateForAll) {
                        const { data: students, error: studentsError } = await supabase.from('students').select('*, class:classes(id,name)').eq('class_id', filters.class_id).order('full_name');
                        if (studentsError) throw studentsError;
                        if (!students || students.length === 0) throw new Error("No students found in this class.");
                        
                        const { data: allClassAssessments, error: assessmentsError } = await supabase.from('student_assessments').select('*, subject:subjects(name)').eq('class_id', filters.class_id).eq('term', filters.termName).eq('year', filters.year);
                        if(assessmentsError) throw assessmentsError;

                        // Fetch Term Details (Conduct, Remarks, etc.)
                        const { data: termReports, error: termError } = await supabase.from('student_term_reports').select('*').eq('class_id', filters.class_id).eq('term', filters.termName).eq('year', filters.year);
                        if (termError && termError.code !== '42P01') { // Ignore table not found if script hasn't run
                           console.error("Error fetching term reports:", termError);
                        }

                        const { count, error: countError } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', filters.class_id);
                        if (countError) throw countError;

                        data = students.map(student => {
                            const assessments = (allClassAssessments || []).filter(a => a.student_id === student.id);
                            const termDetails = (termReports || []).find((r: StudentTermReport) => r.student_id === student.id);
                            return {
                                student,
                                assessments,
                                allClassAssessments,
                                term: filters.termName,
                                year: filters.year,
                                classStudentsCount: count ?? 0,
                                vacationDate: filters.vacationDate,
                                reopeningDate: filters.reopeningDate,
                                termDetails
                            };
                        });
                    } else {
                        const { data: student, error: studentError } = await supabase.from('students').select('*, class:classes(id,name)').eq('id', filters.student_id).single();
                        if (studentError) throw studentError;

                        const { data: assessments, error: assessmentsError } = await supabase
                            .from('student_assessments')
                            .select('*, subject:subjects(name)')
                            .eq('student_id', filters.student_id)
                            .eq('class_id', filters.class_id)
                            .eq('term', filters.termName)
                            .eq('year', filters.year);
                        if (assessmentsError) throw assessmentsError;

                        const { data: allClassAssessments, error: allAssessmentsError } = await supabase.from('student_assessments').select('student_id, subject_id, total_score').eq('class_id', filters.class_id).eq('term', filters.termName).eq('year', filters.year);
                        if (allAssessmentsError) throw allAssessmentsError;
                        
                        const { data: termReports, error: termError } = await supabase.from('student_term_reports').select('*').eq('student_id', filters.student_id).eq('term', filters.termName).eq('year', filters.year).maybeSingle();
                        if (termError && termError.code !== '42P01') throw termError;

                        const { count, error: countError } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', filters.class_id);
                        if (countError) throw countError;
                        
                        data = { 
                            student, 
                            assessments, 
                            allClassAssessments, 
                            term: filters.termName, 
                            year: filters.year, 
                            classStudentsCount: count ?? 0, 
                            vacationDate: filters.vacationDate, 
                            reopeningDate: filters.reopeningDate,
                            termDetails: termReports
                        };
                    }
                    break;
                }
                case 'StudentProgressReport': {
                    const { data: student, error: studentError } = await supabase.from('students').select('*, class:classes(id,name)').eq('id', filters.student_id).single();
                    if (studentError) throw studentError;
                    if (!student) throw new Error("Student not found.");
                    const { data: assessments, error: assessmentsError } = await supabase
                        .from('student_assessments')
                        .select('*, subject:subjects(name), class:classes(id, name)')
                        .eq('student_id', filters.student_id)
                        .order('year', { ascending: true })
                        .order('term', { ascending: true });
                    if (assessmentsError) throw assessmentsError;
                    data = { student, assessments };
                    break;
                }
                case 'ClassPerformance': {
                    const { data: scores, error: scoresError } = await supabase.from('student_assessments').select('*, student:students(full_name)').eq('class_id', filters.class_id).eq('subject_id', filters.subject_id).eq('term', filters.termName).eq('year', filters.year);
                    if (scoresError) throw scoresError;
                    data = { scores };
                    break;
                }
                case 'Broadsheet': {
                    const { data: students, error: studentsError } = await supabase.from('students').select('*').eq('class_id', filters.class_id).order('full_name');
                    if (studentsError) throw studentsError;
                    const { data: assessments, error: assessmentsError } = await supabase
                        .from('student_assessments')
                        .select('*')
                        .eq('class_id', filters.class_id)
                        .eq('term', filters.termName)
                        .eq('year', filters.year);
                    if (assessmentsError) throw assessmentsError;
                    data = { students, assessments, subjects };
                    break;
                }
                case 'FeeDefaulters': {
                    const { data: feeType, error: feeTypeError } = await supabase.from('fee_types').select('*').eq('id', filters.fee_type_id).single();
                    if (feeTypeError) throw feeTypeError;
                    const { data: payments, error: paymentsError } = await supabase.from('fee_payments').select('student_id, amount_paid').eq('fee_type_id', filters.fee_type_id);
                    if (paymentsError) throw paymentsError;
                    const { data: allStudents, error: allStudentsError } = await supabase.from('students').select('id, full_name, admission_number, class:classes(name)');
                    if (allStudentsError) throw allStudentsError;
                    const paymentsByStudent: Record<string, number> = {};
                    (payments || []).forEach(p => { paymentsByStudent[p.student_id] = (paymentsByStudent[p.student_id] || 0) + (p.amount_paid || 0); });
                    const defaulters = (allStudents || []).filter(s => (paymentsByStudent[s.id!] || 0) < feeType?.default_amount!).map(s => ({ ...s, amount_paid: paymentsByStudent[s.id!] || 0, amount_due: (feeType?.default_amount || 0) - (paymentsByStudent[s.id!] || 0) }));
                    data = { defaulters, feeType };
                    break;
                }
                case 'PaymentHistory': {
                    const { data: student, error: studentError } = await supabase.from('students').select('*, class:classes(name)').eq('id', filters.student_id).single();
                    if (studentError) throw studentError;
                    const { data: payments, error: paymentsError } = await supabase.from('fee_payments').select('*, fee_type:fee_types(name)').eq('student_id', filters.student_id).order('payment_date', { ascending: false });
                    if (paymentsError) throw paymentsError;
                    data = { student, payments };
                    break;
                }
                case 'ClassList': {
                    const { data: students, error: studentsError } = await supabase.from('students').select('*, class:classes(name)').eq('class_id', filters.class_id).order('full_name');
                    if (studentsError) throw studentsError;
                    data = { students };
                    break;
                }
                case 'AttendanceReport': {
                    const { data: students, error: studentsError } = await supabase.from('students').select('*').eq('class_id', filters.class_id).order('full_name');
                    if (studentsError) throw studentsError;
                    const { data: attendanceRecords, error: attendanceError } = await supabase.from('student_attendance')
                        .select('*')
                        .eq('class_id', filters.class_id)
                        .gte('attendance_date', filters.startDate)
                        .lte('attendance_date', filters.endDate);
                    if (attendanceError) throw attendanceError;
                    data = { students, attendanceRecords };
                    break;
                }
                case 'StudentAttendanceReport': {
                    const { data: student, error: studentError } = await supabase.from('students').select('*, class:classes(id,name)').eq('id', filters.student_id).single();
                    if (studentError) throw studentError;
                    const { data: records, error: recordsError } = await supabase.from('student_attendance')
                        .select('*')
                        .eq('student_id', filters.student_id)
                        .gte('attendance_date', filters.startDate)
                        .lte('attendance_date', filters.endDate)
                        .order('attendance_date');
                    if (recordsError) throw recordsError;
                    data = { student, records, startDate: filters.startDate, endDate: filters.endDate };
                    break;
                }
            }

            setReportData(data);
        } catch (err: any) {
            console.error(err);
            let msg = err?.message || 'Failed to generate report';
            if (msg.includes('relation "public.student_assessments" does not exist') || 
                msg.includes('relation "public.student_term_reports" does not exist') ||
                msg.includes('relation "public.student_attendance" does not exist')) {
                msg = 'Reports Setup Missing: Please go to Settings > Advanced and run the "4. Reports & Attendance Setup" script.';
            }
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const [totalCost, setTotalCost] = useState(REPORT_COST);

    // --- Payment Handling ---
    const handleGenerateClick = async () => {
        setError(null);
        try {
            let cost = REPORT_COST;
            if (reportType === 'StudentReportCard' && generateForAll && filters.class_id) {
                const { count, error: countError } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_id', filters.class_id);
                
                if (countError) throw countError;
                cost = (count || 0) * REPORT_COST;
            }
            setTotalCost(cost);

            const currentBalance = Number(profile.credit_balance || 0);
            if (currentBalance < cost) {
                setError(`Insufficient funds. This action costs GHS ${cost.toFixed(2)}, but your balance is GHS ${currentBalance.toFixed(2)}. Please top up your account.`);
                return;
            }
            setIsConfirmModalOpen(true);
        } catch (err: any) {
            console.error("Error preparing report generation:", err);
            setError(err.message || "Failed to prepare report generation.");
        }
    };

    const confirmAndPay = async () => {
        setIsProcessingPayment(true);
        setError(null);
        try {
            // 1. Re-fetch profile to ensure accurate balance before deduction
            const { data: freshProfile, error: profileError } = await supabase
                .from('profiles')
                .select('credit_balance')
                .eq('id', profile.id)
                .single();

            if (profileError || !freshProfile) {
                throw new Error("Failed to verify wallet balance. Please try again.");
            }

            const freshBalance = Number(freshProfile.credit_balance || 0);
            if (freshBalance < totalCost) {
                setIsConfirmModalOpen(false);
                setIsProcessingPayment(false);
                setError(`Insufficient funds. This action requires GHS ${totalCost.toFixed(2)}, but your current balance is GHS ${freshBalance.toFixed(2)}.`);
                return;
            }

            // 2. Deduct Balance
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ credit_balance: freshBalance - totalCost })
                .eq('id', profile.id);

            if (updateError) {
                throw new Error("Failed to process payment. Please try again.");
            }

            // 3. If successful, proceed to generation
            setIsConfirmModalOpen(false);
            setIsProcessingPayment(false);
            
            await executeReportGeneration();

        } catch (err: any) {
            setIsProcessingPayment(false);
            setError(err.message || "Payment failed.");
        }
    };

    const handlePrint = () => {
        const printArea = document.getElementById('report-content');
        if (printArea) {
            const printWindow = window.open('', '_blank', 'width=1200,height=800');
            if (!printWindow) {
                alert('Please allow pop-ups to print the report.');
                return;
            }

            // Determine orientation
            const landscapeReports: ReportType[] = ['Broadsheet', 'ClassPerformance', 'AttendanceReport'];
            const isLandscape = landscapeReports.includes(reportType);

            // Gather styles
            const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(el => el.outerHTML)
                .join('');
            
            // Tailwind config script if present
            const scripts = Array.from(document.querySelectorAll('script'))
                .filter(s => s.src.includes('tailwindcss') || s.innerHTML.includes('tailwind.config'))
                .map(s => s.outerHTML)
                .join('');

            const content = printArea.innerHTML;

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${reportTitles[reportType]}</title>
                    ${styles}
                    ${scripts}
                    <style>
                        @media print {
                            @page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: 0.5cm; }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
                        }
                        body { background-color: white !important; padding: 20px; font-family: sans-serif; }
                        /* Ensure text colors are dark enough for print if theme was dark */
                        .text-gray-100, .dark\\:text-gray-100, .text-white, .dark\\:text-white { color: #111827 !important; }
                        .bg-gray-800, .dark\\:bg-gray-800 { background-color: white !important; }
                        .border-gray-700, .dark\\:border-gray-700 { border-color: #e5e7eb !important; }
                    </style>
                </head>
                <body>
                    ${content}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const renderFilters = () => {
        const isAcademic = ['StudentReportCard', 'ClassPerformance', 'Broadsheet'].includes(reportType);
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                {isAcademic || ['ClassList', 'PaymentHistory', 'AttendanceReport', 'StudentAttendanceReport', 'StudentProgressReport'].includes(reportType) ? (
                    <div>
                        <label className="block text-sm">Class</label>
                        <select value={filters.class_id || ''} onChange={e => setFilters({ ...filters, class_id: e.target.value, student_id: '' })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select Class</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                ) : null}

                {(reportType === 'StudentReportCard' && !generateForAll) || reportType === 'PaymentHistory' || reportType === 'StudentAttendanceReport' || reportType === 'StudentProgressReport' ? (
                    <div>
                        <label className="block text-sm">Student</label>
                        <select value={filters.student_id || ''} onChange={e => setFilters({ ...filters, student_id: e.target.value })} disabled={!filters.class_id} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select Student</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                        </select>
                    </div>
                ) : null}

                 {(reportType === 'AttendanceReport' || reportType === 'StudentAttendanceReport') && (
                    <>
                        <div>
                            <label className="block text-sm">Start Date</label>
                            <input type="date" value={filters.startDate || ''} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm">End Date</label>
                            <input type="date" value={filters.endDate || ''} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>
                    </>
                )}
                {reportType === 'ClassPerformance' && (
                    <div>
                        <label className="block text-sm">Subject</label>
                        <select value={filters.subject_id || ''} onChange={e => setFilters({ ...filters, subject_id: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select Subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}

                {isAcademic && (
                    <>
                        <div>
                            <label className="block text-sm">Term</label>
                            <select value={filters.termName || ''} onChange={e => setFilters({ ...filters, termName: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <option value="">Select Term</option>
                                <option value="Term 1">Term 1</option>
                                <option value="Term 2">Term 2</option>
                                <option value="Term 3">Term 3</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm">Academic Year</label>
                            <input type="number" placeholder={`e.g. ${new Date().getFullYear()}`} value={filters.year || ''} onChange={e => setFilters({ ...filters, year: e.target.value ? parseInt(e.target.value, 10) : '' })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                        </div>

                        {reportType === 'StudentReportCard' && (
                          <>
                            <div>
                                <label className="block text-sm">Vacation Date</label>
                                <input type="date" value={filters.vacationDate || ''} onChange={e => setFilters({ ...filters, vacationDate: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>

                            <div>
                                <label className="block text-sm">Reopening Date</label>
                                <input type="date" value={filters.reopeningDate || ''} onChange={e => setFilters({ ...filters, reopeningDate: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                            </div>
                            <div className="flex items-center col-span-full pt-2">
                                <input id="gen-all" type="checkbox" checked={generateForAll} onChange={(e) => setGenerateForAll(e.target.checked)} className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"/>
                                <label htmlFor="gen-all" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Generate for all students in class
                                </label>
                            </div>
                          </>
                        )}
                    </>
                )}

                {reportType === 'FeeDefaulters' && (
                    <div>
                        <label className="block text-sm">Fee Type</label>
                        <select value={filters.fee_type_id || ''} onChange={e => setFilters({ ...filters, fee_type_id: e.target.value })} className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select Fee Type</option>
                            {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                        </select>
                    </div>
                )}
            </div>
        );
    };

    const renderReport = () => {
        if (!reportData) return null;

        if (reportType === 'StudentReportCard' && Array.isArray(reportData)) {
            return (
                <div className="reports-container space-y-8">
                    {reportData.map((data, index) => (
                        <div key={data.student.id} className={index < reportData.length -1 ? "page-break" : ""}>
                            <StudentReportCard data={data} />
                        </div>
                    ))}
                </div>
            )
        }

        return (
            <>
                {reportType === 'StudentReportCard' && <StudentReportCard data={reportData} />}
                {reportType === 'StudentProgressReport' && <StudentProgressReport data={reportData} />}
                {reportType === 'ClassPerformance' && <ClassPerformanceReport data={reportData} filters={{ class: classes.find(c => c.id === filters.class_id), subject: subjects.find(s => s.id === filters.subject_id), term: filters.termName, year: filters.year }} />}
                {reportType === 'Broadsheet' && <BroadsheetReport data={reportData} filters={{ class: classes.find(c => c.id === filters.class_id), term: filters.termName, year: filters.year }} />}
                {reportType === 'FeeDefaulters' && <FeeDefaultersReport data={reportData} />}
                {reportType === 'PaymentHistory' && <PaymentHistoryReport data={reportData} />}
                {reportType === 'ClassList' && <ClassListReport data={reportData} />}
                {reportType === 'AttendanceReport' && <AttendanceReport data={reportData} filters={filters} />}
                {reportType === 'StudentAttendanceReport' && <StudentAttendanceReport data={reportData} />}
            </>
        );
    };

    return (
        <div>
            <button onClick={onBack} className="mb-4 no-print inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Back to Report List
            </button>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{reportTitles[reportType]}</h1>
                <div className="flex flex-wrap gap-2">
                    {reportData && (
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 no-print flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print Report
                        </button>
                    )}
                    <div className="flex flex-col items-end">
                        <button
                            onClick={handleGenerateClick}
                            disabled={isGenerateDisabled}
                            className="px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed no-print"
                        >
                            {isLoading ? 'Generating...' : 'Generate Report'}
                        </button>
                        {missingFilters.length > 0 && !isLoading && (
                            <p className="text-[10px] text-amber-600 mt-1 no-print">
                                Missing: {missingFilters.join(', ')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="no-print">{renderFilters()}</div>

            {error && <div className="mt-6 p-4 bg-red-100 text-red-800 rounded-md no-print">{error}</div>}

            <div id="report-content" className="mt-8 p-4 md:p-6 rounded-lg shadow-lg text-gray-900 print-area bg-gray-50 dark:bg-gray-800 dark:text-gray-100 overflow-x-auto">
                {isLoading ? <p>Loading data...</p> : reportData ? renderReport() : <p className="no-print">Select your filters and click "Generate Report" to see the results.</p>}
            </div>

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 no-print" onClick={() => setIsConfirmModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="mb-4 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Confirm Report Generation</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    Generating this report costs <strong>GHS {totalCost.toFixed(2)}</strong>.
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                                    Your estimated balance after this transaction will be GHS {(Math.max(0, (profile.credit_balance || 0) - totalCost)).toFixed(2)}.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmAndPay}
                                disabled={isProcessingPayment}
                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-brand-600 border border-transparent rounded-md hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 disabled:opacity-70"
                            >
                                {isProcessingPayment ? 'Processing...' : 'Confirm & Pay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
