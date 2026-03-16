
import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole, ReportType } from '../../types.ts';
import DashboardLayout from '../layout/DashboardLayout.tsx';
import { getNavItemsByRole } from '../../lib/navigation.ts';
import ClassAttendance from '../pages/ClassAttendance.tsx';
import Assessment from '../pages/Assessment.tsx';
import TeacherDashboardHome from '../pages/TeacherDashboardHome.tsx';
import MyAttendance from '../pages/MyAttendance.tsx';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import ProfilePage from '../pages/ProfilePage.tsx';
import MessagesPage from '../pages/MessagesPage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import TermRemarks from '../pages/TermRemarks.tsx';
import BillingPage from '../pages/BillingPage.tsx';

interface DashboardProps {
  session: Session;
  profile: Profile;
}

const TeacherDashboard: React.FC<DashboardProps> = ({ session, profile }) => {
  const [activePage, setActivePage] = useState<string | { page: string; conversationId?: string }>('Dashboard');
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const navItems = getNavItemsByRole(UserRole.Teacher);
  
  const isViewingReport = !!selectedReport;

  const renderContent = () => {
    if (isViewingReport) {
      return <ReportViewer reportType={selectedReport!} onBack={() => setSelectedReport(null)} session={session} profile={profile} />;
    }
    
    const page = typeof activePage === 'string' ? activePage : activePage.page;

    switch (page) {
      case 'Dashboard':
        return <TeacherDashboardHome session={session} profile={profile} setActivePage={setActivePage} />;
      case 'Attendance':
      case 'Class Attendance':
        return <ClassAttendance session={session} profile={profile} />;
      case 'My Attendance':
        return <MyAttendance profile={profile} />;
      case 'Academics':
      case 'Assessment':
        return <Assessment session={session} profile={profile} />;
      case 'Term Remarks':
        return <TermRemarks profile={profile} />;
      case 'Reports':
        return <ReportsPage session={session} profile={profile} onReportSelect={setSelectedReport} />;
      case 'Messages':
        return <MessagesPage session={session} profile={profile} initialConversationId={typeof activePage === 'object' ? activePage.conversationId : undefined} />;
      case 'Billing':
        return <BillingPage session={session} />;
      case 'Profile':
        return <ProfilePage session={session} profile={profile} />;
      case 'Settings':
        return <SettingsPage profile={profile} />;
      default:
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{page}</h1>
            <p className="text-gray-600 dark:text-gray-300">Content for this page is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout 
      profile={profile} 
      navItems={navItems} 
      activePage={activePage} 
      setActivePage={setActivePage}
      hideSidebar={isViewingReport}
    >
      {renderContent()}
    </DashboardLayout>
  );
};

export default TeacherDashboard;