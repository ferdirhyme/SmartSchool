import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { TeacherAttendance, Profile } from '../../types.ts';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface MyAttendanceProps {
  profile: Profile;
}

const MyAttendance: React.FC<MyAttendanceProps> = ({ profile }) => {
  const [attendanceRecords, setAttendanceRecords] = useState<TeacherAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0 });

  const fetchMyAttendance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: teacherId } = await supabase.rpc('get_teacher_id_by_auth_email');
      
      if (!teacherId) throw new Error("Teacher profile not found.");

      const { data, error } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('attendance_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      setAttendanceRecords(data as TeacherAttendance[]);

      // Calculate simple stats
      const s = { present: 0, late: 0, absent: 0 };
      (data || []).forEach(r => {
          if (r.status === 'Present') s.present++;
          else if (r.status === 'Late') s.late++;
          else if (r.status === 'Absent') s.absent++;
      });
      setStats(s);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch your attendance records.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchMyAttendance();
  }, [fetchMyAttendance]);

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '--:--';
    try {
        const [hours, minutes] = time.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10));
        date.setMinutes(parseInt(minutes, 10));
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return time;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Attendance History</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400">Showing last 30 days</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Days Present</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.present}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Days Late</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.late}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Days Absent</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.absent}</p>
              </div>
          </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Clock className="w-6 h-6 animate-spin mr-2" />
          Loading your records...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
          Error: {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold">Check-in</th>
                  <th className="px-6 py-4 font-semibold">Check-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {attendanceRecords.length > 0 ? (
                  attendanceRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                              {new Date(record.attendance_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          record.status === 'Present' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                          record.status === 'Late' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-900 dark:text-white">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-900 dark:text-white">
                        {formatTime(record.check_out_time)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
