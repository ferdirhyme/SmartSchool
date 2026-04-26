
export enum UserRole {
  Admin = "Admin", // Platform Admin
  Headteacher = "Headteacher", // School Admin
  Teacher = "Teacher",
  Student = "Student",
  Parent = "Parent",
}

export enum SubscriptionStatus {
  Trial = "trial",
  Active = "active",
  PastDue = "past_due",
  Suspended = "suspended",
  Canceled = "canceled"
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  max_students: number;
  features: string[];
  price: number;
}

export interface School {
  id: string;
  created_at: string;
  name: string;
  subdomain?: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string;
  logo_url?: string;
  currency: string;
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
  email?: string;
  role: UserRole;
  admission_numbers?: string[];
  credit_balance: number;
  is_onboarded: boolean;
  is_suspended: boolean;
  avatar_url?: string;
}

// Module-based types
export interface Student {
  id: string;
  school_id: string;
  full_name: string;
  admission_number: string;
  class_id?: string | null;
  // Added missing fields used in components
  date_of_birth: string;
  image_url?: string;
  gender: 'Male' | 'Female';
  nhis_number?: string;
  guardian_name: string;
  guardian_contact: string;
  gps_address?: string;
}

export interface StudentProfile extends Student {
  class: { id: string; name: string } | null;
}

export interface Teacher {
  id: string;
  school_id: string;
  staff_id: string;
  full_name: string;
  email: string;
  // Added missing fields used in components
  date_of_birth: string;
  rank: string;
  phone_number: string;
  image_url?: string;
}

export interface TeachableClassLink {
    class: Class;
    is_homeroom: boolean;
}

export interface TeacherProfile extends Teacher {
    subjects: Subject[];
    teachable_classes: TeachableClassLink[];
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  form_teacher_id?: string | null;
  form_teacher?: { id: string; full_name: string } | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
}

export interface FeeType {
    id: string;
    name: string;
    description?: string;
    default_amount?: number;
}

export interface FeePayment {
  id: string;
  school_id: string;
  student_id: string;
  amount_paid: number;
  receipt_number: string;
  // Added missing fields used in components
  payment_method: 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Other';
  created_at: string;
  payment_date: string;
  notes?: string;
  fee_type_id: string;
  fee_type?: { name: string };
}

export interface AuditLog {
  id: string;
  created_at: string;
  school_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: any;
  new_data?: any;
}

export type ReportType = 
  | 'StudentReportCard'
  | 'StudentProgressReport'
  | 'StudentAttendanceReport'
  | 'ClassPerformance'
  | 'Broadsheet'
  | 'FeeDefaulters'
  | 'PaymentHistory'
  | 'ClassList'
  | 'AttendanceReport'
  | 'TeacherAttendanceReport'
  | 'PreviousRecords'
  | 'MockPerformanceAnalytics';

export interface TimeSlot {
    id: string;
    school_id: string;
    start_time: string;
    end_time: string;
    is_break: boolean;
}

export interface TimetableEntry {
    id: string;
    school_id: string;
    class_id: string;
    day_of_week: number;
    time_slot_id: string;
    subject_id?: string;
    teacher_id?: string;
    subject?: { id: string; name: string };
    teacher?: { id: string; full_name: string };
    time_slot?: TimeSlot;
}

export interface TeacherAttendance {
    id: string;
    school_id: string;
    created_at: string;
    attendance_date: string;
    check_in_time: string;
    check_out_time?: string | null;
    status: 'Present' | 'Late' | 'Absent' | 'Half Day';
    teacher_id: string;
    teacher?: { full_name: string; staff_id: string };
}

export interface Transaction {
    id: string;
    created_at: string;
    user_id: string;
    amount: number;
    reference: string;
    status: 'pending' | 'success' | 'failed';
    gateway: string;
}

export interface Announcement {
    id: string;
    school_id: string;
    created_at: string;
    message: string;
    expiry_date: string;
    created_by: string;
}

export interface StudentAttendance {
    id: string;
    school_id: string;
    student_id: string;
    class_id: string;
    attendance_date: string;
    status: 'Present' | 'Absent' | 'Late';
    marked_by: string;
}

export interface StudentAssessment {
    id: string;
    school_id: string;
    student_id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
    term: string;
    year: number;
    class_exercises?: number | null;
    class_tests?: number | null;
    project_work?: number | null;
    observation_attitude?: number | null;
    continuous_assessment_score?: number | null;
    exam_score?: number | null;
    total_score?: number | null;
    remarks?: string | null;
    assessment_type?: 'Regular' | 'Mock';
    mock_tag?: string | null;
}

export interface StudentTermReport {
    id: string;
    school_id: string;
    student_id: string;
    class_id: string;
    term: string;
    year: number;
    attitude?: string;
    conduct?: string;
    interest?: string;
    class_teacher_remarks?: string;
    headteacher_remarks?: string;
    attendance_present?: number;
    attendance_total?: number;
    promoted_to?: string;
}

export interface SchoolSettings {
    id: string;
    school_name: string;
    logo_url: string | null;
    theme: 'light' | 'dark';
    motto: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    school_latitude: number | null;
    school_longitude: number | null;
    paystack_public_key: string | null;
    paystack_secret_key: string | null;
    currency: string;
    current_term?: string | null;
    current_year?: number | null;
    term_start_date?: string | null;
    term_end_date?: string | null;
}

