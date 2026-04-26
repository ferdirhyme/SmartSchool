import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole, ReportType } from '../../types.ts';
import DashboardLayout from '../layout/DashboardLayout.tsx';
import { getNavItemsByRole } from '../../lib/navigation.ts';
import ProfilePage from '../pages/ProfilePage.tsx';
import MessagesPage from '../pages/MessagesPage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import ParentDashboardHome from '../pages/ParentDashboardHome.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import BillingPage from '../pages/BillingPage.tsx';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import FeedbackPage from '../pages/FeedbackPage.tsx';
import PtmPage from '../pages/PtmPage.tsx';

interface DashboardProps {
  session: Session;
  profile: Profile;
}

const ParentDashboard: React.FC<DashboardProps> = ({ session, profile }) => {
  const [activePage, setActivePage] = useState<string | { page: string; conversationId?: string }>('Dashboard');
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const navItems = getNavItemsByRole(UserRole.Parent);
  
  const isViewingReport = !!selectedReport;

  const renderContent = () => {
    if (isViewingReport) {
      return <ReportViewer reportType={selectedReport!} onBack={() => setSelectedReport(null)} session={session} profile={profile} />;
    }
    
    const page = typeof activePage === 'string' ? activePage : activePage.page;

    switch (page) {
      case 'Dashboard':
        return <ParentDashboardHome profile={profile} setActivePage={setActivePage as (page: string) => void} />;
      case 'Messages':
        return <MessagesPage session={session} profile={profile} initialConversationId={typeof activePage === 'object' ? activePage.conversationId : undefined} />;
      case 'Reports':
        return <ReportsPage session={session} profile={profile} onReportSelect={setSelectedReport} />;
      case 'Billing':
        return <BillingPage session={session} />;
      case 'PTM Scheduler':
        return <PtmPage profile={profile} />;
      case 'Profile':
        return <ProfilePage session={session} profile={profile} />;
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

export default ParentDashboard;