import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Class, Student, StudentAssessment, Subject, Profile } from '../../types.ts';

interface StudentWithAverage extends Student {
  average: number | null;
  eligible: boolean;
}

interface PromotionPageProps {
  profile: Profile;
}

const PromotionPage: React.FC<PromotionPageProps> = ({ profile }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [sourceClassId, setSourceClassId] = useState('');
  const [destinationClassId, setDestinationClassId] = useState('');
  const [termName, setTermName] = useState('Term 3');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear());
  const [threshold, setThreshold] = useState(50);
  const [useAllTerms, setUseAllTerms] = useState(false);

  const [students, setStudents] = useState<StudentWithAverage[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name');
      setClasses(data || []);
    };
    fetchClasses();
  }, [profile.school_id]);

  useEffect(() => {
    // When the source class changes, reset the destination class selection.
    setDestinationClassId('');
  }, [sourceClassId]);
  
  const availableDestinationClasses = useMemo(() => {
      if (!sourceClassId) {
        return [];
      }
      const sourceClassIndex = classes.findIndex(c => c.id === sourceClassId);
      
      // If source class isn't found, just filter it out
      if (sourceClassIndex === -1) {
          return classes.filter(c => c.id !== sourceClassId);
      }
      
      // Only show classes that are "higher" in the sorted list
      return classes.filter((c, index) => index > sourceClassIndex);
  }, [classes, sourceClassId]);

  const handlePreview = async () => {
    if (!sourceClassId || !academicYear || (!useAllTerms && !termName)) {
      setMessage({ type: 'error', text: 'Please select a source class, term, and year.' });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);

    try {
        // 1. Get students in the source class
        const { data: classStudents, error: studentError } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', sourceClassId)
            .eq('school_id', profile.school_id)
            .order('full_name');
        if (studentError) throw studentError;
        
        // 2. Get all assessments for those students for the selected term(s)
        if (classStudents.length === 0) {
            setStudents([]);
            setIsLoading(false);
            return;
        }

        let query = supabase
            .from('student_assessments')
            .select('student_id, total_score')
            .eq('class_id', sourceClassId)
            .eq('year', academicYear)
            .eq('school_id', profile.school_id);

        if (useAllTerms) {
            query = query.in('term', ['Term 1', 'Term 2', 'Term 3']);
        } else {
            query = query.eq('term', termName);
        }

        const { data: assessments, error: assessmentError } = await query;
        if (assessmentError) throw assessmentError;
        
        // 3. Calculate averages
        const studentsWithAverages = classStudents.map(student => {
            const studentAssessments = (assessments || []).filter(a => a.student_id === student.id);
            const totalScore = studentAssessments.reduce((sum, a) => sum + (a.total_score || 0), 0);
            const average = studentAssessments.length > 0 ? totalScore / studentAssessments.length : 0;
            // Note: This average is based on subjects with scores.
            
            const eligible = average >= threshold;
            return { ...student, average, eligible };
        });

        setStudents(studentsWithAverages);
        setSelectedStudentIds(new Set(studentsWithAverages.filter(s => s.eligible).map(s => s.id!)));

    } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Failed to fetch student data.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handlePromote = async () => {
    if (selectedStudentIds.size === 0 || !destinationClassId) {
        setMessage({type: 'error', text: "Please select students and a destination class."});
        setIsModalOpen(false);
        return;
    }
    setIsPromoting(true);
    setMessage(null);
    
    const { error } = await supabase
        .from('students')
        .update({ class_id: destinationClassId })
        .in('id', Array.from(selectedStudentIds));

    if (error) {
        setMessage({ type: 'error', text: `Promotion failed: ${error.message}` });
    } else {
        setMessage({ type: 'success', text: `${selectedStudentIds.size} student(s) promoted successfully!` });
        // Reset state after promotion
        setStudents([]);
        setSelectedStudentIds(new Set());
    }
    setIsPromoting(false);
    setIsModalOpen(false);
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Student Promotion</h1>

      {message && (
        <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <label className="block text-sm font-medium">From Class</label>
                <select value={sourceClassId} onChange={e => setSourceClassId(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="">-- Select --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium">To Class</label>
                <select value={destinationClassId} onChange={e => setDestinationClassId(e.target.value)} disabled={availableDestinationClasses.length === 0} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-800">
                    <option value="">-- Select --</option>
                    {availableDestinationClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium">Based on Term</label>
                <select value={termName} onChange={e => setTermName(e.target.value)} disabled={useAllTerms} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-800">
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium">Academic Year</label>
                <input type="number" value={academicYear} onChange={e => setAcademicYear(parseInt(e.target.value, 10))} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="useAllTerms" checked={useAllTerms} onChange={(e) => setUseAllTerms(e.target.checked)} className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"/>
            <label htmlFor="useAllTerms" className="text-sm font-medium">Use average of all 3 terms</label>
          </div>
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium">Promotion Threshold (%)</label>
            <input type="number" value={threshold} onChange={e => setThreshold(parseInt(e.target.value, 10))} className="w-24 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
          </div>
        </div>
        <div className="flex justify-end">
            <button onClick={handlePreview} disabled={isLoading} className="px-6 py-2 bg-brand-600 text-white font-medium rounded-md hover:bg-brand-700 disabled:opacity-50">
                {isLoading ? 'Loading...' : 'Preview Students'}
            </button>
        </div>
      </div>
      
      {students.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Promotion Preview</h2>
                <button onClick={() => setIsModalOpen(true)} disabled={selectedStudentIds.size === 0 || !destinationClassId} className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400">
                    Promote {selectedStudentIds.size} Student(s)
                </button>
            </div>
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                 <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="p-4"><input type="checkbox" className="h-4 w-4" checked={selectedStudentIds.size === students.length} onChange={() => setSelectedStudentIds(prev => prev.size === students.length ? new Set() : new Set(students.map(s => s.id!)))} /></th>
                            <th className="px-6 py-3">Student Name</th>
                            <th className="px-6 py-3">Average Score</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="p-4"><input type="checkbox" className="h-4 w-4" checked={selectedStudentIds.has(s.id!)} onChange={() => handleToggleStudent(s.id!)} /></td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{s.full_name}</td>
                                <td className="px-6 py-4">{s.average?.toFixed(2) ?? 'N/A'}</td>
                                <td className={`px-6 py-4 font-semibold ${s.eligible ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {s.eligible ? 'Eligible for Promotion' : 'Not Eligible'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
            </div>
          </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsModalOpen(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                  <h2 className="text-2xl font-bold mb-4">Confirm Promotion</h2>
                  <p>You are about to promote <strong>{selectedStudentIds.size}</strong> student(s) from <strong>{classes.find(c=>c.id === sourceClassId)?.name}</strong> to <strong>{classes.find(c=>c.id === destinationClassId)?.name}</strong>.</p>
                  <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">This action will change their class assignment and cannot be easily undone.</p>
                  <div className="flex justify-end gap-4 mt-8">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">Cancel</button>
                      <button onClick={handlePromote} disabled={isPromoting} className="px-4 py-2 bg-brand-600 text-white rounded-md disabled:opacity-50">
                          {isPromoting ? 'Promoting...' : 'Confirm & Promote'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PromotionPage;