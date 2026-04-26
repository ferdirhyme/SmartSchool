
import React from 'react';
import {
  DashboardIcon,
  StudentsIcon,
  AcademicsIcon,
  AttendanceIcon,
  FeesIcon,
  TeachersIcon,
  ReportsIcon,
  MessagesIcon,
  AnnouncementIcon,
  PromotionIcon,
  SettingsIcon,
  GradingIcon,
  ProfileIcon,
  BillingIcon
} from '../components/icons/NavIcons.tsx';
import { UserRole } from '../types.ts';
import { MessageSquare, Users, Video } from 'lucide-react';

export interface NavItem {
  label: string;
  icon: React.FC<{ className?: string }>;
  subItems?: Omit<NavItem, 'icon' | 'subItems'>[];
}

const headteacherNavItems: NavItem[] = [
  { label: 'Dashboard', icon: DashboardIcon },
  { 
    label: 'Students', 
    icon: StudentsIcon, 
    subItems: [
      { label: 'Student Info' },
      { label: 'Add Students' },
      { label: 'Promotion' }
    ]
  },
  { 
    label: 'Administration', 
    icon: Users,
    subItems: [
        { label: 'Staff List' },
        { label: 'Staff Authorizations' },
        { label: 'Staff Attendance' },
        { label: 'Guardian Management' }
    ]
  },
  { 
    label: 'Academics', 
    icon: AcademicsIcon,
    subItems: [
        { label: 'Manage Classes' },
        { label: 'Manage Subjects' },
        { label: 'Timetable' },
        { label: 'Lesson Notes' },
        { label: 'Scheme of Learning' },
        { label: 'Term Remarks' }
    ]
  },
  { 
    label: 'Finance', 
    icon: FeesIcon,
    subItems: [
        { label: 'Fees Management' },
        { label: 'Expense Tracker' },
        { label: 'Scholarships' },
        { label: 'Billing' }
    ]
  },
  { 
    label: 'Communication', 
    icon: MessagesIcon,
    subItems: [
        { label: 'Messages' },
        { label: 'PTM Scheduler' },
        { label: 'Manage Announcements' }
    ]
  },
  { label: 'Reports', icon: ReportsIcon },
  { label: 'Profile', icon: ProfileIcon },
  { label: 'Feedback', icon: MessageSquare },
  { label: 'Settings', icon: SettingsIcon },
];

const teacherNavItems: NavItem[] = [
  { label: 'Dashboard', icon: DashboardIcon },
  { 
    label: 'Attendance', 
    icon: AttendanceIcon,
    subItems: [
        { label: 'Class Attendance' },
        { label: 'My Attendance' }
    ]
  },
  { 
    label: 'Academics', 
    icon: AcademicsIcon,
    subItems: [
        { label: 'Assessment' },
        { label: 'Lesson Notes' },
        { label: 'Scheme of Learning' },
        { label: 'Term Remarks' }
    ]
  },
  { label: 'Guardian Management', icon: Users },
  { label: 'PTM Scheduler', icon: Video },
  { label: 'Reports', icon: ReportsIcon },
  { label: 'Messages', icon: MessagesIcon },
  { label: 'Billing', icon: BillingIcon },
  { label: 'Profile', icon: ProfileIcon },
  { label: 'Feedback', icon: MessageSquare },
  { label: 'Settings', icon: SettingsIcon },
];

const studentNavItems: NavItem[] = [
  { label: 'Dashboard', icon: DashboardIcon },
  { label: 'Reports', icon: ReportsIcon },
  { label: 'Messages', icon: MessagesIcon },
  { label: 'Profile', icon: ProfileIcon },
  { label: 'Feedback', icon: MessageSquare },
  { label: 'Settings', icon: SettingsIcon },
];

const parentNavItems: NavItem[] = [
  { label: 'Dashboard', icon: DashboardIcon },
  { label: 'Reports', icon: ReportsIcon },
  { label: 'Messages', icon: MessagesIcon },
  { label: 'Billing', icon: BillingIcon },
  { label: 'PTM Scheduler', icon: Video },
  { label: 'Profile', icon: ProfileIcon },
  { label: 'Feedback', icon: MessageSquare },
  { label: 'Settings', icon: SettingsIcon },
];

export const getNavItemsByRole = (role: UserRole): NavItem[] => {
    switch (role) {
        case UserRole.Headteacher:
            return headteacherNavItems;
        case UserRole.Teacher:
            return teacherNavItems;
        case UserRole.Student:
            return studentNavItems;
        case UserRole.Parent:
            return parentNavItems;
        default:
            return [];
    }
}