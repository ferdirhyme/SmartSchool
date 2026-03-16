
import React from 'react';

interface IconProps {
  className?: string;
}

export const HeadteacherIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6L9 9 6 6 3 9l4.5 4.5L12 18l4.5-4.5L21 9l-3-3-3 3-3-3z"/>
    <path d="M3 13.5V21h18v-7.5"/>
    <path d="M12 21v-8.5"/>
  </svg>
);

export const TeacherIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 22v-4a2 2 0 1 0-4 0v4"/>
    <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/>
    <path d="M18 5v17"/>
    <path d="m12 14 6-3"/>
    <path d="M6 5v17"/>
    <path d="m12 14-6-3"/>
  </svg>
);

export const StudentIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    <path d="M12 2v20"/>
    <path d="M12 12h-2"/>
  </svg>
);

export const ParentIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20a6 6 0 0 0-12 0"/>
    <circle cx="12" cy="10" r="4"/>
    <path d="M12 14a6 6 0 0 0-6 6"/>
    <path d="M12 22a6 6 0 0 0 6-6"/>
    <path d="M6 20a6 6 0 0 1-4-4.25"/>
    <path d="M18 20a6 6 0 0 0 4-4.25"/>
  </svg>
);
