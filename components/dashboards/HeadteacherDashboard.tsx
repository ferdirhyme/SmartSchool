
import React, { useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole, ReportType } from '../../types.ts';
import DashboardLayout from '../layout/DashboardLayout.tsx';
import { getNavItemsByRole } from '../../lib/navigation.ts';
import AddStudent from '../pages/AddStudent.tsx';
import ManageSubjects from '../pages/ManageSubjects.tsx';
import ManageClasses from '../pages/ManageClasses.tsx';
import StudentInfo from '../pages/StudentInfo.tsx';
import AddTeacher from '../pages/AddTeacher.tsx';
import TeacherInfo from '../pages/TeacherInfo.tsx';
import Timetable from '../pages/Timetable.tsx';
import FeesDashboard from '../pages/FeesDashboard.tsx';
import BillingPage from '../pages/BillingPage.tsx';
import ManageAnnouncements from '../pages/ManageAnnouncements.tsx';
import ReportsPage from '../pages/ReportsPage.tsx';
import SettingsPage from '../pages/SettingsPage.tsx';
import MessagesPage from '../pages/MessagesPage.tsx';
import PromotionPage from '../pages/PromotionPage.tsx';
import StaffAuthorizations from '../pages/StaffAuthorizations.tsx';
import TeacherAttendanceView from '../pages/TeacherAttendanceView.tsx';
import HeadteacherDashboardHome from '../pages/HeadteacherDashboardHome.tsx';
import { ReportViewer } from '../reports/ReportViewer.tsx';
import TermRemarks from '../pages/TermRemarks.tsx';

import FeedbackPage from '../pages/FeedbackPage.tsx';
import ProfilePage from '../pages/ProfilePage.tsx';

interface DashboardProps {
  session: Session;
  profile: Profile;
}

const HeadteacherDashboard: React.FC<DashboardProps> = ({ session, profile }) => {
  const [activePage, setActivePage] = useState<string | { page: string; conversationId?: string; teacherProfile?: Profile }>('Dashboard');
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const navItems = getNavItemsByRole(UserRole.Headteacher);
  
  const isViewingReport = !!selectedReport;

  const renderContent = () => {
    if (isViewingReport) {
        return <ReportViewer reportType={selectedReport!} onBack={() => setSelectedReport(null)} session={session} profile={profile} />;
    }
    
    const page = typeof activePage === 'string' ? activePage : activePage.page;

    switch (page) {
      case 'Dashboard':
        return <HeadteacherDashboardHome profile={profile} setActivePage={setActivePage} />;
      case 'Students':
      case 'Student Info':
        return <StudentInfo profile={profile} />;
      case 'Add Students':
        // Pass profile to AddStudent
        return <AddStudent profile={profile} />;
      case 'Academics':
      case 'Manage Classes':
        return <ManageClasses profile={profile} />;
      case 'Manage Subjects':
        return <ManageSubjects profile={profile} />;
      case 'Timetable':
        return <Timetable profile={profile} />;
      case 'Promotion':
        return <PromotionPage profile={profile} />;
      case 'Term Remarks':
        return <TermRemarks profile={profile} />;
      case 'Fees':
        return <FeesDashboard profile={profile} />;
      case 'Billing':
        return <BillingPage session={session} />;
      case 'Teachers':
      case 'Staff List':
        return <TeacherInfo profile={profile} />;
      case 'Add Teacher':
        // Pass profile to AddTeacher and any teacherProfile from redirection
        return <AddTeacher profile={profile} prefillProfile={typeof activePage === 'object' ? activePage.teacherProfile : undefined} />;
      case 'Staff Authorizations':
        return <StaffAuthorizations profile={profile} setActivePage={setActivePage} />;
      case 'Staff Attendance':
        return <TeacherAttendanceView />;
      case 'Manage Announcements':
        return <ManageAnnouncements session={session} profile={profile} />;
      case 'Reports':
        return <ReportsPage session={session} profile={profile} onReportSelect={setSelectedReport} />;
      case 'Messages':
        return <MessagesPage session={session} profile={profile} initialConversationId={typeof activePage === 'object' ? activePage.conversationId : undefined} />;
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

export default HeadteacherDashboard;
