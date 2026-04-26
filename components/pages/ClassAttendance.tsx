import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { TeacherProfile, Student, Class, StudentAttendance, Profile } from '../../types.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';

type AttendanceStatus = StudentAttendance['status'];
type AttendanceMap = Record<string, AttendanceStatus>;

interface ClassAttendanceProps {
  session: Session;
  profile: Profile;
}

const statusConfig: Record<AttendanceStatus, { button: string; dot: string; text: string }> = {
  Present: { button: 'bg-green-100 text-green-800 ring-green-500/50 dark:bg-green-900/50 dark:text-green-300', dot: 'bg-green-500', text: 'Present' },
  Absent: { button: 'bg-red-100 text-red-800 ring-red-500/50 dark:bg-red-900/50 dark:text-red-300', dot: 'bg-red-500', text: 'Absent' },
  Late: { button: 'bg-yellow-100 text-yellow-800 ring-yellow-500/50 dark:bg-yellow-900/50 dark:text-yellow-300', dot: 'bg-yellow-500', text: 'Late' },
};

const ClassAttendance: React.FC<ClassAttendanceProps> = ({ session, profile: userProfile }) => {
  const { settings } = useSettings();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [homeroomClass, setHomeroomClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceMap>({});
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      // 1. Fetch teacher profile with teachable classes info
      const { data: teacherId, error: rpcError } = await supabase
        .rpc('get_teacher_id_by_auth_email');

      if (rpcError || !teacherId) {
          throw new Error("Could not find your teacher profile. This is likely a database permission issue. Please contact your administrator and ask them to run the required setup script from the Settings > Advanced page.");
      }
      
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select(`
            *,
            teachable_classes:teacher_classes(
                is_homeroom,
                class:classes(*)
            )
        `)
        .eq('id', teacherId)
        .eq('school_id', userProfile.school_id)
        .single();
      
      if (teacherError || !teacherData) throw new Error("Could not find your teacher profile.");
      
      const profile = {
          ...teacherData,
          teachable_classes: (teacherData.teachable_classes || []).map((tc: any) => ({ class: tc.class, is_homeroom: tc.is_homeroom })).filter((tc: any) => tc.class)
      } as TeacherProfile;

      setTeacher(profile);
      const foundHomeroom = profile.teachable_classes.find(tc => tc.is_homeroom)?.class || null;
      setHomeroomClass(foundHomeroom);

      if (!foundHomeroom) {
        setIsLoading(false);
        return;
      }
      
      // 2. Fetch students for the teacher's homeroom class
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', foundHomeroom.id)
        .eq('school_id', userProfile.school_id)
        .order('full_name');
        
      if (studentError) throw studentError;
      setStudents(studentData || []);

      // 3. Fetch existing attendance for the selected date and homeroom class
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('student_attendance')
        .select('student_id, status')
        .eq('class_id', foundHomeroom.id)
        .eq('attendance_date', attendanceDate)
        .eq('school_id', userProfile.school_id);
      
      if (attendanceError) throw attendanceError;
      
      const newRecords: AttendanceMap = {};
      if (attendanceData && attendanceData.length > 0) {
        attendanceData.forEach(rec => {
          newRecords[rec.student_id] = rec.status as AttendanceStatus;
        });
        setIsAlreadyMarked(true);
      } else {
        // Default all students to 'Present' if no records exist
        (studentData || []).forEach(student => {
          if (student.id) newRecords[student.id] = 'Present';
        });
        setIsAlreadyMarked(false);
      }
      setAttendanceRecords(newRecords);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  }, [session.user.id, attendanceDate, userProfile.school_id]);

  useEffect(() => {
    fetchInitialData();
  }, [attendanceDate, fetchInitialData]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (!homeroomClass || !teacher?.id) return;
    setIsLoading(true);
    setMessage(null);

    const recordsToUpsert = Object.entries(attendanceRecords).map(([student_id, status]) => ({
      student_id,
      status,
      class_id: homeroomClass.id,
      attendance_date: attendanceDate,
      marked_by: userProfile.id,
      school_id: userProfile.school_id
    }));

    try {
      const { error } = await supabase.from('student_attendance').upsert(recordsToUpsert, {
        onConflict: 'school_id,student_id,attendance_date',
      });
      if (error) throw error;
      
      // Notify parents of absent/late students
      try {
          const absentOrLate = recordsToUpsert.filter(r => r.status === 'Absent' || r.status === 'Late');
          for (const record of absentOrLate) {
              const student = students.find(s => s.id === record.student_id);
              if (student) {
                  // Find parents linked to this student
                  const { data: parents } = await supabase
                      .from('profiles')
                      .select('id')
                      .contains('admission_numbers', [student.admission_number]);
                  
                  if (parents && parents.length > 0) {
                      const notifications = parents.map(p => ({
                          user_id: p.id,
                          title: `Attendance Alert: ${student.full_name}`,
                          message: `${student.full_name} was marked ${record.status} today (${attendanceDate}).`,
                          type: record.status === 'Absent' ? 'error' : 'warning'
                      }));
                      await supabase.from('notifications').insert(notifications);
                  }
              }
          }
      } catch (err) {
          console.error("Failed to send attendance notifications:", err);
      }

      setMessage({ type: 'success', text: 'Attendance has been saved successfully!' });
      setIsAlreadyMarked(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save attendance.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !teacher) {
      return <div className="text-gray-900 dark:text-white">Loading your information...</div>;
  }

  if (!homeroomClass) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Class Attendance</h1>
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md dark:bg-yellow-900/50 dark:text-yellow-200">
            You are not currently assigned to a homeroom class. Please contact the administrator.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Class Attendance</h1>
          <p className="text-gray-600 dark:text-gray-300">Class: {homeroomClass.name}</p>
        </div>
        <div>
            <label htmlFor="attendance-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Date</label>
            <input
            type="date"
            id="attendance-date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            className="p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}

      {isAlreadyMarked && !message && (
        <div className="p-4 rounded-md mb-6 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
            Attendance for this date has already been recorded. You can still make changes and update.
        </div>
      )}

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
         <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                    <th className="px-6 py-3">Student Name</th>
                    <th className="px-6 py-3 text-center">Status</th>
                </tr>
            </thead>
            <tbody>
                {students.map(student => (
                    <tr key={student.id} className="border-b dark:border-gray-700">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{student.full_name}</td>
                        <td className="px-6 py-4">
                           <div className="flex items-center justify-center space-x-2">
                                {(['Present', 'Absent', 'Late'] as AttendanceStatus[]).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusChange(student.id!, status)}
                                        className={`px-3 py-1.5 w-24 text-sm font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                            attendanceRecords[student.id!] === status 
                                                ? statusConfig[status].button + ' ring-2'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                           </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {students.length === 0 && !isLoading && (
            <p className="p-6 text-center text-gray-500 dark:text-gray-400">No students found in this class.</p>
        )}
      </div>

      <div className="flex justify-end mt-6">
          <button
            onClick={handleSaveAttendance}
            disabled={isLoading || students.length === 0}
            className="px-8 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400"
          >
            {isLoading ? 'Saving...' : isAlreadyMarked ? 'Update Attendance' : 'Save Attendance'}
          </button>
      </div>

    </div>
  );
};

export default ClassAttendance;