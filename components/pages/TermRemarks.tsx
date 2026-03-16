
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.ts';
// Added missing imports and moved ReportDetails to types.ts
import { Class, Student, StudentTermReport, UserRole, Profile, ReportDetails } from '../../types.ts';

interface TermRemarksProps {
    profile: Profile;
}

interface StudentReportsMap {
  [studentId: string]: ReportDetails;
}

// Helper to estimate date ranges for terms to fetch attendance
const getTermDateRange = (year: number, term: string) => {
    if (term === 'Term 1') return { start: `${year}-09-01`, end: `${year}-12-31` };
    if (term === 'Term 2') return { start: `${year + 1}-01-01`, end: `${year + 1}-04-30` }; // Typically spills into next calendar year
    if (term === 'Term 3') return { start: `${year + 1}-05-01`, end: `${year + 1}-08-31` };
    // Fallback
    return { start: `${year}-01-01`, end: `${year}-12-31` };
};

const TermRemarks: React.FC<TermRemarksProps> = ({ profile }) => {
    // Component State
    const [teachableClasses, setTeachableClasses] = useState<Class[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedTerm, setSelectedTerm] = useState<string>('Term 1');
    const [selectedYear, setSelectedYear] = useState<number | ''>(new Date().getFullYear());
    const [reports, setReports] = useState<StudentReportsMap>({});
    const [calculatedAttendance, setCalculatedAttendance] = useState<{ [studentId: string]: { present: number, total: number } }>({});
    const [searchTerm, setSearchTerm] = useState('');
    
    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    
    const isHeadteacher = profile.role === UserRole.Headteacher;

    // Fetch classes based on role
    useEffect(() => {
        const fetchClasses = async () => {
            setIsLoading(true);
            try {
                let availableClasses: Class[] = [];

                if (isHeadteacher) {
                    // Headteachers can see all classes
                    const { data: classData, error } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name');
                    if (error) throw error;
                    availableClasses = classData || [];
                } else {
                    // Teachers see classes they are assigned to in Staff List OR Timetable
                    const { data: teacherId, error: rpcError } = await supabase.rpc('get_teacher_id_by_auth_email');
                    if (rpcError || !teacherId) throw new Error("Could not find your teacher profile.");

                    // 1. Get classes from Staff List assignments (teacher_classes)
                    const { data: teacherClassesData } = await supabase
                        .from('teacher_classes')
                        .select('class:classes(*)')
                        .eq('teacher_id', teacherId);
                    
                    // 2. Get classes from Timetable assignments
                    const { data: timetableClassesData } = await supabase
                        .from('timetable')
                        .select('class:classes(*)')
                        .eq('teacher_id', teacherId);
                    
                    const allClasses = [
                        ...((teacherClassesData || []).map((tc: any) => tc.class)),
                        ...((timetableClassesData || []).map((t: any) => t.class))
                    ].filter((c: any): c is Class => !!c);
                    
                    // Unique classes by ID
                    availableClasses = Array.from(new Map(allClasses.map(item => [item.id, item])).values())
                        .sort((a, b) => a.name.localeCompare(b.name));
                }

                setTeachableClasses(availableClasses);
                if (availableClasses.length > 0) {
                    setSelectedClassId(availableClasses[0].id);
                }

            } catch(err: any) {
                setMessage({ type: 'error', text: err.message || "Failed to load classes." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClasses();
    }, [isHeadteacher]);

    // Fetch students, reports, and attendance
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedClassId || !selectedTerm || !selectedYear) {
                setStudents([]);
                setReports({});
                return;
            }

            setIsLoading(true);
            setMessage(null);
            
            try {
                // 1. Get Students
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('*')
                    .eq('class_id', selectedClassId)
                    .eq('school_id', profile.school_id)
                    .order('full_name');
                if (studentError) throw studentError;
                setStudents(studentData || []);
                
                // 2. Get Existing Term Reports
                const { data: reportData, error: reportError } = await supabase
                    .from('student_term_reports')
                    .select('*')
                    .eq('class_id', selectedClassId)
                    .eq('term', selectedTerm)
                    .eq('year', selectedYear)
                    .eq('school_id', profile.school_id);

                if (reportError) throw reportError;

                // 3. Get Attendance Data for Auto-population
                const { start, end } = getTermDateRange(Number(selectedYear), selectedTerm);
                const { data: attendanceData, error: attendanceError } = await supabase
                    .from('student_attendance')
                    .select('student_id, status, attendance_date')
                    .eq('class_id', selectedClassId)
                    .eq('school_id', profile.school_id)
                    .gte('attendance_date', start)
                    .lte('attendance_date', end);
                
                if (attendanceError) console.error("Error fetching attendance for calc:", attendanceError);

                // Calculate Attendance Stats per student
                // Total Days = Unique dates where attendance was taken for this class
                const uniqueDates = new Set((attendanceData || []).map(a => a.attendance_date));
                const calculatedTotalDays = uniqueDates.size;

                const attendanceStats: Record<string, number> = {};
                const studentCalculated: { [studentId: string]: { present: number, total: number } } = {};
                
                (attendanceData || []).forEach(record => {
                    if (record.status === 'Present' || record.status === 'Late') {
                        attendanceStats[record.student_id] = (attendanceStats[record.student_id] || 0) + 1;
                    }
                });

                const initialReports: StudentReportsMap = {};
                
                // Cast to StudentTermReport[] to ensure types are correct
                const termReports = (reportData || []) as unknown as StudentTermReport[];
                
                (studentData || []).forEach(student => {
                    const existing = termReports.find((r) => r.student_id === student.id);
                    
                    const present = (attendanceStats[student.id!] || 0);
                    const total = calculatedTotalDays;
                    
                    studentCalculated[student.id!] = { present, total };

                    // Use existing value if saved, otherwise use calculated value
                    const initialPresent = (existing?.attendance_present !== undefined && existing?.attendance_present !== null)
                        ? existing.attendance_present 
                        : present;
                        
                    const initialTotal = (existing?.attendance_total !== undefined && existing?.attendance_total !== null)
                        ? existing.attendance_total
                        : total;

                    initialReports[student.id!] = {
                        attitude: existing?.attitude || '',
                        conduct: existing?.conduct || '',
                        interest: existing?.interest || '',
                        class_teacher_remarks: existing?.class_teacher_remarks || '',
                        headteacher_remarks: existing?.headteacher_remarks || '',
                        attendance_present: initialPresent,
                        attendance_total: initialTotal
                    };
                });
                setCalculatedAttendance(studentCalculated);
                setReports(initialReports);

            } catch (err: any) {
                if (err.message && err.message.includes('relation "public.student_term_reports" does not exist')) {
                     setMessage({ type: 'error', text: 'Database Table Missing: Please go to Settings > Advanced and run the "2. Term Report Tables" script.' });
                } else {
                    setMessage({ type: 'error', text: err.message || 'Failed to load data.' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedClassId, selectedTerm, selectedYear]);
    
    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) {
            return students;
        }
        return students.filter(student =>
            student.full_name.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );
    }, [students, searchTerm]);

    /**
     * Fix for property access on unknown type in handleReportChange.
     */
    const handleReportChange = (studentId: string, field: keyof ReportDetails, value: string | number | null) => {
        setReports(prev => {
            const current = (prev[studentId] || {}) as ReportDetails;
            return {
                ...prev,
                [studentId]: {
                    ...current,
                    [field]: value
                }
            };
        });
    };
    
    const syncAttendance = () => {
        setReports(prev => {
            const next = { ...prev };
            Object.keys(calculatedAttendance).forEach(studentId => {
                if (next[studentId]) {
                    next[studentId] = {
                        ...next[studentId],
                        attendance_present: calculatedAttendance[studentId].present,
                        attendance_total: calculatedAttendance[studentId].total
                    };
                }
            });
            return next;
        });
        setMessage({ type: 'success', text: 'Attendance synced with latest records.' });
    };

    const handleSave = async () => {
        if (!selectedClassId || !selectedTerm || !selectedYear) return;

        setIsSaving(true);
        setMessage(null);
        
        const recordsToUpsert = Object.entries(reports)
            .filter(([, details]: [string, ReportDetails]) => Object.values(details).some(v => v !== null && v !== ''))
            .map(([studentId, details]: [string, ReportDetails]) => ({
                student_id: studentId,
                class_id: selectedClassId,
                term: selectedTerm,
                year: selectedYear,
                attitude: details.attitude,
                conduct: details.conduct,
                interest: details.interest,
                class_teacher_remarks: details.class_teacher_remarks,
                headteacher_remarks: details.headteacher_remarks,
                attendance_present: details.attendance_present,
                attendance_total: details.attendance_total
            }));

        if (recordsToUpsert.length === 0) {
            setMessage({type: 'success', text: 'No new data to save.'});
            setIsSaving(false);
            return;
        }

        try {
            const { error } = await supabase.from('student_term_reports').upsert(recordsToUpsert.map(r => ({ ...r, school_id: profile.school_id })), {
                onConflict: 'school_id,student_id,class_id,term,year'
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Remarks saved successfully!' });
        } catch (err: any) {
             setMessage({ type: 'error', text: err.message || 'Failed to save.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const commonInputClass = "w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm focus:ring-brand-500 focus:border-brand-500";

    if (teachableClasses.length === 0 && !isLoading) {
        return (
             <div>
                <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Term Remarks & Conduct</h1>
                <button 
                    onClick={syncAttendance}
                    disabled={isLoading || Object.keys(calculatedAttendance).length === 0}
                    className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 rounded-md transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Attendance
                </button>
            </div>
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-md">
                    You are not assigned to any classes to enter remarks.
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Term Remarks & Conduct</h1>
                <button 
                    onClick={syncAttendance}
                    disabled={isLoading || Object.keys(calculatedAttendance).length === 0}
                    className="px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 rounded-md transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Attendance
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
                    <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">
                        {teachableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
                    <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                    <input 
                        type="number" 
                        value={selectedYear === '' || isNaN(selectedYear as number) ? '' : selectedYear} 
                        onChange={e => setSelectedYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))} 
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600" 
                    />
                </div>
            </div>

             <div className="mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search student name..."
                    className="w-full max-w-md p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                />
            </div>

             {message && (
              <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                {message.text}
              </div>
            )}

            {isLoading ? <p>Loading...</p> : (
                <div className="space-y-6">
                    {filteredStudents.length === 0 ? (
                        <p className="text-gray-500">No students found.</p>
                    ) : (
                        filteredStudents.map(student => {
                            /**
                             * Fix for property access errors on unknown type by applying explicit casting to 'ReportDetails'.
                             */
                            const details = (reports[student.id!] || {}) as ReportDetails;
                            return (
                                <div key={student.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                                    <h3 className="font-bold text-lg mb-4 text-brand-700 dark:text-brand-400">{student.full_name} <span className="text-sm font-normal text-gray-500">({student.admission_number})</span></h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Attitude</label>
                                            <input type="text" value={details.attitude || ''} onChange={e => handleReportChange(student.id!, 'attitude', e.target.value)} className={commonInputClass} placeholder="e.g. Enthusiastic" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Conduct</label>
                                            <input type="text" value={details.conduct || ''} onChange={e => handleReportChange(student.id!, 'conduct', e.target.value)} className={commonInputClass} placeholder="e.g. Good" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Interest</label>
                                            <input type="text" value={details.interest || ''} onChange={e => handleReportChange(student.id!, 'interest', e.target.value)} className={commonInputClass} placeholder="e.g. Reading" />
                                        </div>
                                         <div className="flex space-x-2">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Present</label>
                                                <input 
                                                    type="number" 
                                                    value={details.attendance_present === null || details.attendance_present === undefined || isNaN(details.attendance_present as number) ? '' : details.attendance_present} 
                                                    onChange={e => handleReportChange(student.id!, 'attendance_present', e.target.value === '' ? null : parseInt(e.target.value))} 
                                                    className={commonInputClass} 
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Total Days</label>
                                                <input 
                                                    type="number" 
                                                    value={details.attendance_total === null || details.attendance_total === undefined || isNaN(details.attendance_total as number) ? '' : details.attendance_total} 
                                                    onChange={e => handleReportChange(student.id!, 'attendance_total', e.target.value === '' ? null : parseInt(e.target.value))} 
                                                    className={commonInputClass} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Class Teacher's Remarks</label>
                                            <textarea rows={2} value={details.class_teacher_remarks || ''} onChange={e => handleReportChange(student.id!, 'class_teacher_remarks', e.target.value)} className={commonInputClass} placeholder="Teacher's comment..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Headteacher's Remarks</label>
                                            <textarea rows={2} value={details.headteacher_remarks || ''} onChange={e => handleReportChange(student.id!, 'headteacher_remarks', e.target.value)} className={commonInputClass} placeholder="Headteacher's comment..." disabled={!isHeadteacher} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

             <div className="fixed bottom-8 right-8">
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading || students.length === 0}
                className="px-8 py-4 shadow-lg font-bold rounded-full text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 transition-transform transform hover:scale-105"
              >
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
        </div>
    );
};

export default TermRemarks;
