import React, { useState, useMemo } from 'react';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import { ReportType, Profile, UserRole } from '../../types.ts';
import { AcademicsIcon, FeesIcon, ReportsIcon, StudentsIcon, AttendanceIcon, TeachersIcon } from '../icons/NavIcons.tsx';
import { Session } from '@supabase/supabase-js';
import { GraduationCap } from 'lucide-react';

const allReportOptions = [
    { type: 'StudentReportCard' as ReportType, title: 'GES-Compliant Terminal Report', description: 'Generate official Ghanaian terminal reports for students with positions and grading.', icon: ReportsIcon },
    { type: 'MockPerformanceAnalytics' as ReportType, title: 'BECE/WASSCE Mock Analytics', description: 'Predictive performance analytics for BECE and WASSCE mock examinations.', icon: GraduationCap },
    { type: 'StudentProgressReport' as ReportType, title: 'Student Progress History', description: "Track a student's academic progress over their entire school history.", icon: ReportsIcon },
    { type: 'StudentAttendanceReport' as ReportType, title: 'Student Attendance Report', description: 'View a detailed attendance log for a single student.', icon: AttendanceIcon },
    { type: 'ClassPerformance' as ReportType, title: 'Class Performance', description: 'Analyze the performance of a class in a specific subject.', icon: AcademicsIcon },
    { type: 'Broadsheet' as ReportType, title: 'Broadsheet (Mark Sheet)', description: 'View a master grid of all student scores for a selected class.', icon: AcademicsIcon },
    { type: 'FeeDefaulters' as ReportType, title: 'Fee Defaulters List', description: 'Identify students with outstanding fee balances.', icon: FeesIcon },
    { type: 'PaymentHistory' as ReportType, title: 'Student Payment History', description: 'View a detailed payment ledger for a specific student.', icon: FeesIcon },
    { type: 'ClassList' as ReportType, title: 'Class List / Roster', description: 'Generate a printable list of all students in a class.', icon: StudentsIcon },
    { type: 'AttendanceReport' as ReportType, title: 'Class Attendance Report', description: 'Generate a student attendance summary for a class over a date range.', icon: AttendanceIcon },
    { type: 'TeacherAttendanceReport' as ReportType, title: 'Teacher Attendance Report', description: 'Generate an attendance summary for teachers over a date range.', icon: TeachersIcon },
    { type: 'PreviousRecords' as ReportType, title: 'Previous Academic Archive', description: 'Access and generate reports for past academic years and terms.', icon: ReportsIcon },
];

interface ReportCardProps {
    type: ReportType;
    title: string;
    description: string;
    icon: React.FC<{className?: string}>;
    onSelect: (type: ReportType) => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ type, title, description, icon: Icon, onSelect }) => {
    return (
        <button
            onClick={() => onSelect(type)}
            className="w-full text-left p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-500 border border-gray-100 dark:border-gray-700 transition-all duration-300 flex items-start space-x-4 group active:scale-[0.98]"
        >
            <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
                    <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 font-medium leading-relaxed">{description}</p>
            </div>
        </button>
    );
}

interface ReportsPageProps {
    session: Session;
    profile: Profile;
    onReportSelect: (type: ReportType) => void;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ session, profile, onReportSelect }) => {
    const reportOptions = useMemo(() => {
        if (profile.role === UserRole.Teacher) {
            const teacherReports: ReportType[] = ['StudentReportCard', 'MockPerformanceAnalytics', 'StudentProgressReport', 'ClassPerformance', 'Broadsheet', 'ClassList', 'AttendanceReport', 'StudentAttendanceReport'];
            return allReportOptions.filter(option => teacherReports.includes(option.type));
        }
        if (profile.role === UserRole.Headteacher || profile.role === UserRole.Admin) {
            // Add "Student Progress Report" for headteachers
            const headteacherReports: ReportType[] = [...allReportOptions.map(r => r.type)];
            if (!headteacherReports.includes('StudentProgressReport')) {
                 headteacherReports.splice(1, 0, 'StudentProgressReport');
            }
             return allReportOptions.filter(option => headteacherReports.includes(option.type));
        }
        // Parents and Students should only see individual targeted reports
        const personalReports: ReportType[] = ['StudentReportCard', 'StudentProgressReport', 'StudentAttendanceReport', 'PaymentHistory', 'PreviousRecords'];
        return allReportOptions.filter(option => personalReports.includes(option.type));
    }, [profile.role]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Generate School Reports</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Select a report type to begin. You will be prompted to select the necessary filters before generation.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportOptions.map((option, idx) => (
                    <div key={option.type} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
                        <ReportCard {...option} onSelect={onReportSelect} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReportsPage;