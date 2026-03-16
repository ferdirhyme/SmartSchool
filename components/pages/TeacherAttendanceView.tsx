import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { TeacherAttendance } from '../../types.ts';
import { Search, Calendar, Clock, User } from 'lucide-react';

const TeacherAttendanceView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<TeacherAttendance[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, full_name, staff_id');
      if (teachersError) throw teachersError;

      const teacherMap = new Map((teachersData || []).map(t => [t.id, { full_name: t.full_name, staff_id: t.staff_id }]));

      const { data, error } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('attendance_date', selectedDate)
        .order('check_in_time', { ascending: true });

      if (error) throw error;

      const combinedData = (data || []).map(record => ({
        ...record,
        teacher: teacherMap.get(record.teacher_id) || { full_name: 'Unknown Teacher', staff_id: 'N/A' }
      }));

      setAttendanceRecords(combinedData as TeacherAttendance[]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance records.');
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const filteredRecords = attendanceRecords.filter(record => 
    record.teacher?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.teacher?.staff_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (time: string | null | undefined) => {
    if (!time) return '--:--';
    try {
        // Handle HH:MM:SS format
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff Attendance Logs</h1>
        <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm font-medium">
          <Calendar className="w-4 h-4" />
          {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or staff ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Clock className="w-6 h-6 animate-spin mr-2" />
          Loading records...
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
                  <th className="px-6 py-4 font-semibold">Staff Member</th>
                  <th className="px-6 py-4 font-semibold">Staff ID</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold">Check-in</th>
                  <th className="px-6 py-4 font-semibold">Check-out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                            <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{record.teacher?.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {record.teacher?.staff_id}
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
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No attendance records found for this criteria.
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

export default TeacherAttendanceView;