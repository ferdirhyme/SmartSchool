import React, { useState, useMemo } from 'react';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import { ReportType, Profile, UserRole } from '../../types.ts';
import { AcademicsIcon, FeesIcon, ReportsIcon, StudentsIcon, AttendanceIcon, TeachersIcon } from '../icons/NavIcons.tsx';
import { Session } from '@supabase/supabase-js';

const allReportOptions = [
    { type: 'StudentReportCard' as ReportType, title: 'Student Report Card', description: 'Generate an official terminal report for an individual student.', icon: ReportsIcon },
    { type: 'StudentProgressReport' as ReportType, title: 'Student Progress Report', description: "Track a student's academic progress over their entire school history.", icon: ReportsIcon },
    { type: 'StudentAttendanceReport' as ReportType, title: 'Student Attendance Report', description: 'View a detailed attendance log for a single student.', icon: AttendanceIcon },
    { type: 'ClassPerformance' as ReportType, title: 'Class Performance', description: 'Analyze the performance of a class in a specific subject.', icon: AcademicsIcon },
    { type: 'Broadsheet' as ReportType, title: 'Broadsheet', description: 'View a master grid of all student scores for a selected class.', icon: AcademicsIcon },
    { type: 'FeeDefaulters' as ReportType, title: 'Fee Defaulters List', description: 'Identify students with outstanding fee balances.', icon: FeesIcon },
    { type: 'PaymentHistory' as ReportType, title: 'Student Payment History', description: 'View a detailed payment ledger for a specific student.', icon: FeesIcon },
    { type: 'ClassList' as ReportType, title: 'Class List / Roster', description: 'Generate a printable list of all students in a class.', icon: StudentsIcon },
    { type: 'AttendanceReport' as ReportType, title: 'Class Attendance Report', description: 'Generate a student attendance summary for a class over a date range.', icon: AttendanceIcon },
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
            className="w-full text-left p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg hover:border-brand-500 border-2 border-transparent transition-all duration-300 flex items-start space-x-4"
        >
            <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
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
            const teacherReports: ReportType[] = ['StudentReportCard', 'StudentProgressReport', 'ClassPerformance', 'Broadsheet', 'ClassList', 'AttendanceReport', 'StudentAttendanceReport'];
            return allReportOptions.filter(option => teacherReports.includes(option.type));
        }
        if (profile.role === UserRole.Headteacher) {
            // Add "Student Progress Report" for headteachers
            const headteacherReports: ReportType[] = [...allReportOptions.map(r => r.type)];
            if (!headteacherReports.includes('StudentProgressReport')) {
                 headteacherReports.splice(1, 0, 'StudentProgressReport');
            }
             return allReportOptions.filter(option => headteacherReports.includes(option.type));
        }
        return allReportOptions;
    }, [profile.role]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Generate School Reports</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Select a report type to begin. You will be prompted to select the necessary filters before generation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportOptions.map(option => (
                    <ReportCard key={option.type} {...option} onSelect={onReportSelect} />
                ))}
            </div>
        </div>
    );
};

export default ReportsPage;