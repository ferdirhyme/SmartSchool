import React, { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Subject, Profile, TeacherProfile } from '../../types.ts';
import { Users, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const predefinedSubjects = [
  "Literacy / Language & Literacy",
  "Numeracy",
  "Physical Development / Psychomotor Skills",
  "Citizenship Education",
  "Our World Our People",
  "History",
  "English Language",
  "Ghanaian Language",
  "French",
  "Mathematics",
  "Integrated Science",
  "Social Studies",
  "Religious & Moral Education (RME)",
  "Creative Arts & Design",
  "Computing / ICT",
  "Career Technology",
  "Physical Education"
];

interface ManageSubjectsProps {
    profile: Profile;
}

const ManageSubjects: React.FC<ManageSubjectsProps> = ({ profile }) => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [newSubject, setNewSubject] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState<string | null>(null); // subjectId
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const [subjectRes, teacherRes] = await Promise.all([
            supabase
                .from('subjects')
                .select('*')
                .eq('school_id', profile.school_id)
                .order('name', { ascending: true }),
            supabase
                .from('teachers')
                .select(`
                    *,
                    subjects:teacher_subjects(subject_id)
                `)
                .eq('school_id', profile.school_id)
                .order('full_name')
        ]);

        if (subjectRes.error) {
            setError(subjectRes.error.message);
        } else {
            setSubjects(subjectRes.data || []);
        }

        if (teacherRes.error) {
            console.error(teacherRes.error);
        } else {
            const transformed = (teacherRes.data || []).map(t => ({
                ...t,
                assigned_subject_ids: (t.subjects || []).map((s: any) => s.subject_id)
            }));
            setTeachers(transformed as any);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggleTeacherAssignment = async (teacherId: string, subjectId: string, isAssigned: boolean) => {
        if (isAssigned) {
            // Remove assignment
            const { error } = await supabase
                .from('teacher_subjects')
                .delete()
                .eq('teacher_id', teacherId)
                .eq('subject_id', subjectId);
            
            if (error) setError(error.message);
        } else {
            // Add assignment
            const { error } = await supabase
                .from('teacher_subjects')
                .insert({
                    teacher_id: teacherId,
                    subject_id: subjectId,
                    school_id: profile.school_id
                });
            
            if (error) setError(error.message);
        }
        fetchData();
    };

    const handleAddSubject = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!newSubject.trim()) {
            setError('Subject name cannot be empty.');
            return;
        }
        if (subjects.some(s => s.name.toLowerCase() === newSubject.trim().toLowerCase())) {
            setError('This subject already exists.');
            return;
        }

        const { data, error } = await supabase
            .from('subjects')
            .insert({ 
                name: newSubject.trim(),
                school_id: profile.school_id
            })
            .select();

        if (error) {
            setError(error.message);
        } else if (data) {
            setSubjects(prev => [...prev, ...data].sort((a, b) => a.name.localeCompare(b.name)));
            setNewSubject('');
        }
    };

    const handleDeleteSubject = async (id: string) => {
        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);
        
        if (error) {
            setError(error.message);
        } else {
            setSubjects(prev => prev.filter(s => s.id !== id));
        }
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Manage Subjects</h1>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg mb-8">
                <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="w-full">
                        <label htmlFor="new-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add New Subject</label>
                        <input
                            id="new-subject"
                            list="subject-suggestions"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="e.g., Mathematics or Ghanaian Language (Twi)"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                        />
                        <datalist id="subject-suggestions">
                            {predefinedSubjects.map(sub => <option key={sub} value={sub} />)}
                        </datalist>
                    </div>
                    <button type="submit" className="w-full sm:w-auto px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500">
                        Add Subject
                    </button>
                </form>
                {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Existing Subjects</h2>
                {isLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">Loading subjects...</p>
                ) : subjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {subjects.map(subject => {
                            const assignedTeachers = teachers.filter(t => (t as any).assigned_subject_ids?.includes(subject.id));
                            return (
                                <div key={subject.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-gray-900 dark:text-white">{subject.name}</h3>
                                        <button
                                            onClick={() => handleDeleteSubject(subject.id)}
                                            className="p-1.5 rounded-full text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            aria-label={`Delete ${subject.name}`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Teachers</span>
                                            <button 
                                                onClick={() => setIsAssigning(isAssigning === subject.id ? null : subject.id)}
                                                className="text-xs font-semibold text-brand-600 hover:text-brand-500 flex items-center gap-1"
                                            >
                                                <UserPlus className="w-3 h-3" />
                                                {isAssigning === subject.id ? 'Close' : 'Manage'}
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {assignedTeachers.length > 0 ? (
                                                assignedTeachers.map(t => (
                                                    <span key={t.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-md text-[10px] font-bold">
                                                        <Users className="w-3 h-3" />
                                                        {t.full_name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">No teachers assigned</span>
                                            )}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isAssigning === subject.id && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Select Teachers to Assign</p>
                                                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                        {teachers.map(t => {
                                                            const isAssigned = (t as any).assigned_subject_ids?.includes(subject.id);
                                                            return (
                                                                <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isAssigned}
                                                                        onChange={() => handleToggleTeacherAssignment(t.id, subject.id, isAssigned)}
                                                                        className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                                                    />
                                                                    <span className="text-xs text-gray-700 dark:text-gray-300">{t.full_name}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No subjects have been added yet.</p>
                )}
            </div>
        </div>
    );
}

export default ManageSubjects;