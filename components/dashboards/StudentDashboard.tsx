import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole, ReportType } from '../../types.ts';
import DashboardLayout from '../layout/DashboardLayout.tsx';
import { getNavItemsByRole } from '../../lib/navigation.ts';
import ProfilePage from '../pages/ProfilePage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
// FIX: The StudentDashboardHome file was truncated and missing its export. After fixing the file, this default import will work correctly.
import StudentDashboardHome from '../pages/StudentDashboardHome.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import MessagesPage from '../pages/MessagesPage.tsx';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import FeedbackPage from '../pages/FeedbackPage.tsx';

interface DashboardProps {
  session: Session;
  profile: Profile;
}

const StudentDashboard: React.FC<DashboardProps> = ({ session, profile }) => {
  const [activePage, setActivePage] = useState<string | { page: string; conversationId?: string }>('Dashboard');
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const navItems = getNavItemsByRole(UserRole.Student);
  
  const isViewingReport = !!selectedReport;

  const renderContent = () => {
    if (isViewingReport) {
      return <ReportViewer reportType={selectedReport!} onBack={() => setSelectedReport(null)} session={session} profile={profile} />;
    }
    
    const page = typeof activePage === 'string' ? activePage : activePage.page;
    switch (page) {
      case 'Dashboard':
        return <StudentDashboardHome session={session} profile={profile} setActivePage={setActivePage as (page: string) => void} />;
      case 'Profile':
        return <ProfilePage session={session} profile={profile} />;
      case 'Reports':
        return <ReportsPage session={session} profile={profile} onReportSelect={setSelectedReport} />;
      case 'Messages':
        return <MessagesPage session={session} profile={profile} initialConversationId={typeof activePage === 'object' ? activePage.conversationId : undefined} />;
      case 'Feedback':
        return <FeedbackPage session={session} profile={profile} />;
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

export default StudentDashboard;