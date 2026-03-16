
import React, { useState, useEffect, useMemo } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
// Imported robust types to fix property access errors
import { TeacherProfile, Student, StudentAssessment, Class, Subject, Profile } from '../../types.ts';

// Define the shape of our assessment scores state for a single student
interface ScoreInfo {
  class_exercises?: number | null;
  class_tests?: number | null;
  project_work?: number | null;
  observation_attitude?: number | null;
  exam_score?: number | null;
  remarks?: string | null;
}

// Map student IDs to their scores
interface StudentScores {
  [studentId: string]: ScoreInfo;
}

interface AssessmentProps {
  session: Session;
  profile: Profile;
}

// --- Helper function and constants ---
const isJHS = (className: string = '') => className.toUpperCase().includes('JHS');

const WEIGHTS = {
  PRIMARY: { class_exercises: 20, class_tests: 15, project_work: 15, observation_attitude: 10, exam_score: 40 },
  JHS: { class_exercises: 15, class_tests: 15, project_work: 15, observation_attitude: 15, exam_score: 40 },
};
type WeightKeys = keyof typeof WEIGHTS.PRIMARY;

const Assessment: React.FC<AssessmentProps> = ({ session, profile: userProfile }) => {
    // Component State
    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
    const [teachableClasses, setTeachableClasses] = useState<Class[]>([]);
    const [allTeacherSubjects, setAllTeacherSubjects] = useState<Subject[]>([]);
    const [timetableAssignments, setTimetableAssignments] = useState<{class_id: string, subject_id: string}[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [subjectsForClass, setSubjectsForClass] = useState<Subject[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedTermName, setSelectedTermName] = useState<string>('Term 1');
    const [selectedYear, setSelectedYear] = useState<number | ''>(new Date().getFullYear());
    const [scores, setScores] = useState<StudentScores>({});
    const [searchTerm, setSearchTerm] = useState('');
    
    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

    // Determine current weights based on class name
    const selectedClassName = teachableClasses.find(c => c.id === selectedClassId)?.name;
    const currentWeights = isJHS(selectedClassName) ? WEIGHTS.JHS : WEIGHTS.PRIMARY;

    // Fetch initial teacher data, their classes, and the subjects they teach
    useEffect(() => {
        const fetchTeacherData = async () => {
            setIsLoading(true);
            setMessage(null);
            try {
                const { data: teacherId, error: rpcError } = await supabase
                    .rpc('get_teacher_id_by_auth_email');
                
                if (rpcError || !teacherId) {
                    throw new Error("Could not find your teacher profile. This is likely a database permission issue. Please contact your administrator and ask them to run the required setup script from the Settings > Advanced page.");
                }

                const { data, error } = await supabase
                    .from('teachers')
                    .select(`
                        id,
                        email,
                        school_id,
                        subjects:teacher_subjects(subject:subjects(*)),
                        teachable_classes:teacher_classes(
                            is_homeroom,
                            class:classes(*)
                        )
                    `)
                    .eq('id', teacherId)
                    .single();

                if (error || !data) {
                    setMessage({ type: 'error', text: 'Could not load your teacher profile.' });
                    setIsLoading(false);
                    return;
                }

                const schoolId = data.school_id || userProfile.school_id;

                // Explicitly cast the transformed profile to fix inference issues
                const profile = {
                    ...data,
                    subjects: (data.subjects || []).map((ts: any) => ts.subject as Subject).filter(Boolean),
                    teachable_classes: (data.teachable_classes || []).map((tc: any) => ({ class: tc.class, is_homeroom: tc.is_homeroom })).filter((tc: any) => tc.class)
                } as TeacherProfile;
                
                setTeacherProfile(profile);
                
                // Fetch classes from both teacher_classes and timetable
                const [teacherClassesRes, timetableClassesRes] = await Promise.all([
                    supabase.from('teacher_classes').select('class:classes(*)').eq('teacher_id', teacherId),
                    supabase.from('timetable').select('class:classes(*)').eq('teacher_id', teacherId)
                ]);

                const allClasses = [
                    ...(teacherClassesRes.data || []).map((tc: any) => tc.class),
                    ...(timetableClassesRes.data || []).map((t: any) => t.class)
                ].filter((c: any): c is Class => !!c);

                // Unique classes by ID
                const uniqueClasses = Array.from(new Map(allClasses.map(item => [item.id, item])).values())
                    .sort((a, b) => a.name.localeCompare(b.name));
                
                setTeachableClasses(uniqueClasses);

                // sorting subjects now uses correctly typed Subject objects
                const sortedSubjects = [...profile.subjects].sort((a, b) => a.name.localeCompare(b.name));
                setAllTeacherSubjects(sortedSubjects);

                // Fetch timetable assignments to know which subjects are taught in which classes
                const { data: timetableData } = await supabase
                    .from('timetable')
                    .select('class_id, subject_id')
                    .eq('teacher_id', teacherId);
                
                setTimetableAssignments(timetableData || []);

                if (uniqueClasses && uniqueClasses.length > 0) {
                    const homeroomLink = profile.teachable_classes.find(tc => tc.is_homeroom);
                    const initialClassId = homeroomLink?.class?.id || uniqueClasses[0].id;
                    setSelectedClassId(initialClassId);
                    
                    // Initial subject filtering
                    const classSubjects = (timetableData || []).length > 0
                        ? sortedSubjects.filter(s => 
                            timetableData?.some(t => t.class_id === initialClassId && t.subject_id === s.id)
                          )
                        : sortedSubjects;
                    
                    setSubjectsForClass(classSubjects.length > 0 ? classSubjects : sortedSubjects);
                    if (classSubjects.length > 0) {
                        setSelectedSubjectId(classSubjects[0].id);
                    } else if (sortedSubjects.length > 0) {
                        setSelectedSubjectId(sortedSubjects[0].id);
                    }
                }

            } catch(err: any) {
                setMessage({ type: 'error', text: err.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchTeacherData();
    }, [session.user.id, userProfile.school_id]);

    // Update subjects when class changes
    useEffect(() => {
        if (!selectedClassId || !teacherProfile) return;

        const isHomeroom = teacherProfile.teachable_classes.some(tc => tc.class?.id === selectedClassId && tc.is_homeroom);

        const fetchSubjects = async () => {
            try {
                if (isHomeroom) {
                    // If homeroom teacher, show ALL subjects in the school
                    const { data: allSubjects, error } = await supabase
                        .from('subjects')
                        .select('*')
                        .eq('school_id', userProfile.school_id)
                        .order('name');
                    
                    if (error) throw error;
                    setSubjectsForClass(allSubjects || []);
                    
                    if (allSubjects && allSubjects.length > 0) {
                        // Only change selection if current one is invalid
                        if (!selectedSubjectId || !allSubjects.find(s => s.id === selectedSubjectId)) {
                            setSelectedSubjectId(allSubjects[0].id);
                        }
                    }
                } else {
                    // 1. Get subjects assigned to this teacher in the timetable for THIS class
                    const { data: timetableData, error: timetableError } = await supabase
                        .from('timetable')
                        .select('subject:subjects(*)')
                        .eq('class_id', selectedClassId)
                        .eq('teacher_id', teacherProfile.id);
                    
                    if (timetableError) throw timetableError;

                    const subjectsFromTimetable = (timetableData || [])
                        .map((t: any) => t.subject as Subject)
                        .filter(Boolean);

                    // 2. Combine with subjects assigned to teacher in Staff List (allTeacherSubjects)
                    // We show allTeacherSubjects as a fallback or if they are assigned generally
                    const merged = [...subjectsFromTimetable];
                    allTeacherSubjects.forEach(s => {
                        if (!merged.find(m => m.id === s.id)) {
                            merged.push(s);
                        }
                    });

                    const finalSubjects = merged.sort((a, b) => a.name.localeCompare(b.name));
                    setSubjectsForClass(finalSubjects);
                    
                    if (finalSubjects.length > 0) {
                        if (!selectedSubjectId || !finalSubjects.find(s => s.id === selectedSubjectId)) {
                            setSelectedSubjectId(finalSubjects[0].id);
                        }
                    } else {
                        setSelectedSubjectId('');
                    }
                }
            } catch (err: any) {
                console.error("Error fetching subjects:", err);
                setMessage({ type: 'error', text: 'Failed to load subjects for this class.' });
            }
        };

        fetchSubjects();
    }, [selectedClassId, allTeacherSubjects, teacherProfile, userProfile.school_id]);

    // Fetch students and their scores when class, subject, or term changes
    useEffect(() => {
        const fetchStudentsAndScores = async () => {
            if (!selectedClassId || !selectedSubjectId || !selectedTermName || !selectedYear) {
                setStudents([]);
                setScores({});
                return;
            }

            setIsLoading(true);
            setMessage(null);
            
            try {
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select('*')
                    .eq('class_id', selectedClassId)
                    .eq('school_id', userProfile.school_id)
                    .order('full_name');
                if (studentError) throw studentError;
                setStudents(studentData || []);
                
                const { data: scoreData, error: scoreError } = await supabase
                    .from('student_assessments')
                    .select('*')
                    .eq('class_id', selectedClassId)
                    .eq('subject_id', selectedSubjectId)
                    .eq('term', selectedTermName)
                    .eq('year', selectedYear)
                    .eq('school_id', userProfile.school_id);

                if (scoreError) throw scoreError;
                
                const assessmentScores: StudentAssessment[] = scoreData || [];

                const initialScores: StudentScores = {};
                (studentData || []).forEach(student => {
                    const existingScore = assessmentScores.find(s => s.student_id === student.id);
                    initialScores[student.id!] = {
                        class_exercises: existingScore?.class_exercises,
                        class_tests: existingScore?.class_tests,
                        project_work: existingScore?.project_work,
                        observation_attitude: existingScore?.observation_attitude,
                        exam_score: existingScore?.exam_score,
                        remarks: existingScore?.remarks,
                    };
                });
                setScores(initialScores);

            } catch (err: any) {
                setMessage({ type: 'error', text: err.message || 'Failed to load data.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchStudentsAndScores();
    }, [selectedClassId, selectedSubjectId, selectedTermName, selectedYear, userProfile.school_id]);
    
    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) {
            return students;
        }
        return students.filter(student =>
            student.full_name.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );
    }, [students, searchTerm]);

    const handleScoreChange = (studentId: string, field: keyof ScoreInfo, value: string | number) => {
        let finalValue: string | number | null = value;

        if (field !== 'remarks') {
            const numericValue = Number(value);
            const maxVal = currentWeights[field as WeightKeys];
            if (numericValue > maxVal) finalValue = maxVal;
            else if (numericValue < 0) finalValue = 0;
            else finalValue = numericValue;

            if (value === '') finalValue = null;
        }

        setScores(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: finalValue,
            }
        }));
    };
    
    const handleSaveScores = async () => {
        if (!selectedClassId || !selectedSubjectId || !selectedTermName || !selectedYear || !teacherProfile?.id) {
            setMessage({ type: 'error', text: 'Cannot save scores. Missing required information.' });
            return;
        }

        setIsSaving(true);
        setMessage(null);
        
        const recordsToUpsert = Object.entries(scores)
            .filter(([, scoreData]: [string, ScoreInfo]) => Object.values(scoreData).some(v => v != null && (typeof v !== 'string' || v.trim() !== '')))
            .map(([studentId, scoreData]: [string, ScoreInfo]) => {
                const ca_score = (Number(scoreData.class_exercises) || 0) +
                               (Number(scoreData.class_tests) || 0) +
                               (Number(scoreData.project_work) || 0) +
                               (Number(scoreData.observation_attitude) || 0);
                const total_score = ca_score + (Number(scoreData.exam_score) || 0);

                return {
                    student_id: studentId,
                    class_id: selectedClassId,
                    subject_id: selectedSubjectId,
                    teacher_id: teacherProfile.id,
                    term: selectedTermName,
                    year: selectedYear,
                    class_exercises: scoreData.class_exercises,
                    class_tests: scoreData.class_tests,
                    project_work: scoreData.project_work,
                    observation_attitude: scoreData.observation_attitude,
                    continuous_assessment_score: ca_score,
                    exam_score: scoreData.exam_score,
                    total_score: total_score,
                    remarks: scoreData.remarks,
                    school_id: userProfile.school_id
                };
            });

        if (recordsToUpsert.length === 0) {
            setMessage({type: 'success', text: 'No new scores to save.'});
            setIsSaving(false);
            return;
        }

        try {
            const { error } = await supabase.from('student_assessments').upsert(recordsToUpsert, {
                onConflict: 'student_id,class_id,subject_id,term,year'
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Scores saved successfully!' });
        } catch (err: any) {
            if (err.message && err.message.includes('no unique or exclusion constraint matching the ON CONFLICT')) {
                setMessage({ type: 'error', text: 'Database schema error: The student_assessments table has an incorrect structure. Please run the provided SQL script to fix it. Note: This will erase all existing assessment data.' });
            } else {
                setMessage({ type: 'error', text: err.message || 'Failed to save scores.' });
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    // Render logic
    if (message && message.type === 'error' && !teacherProfile && !isLoading) {
        return (
            <div className="max-w-2xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <h2 className="text-xl font-bold">Connection Error</h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{message.text}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    if (isLoading && !teacherProfile) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mb-4"></div>
            <p className="text-gray-500 animate-pulse">Loading teacher profile...</p>
        </div>
    );
    
    if (teachableClasses.length === 0 && !isLoading) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Assessment</h1>
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-md">
                    You are not assigned to any classes. Assessment recording is only available for teachers assigned to a class.
                </div>
            </div>
        );
    }
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Student Assessment</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
                    <select id="class-select" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500">
                        {teachableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="subject-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                    <select id="subject-select" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500" disabled={subjectsForClass.length === 0}>
                        {subjectsForClass.length > 0 ? (
                            subjectsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        ) : (
                            <option>No subjects assigned to you</option>
                        )}
                    </select>
                </div>
                <div>
                    <label htmlFor="term-name-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
                    <select
                        id="term-name-select"
                        value={selectedTermName}
                        onChange={e => setSelectedTermName(e.target.value)}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500"
                    >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="year-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                    <input
                        id="year-input"
                        type="number"
                        value={selectedYear === '' || isNaN(selectedYear as number) ? '' : selectedYear}
                        onChange={e => setSelectedYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500"
                        placeholder="e.g., 2024"
                    />
                </div>
            </div>

            <div className="mb-6">
                <label htmlFor="student-search" className="sr-only">Search Students</label>
                <input
                    id="student-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search student name..."
                    className="w-full max-w-md p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500"
                />
            </div>
            
            {message && (
              <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                {message.text}
              </div>
            )}
            
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                 <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-3 min-w-[200px]">Student Name</th>
                            <th className="px-2 py-3 w-28 text-center">Homework ({currentWeights.class_exercises})</th>
                            <th className="px-2 py-3 w-28 text-center">Class Tests ({currentWeights.class_tests})</th>
                            <th className="px-2 py-3 w-28 text-center">Project Work ({currentWeights.project_work})</th>
                            <th className="px-2 py-3 w-28 text-center">Attitude ({currentWeights.observation_attitude})</th>
                            <th className="px-4 py-3 w-28 text-center font-bold">Total CA (/60)</th>
                            <th className="px-2 py-3 w-28 text-center">Exam Score ({currentWeights.exam_score})</th>
                            <th className="px-4 py-3 w-28 text-center font-bold">Grand Total (/100)</th>
                            <th className="px-4 py-3 min-w-[200px]">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={9} className="text-center p-6 text-gray-500 dark:text-gray-400">Loading students and scores...</td></tr>
                        ) : filteredStudents.length > 0 ? (
                            filteredStudents.map(student => {
                                const studentScore = scores[student.id!];
                                const ca_total = (Number(studentScore?.class_exercises) || 0) +
                                                 (Number(studentScore?.class_tests) || 0) +
                                                 (Number(studentScore?.project_work) || 0) +
                                                 (Number(studentScore?.observation_attitude) || 0);
                                const grand_total = ca_total + (Number(studentScore?.exam_score) || 0);
                                const inputClass = "w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-center";
    
                                return (
                                    <tr key={student.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{student.full_name}</td>
                                        <td className="px-2 py-1"><input type="number" min="0" max={currentWeights.class_exercises} value={studentScore?.class_exercises === null || studentScore?.class_exercises === undefined || isNaN(studentScore?.class_exercises as number) ? '' : studentScore?.class_exercises} onChange={e => handleScoreChange(student.id!, 'class_exercises', e.target.value)} className={inputClass} /></td>
                                        <td className="px-2 py-1"><input type="number" min="0" max={currentWeights.class_tests} value={studentScore?.class_tests === null || studentScore?.class_tests === undefined || isNaN(studentScore?.class_tests as number) ? '' : studentScore?.class_tests} onChange={e => handleScoreChange(student.id!, 'class_tests', e.target.value)} className={inputClass} /></td>
                                        <td className="px-2 py-1"><input type="number" min="0" max={currentWeights.project_work} value={studentScore?.project_work === null || studentScore?.project_work === undefined || isNaN(studentScore?.project_work as number) ? '' : studentScore?.project_work} onChange={e => handleScoreChange(student.id!, 'project_work', e.target.value)} className={inputClass} /></td>
                                        <td className="px-2 py-1"><input type="number" min="0" max={currentWeights.observation_attitude} value={studentScore?.observation_attitude === null || studentScore?.observation_attitude === undefined || isNaN(studentScore?.observation_attitude as number) ? '' : studentScore?.observation_attitude} onChange={e => handleScoreChange(student.id!, 'observation_attitude', e.target.value)} className={inputClass} /></td>
                                        <td className="px-4 py-2 text-center font-bold text-lg text-gray-900 dark:text-white">{ca_total}</td>
                                        <td className="px-2 py-1"><input type="number" min="0" max={currentWeights.exam_score} value={studentScore?.exam_score === null || studentScore?.exam_score === undefined || isNaN(studentScore?.exam_score as number) ? '' : studentScore?.exam_score} onChange={e => handleScoreChange(student.id!, 'exam_score', e.target.value)} className={inputClass} /></td>
                                        <td className="px-4 py-2 text-center font-bold text-lg text-brand-600 dark:text-brand-400">{grand_total}</td>
                                        <td className="px-2 py-1"><input type="text" value={studentScore?.remarks ?? ''} onChange={e => handleScoreChange(student.id!, 'remarks', e.target.value)} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-left" /></td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={9} className="text-center p-6 text-gray-500 dark:text-gray-400">
                                    {students.length > 0
                                        ? 'No students match your search.'
                                        : 'No students found for this class and subject.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                 </table>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveScores}
                disabled={isSaving || isLoading || filteredStudents.length === 0}
                className="px-8 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400"
              >
                {isSaving ? 'Saving...' : 'Save Scores'}
              </button>
            </div>
        </div>
    );
};

export default Assessment;