export interface Message {
    id: string;
    created_at: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    sender?: { full_name: string; role: UserRole };
}

export interface Conversation {
    id: string;
    created_at: string;
    participant_ids: string[];
    other_participant: Profile; // Kept for backwards compatibility with 1-on-1 chats
    participants?: Profile[]; // For group chats
    is_group?: boolean;
    group_name?: string;
    last_message?: Message | null;
    unread_count: number;
    messages: Message[];
}

export interface AppNotification {
    id: string;
    created_at: string;
    user_id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'message';
    is_read: boolean;
    link?: string;
}

export interface ReportDetails {
  attitude?: string | null;
  conduct?: string | null;
  interest?: string | null;
  class_teacher_remarks?: string | null;
  headteacher_remarks?: string | null;
  attendance_present?: number | null;
  attendance_total?: number | null;
}

export interface Feedback {
  id: string;
  user_id: string;
  school_id: string | null;
  subject: string;
  message: string;
  status: 'pending' | 'reviewed' | 'resolved';
  response: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    role: string;
  };
}

// --- Next-Gen Features Types ---

// 1. Library Management
export interface Book {
    id: string;
    school_id: string;
    title: string;
    author: string;
    isbn?: string;
    category?: string;
    total_copies: number;
    available_copies: number;
    created_at: string;
}

export interface LibraryBorrow {
    id: string;
    school_id: string;
    book_id: string;
    student_id: string;
    borrowed_at: string;
    due_date: string;
    returned_at?: string;
    status: 'borrowed' | 'returned' | 'overdue';
    book?: Book;
    student?: Student;
}

// 2. Inventory & Asset Tracking
export interface Asset {
    id: string;
    school_id: string;
    name: string;
    category?: string;
    description?: string;
    purchase_date?: string;
    cost?: number;
    assigned_to_id?: string;
    status: 'available' | 'in_use' | 'repair' | 'disposed';
    created_at: string;
    assigned_to?: Profile;
}

// 3. HR & Payroll
export interface SalaryStructure {
    id: string;
    school_id: string;
    rank: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    tax_percentage: number;
    created_at: string;
}

export interface PayrollRun {
    id: string;
    school_id: string;
    month: number;
    year: number;
    status: 'draft' | 'paid';
    created_at: string;
}

export interface Payslip {
    id: string;
    payroll_run_id: string;
    teacher_id: string;
    gross_total: number;
    deductions: number;
    net_total: number;
    created_at: string;
    teacher?: Teacher;
}

// 4. Communication & Safety
export interface PtmMeeting {
    id: string;
    school_id: string;
    teacher_id: string;
    student_id: string;
    parent_id?: string;
    scheduled_at: string;
    duration: number;
    status: 'scheduled' | 'completed' | 'canceled';
    notes?: string;
    created_at: string;
    teacher?: Teacher;
    parent?: Profile;
    student?: Student;
}

export interface VisitorLog {
    id: string;
    school_id: string;
    name: string;
    purpose: string;
    phone?: string;
    check_in: string;
    check_out?: string;
    student_id_linked?: string;
    created_at: string;
    student?: Student;
}

// 5. Financial Growth
export interface Expense {
    id: string;
    school_id: string;
    category: string;
    amount: number;
    description: string;
    expense_date: string;
    recorded_by?: string;
    created_at: string;
}

export interface Scholarship {
    id: string;
    school_id: string;
    student_id: string;
    name: string;
    description?: string;
    amount: number;
    awarded_date: string;
    status: 'active' | 'expired' | 'cancelled';
    created_at: string;
    student?: Student;
}

// 6. CBT (Computer-Based Testing)
export interface Quiz {
    id: string;
    school_id: string;
    subject_id: string;
    class_id: string;
    teacher_id: string;
    title: string;
    description?: string;
    time_limit: number;
    is_active: boolean;
    created_at: string;
    subject?: Subject;
    class?: Class;
    teacher?: Teacher;
}

export interface QuizQuestion {
    id: string;
    quiz_id: string;
    question_text: string;
    question_type: 'mcq' | 'true_false';
    points: number;
    question_order: number;
    created_at: string;
    options?: QuizOption[];
}

export interface QuizOption {
    id: string;
    question_id: string;
    option_text: string;
    is_correct: boolean;
}

export interface QuizAttempt {
    id: string;
    quiz_id: string;
    student_id: string;
    started_at: string;
    completed_at?: string;
    score: number;
    status: 'ongoing' | 'completed';
    created_at: string;
    quiz?: Quiz;
    student?: Student;
}

// 7. Transport Management
export interface BusRoute {
    id: string;
    school_id: string;
    name: string;
    driver_name: string;
    vehicle_number: string;
    created_at: string;
}

export interface BusStop {
    id: string;
    route_id: string;
    name: string;
    arrival_time: string;
}

export interface BusLog {
    id: string;
    school_id: string;
    route_id: string;
    trip_type: 'morning' | 'afternoon';
    logged_at: string;
    route?: BusRoute;
}
