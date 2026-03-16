
import React, { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Class, Profile, Teacher } from '../../types.ts';

interface ManageClassesProps {
    profile: Profile;
}

const ManageClasses: React.FC<ManageClassesProps> = ({ profile }) => {
    const [classes, setClasses] = useState<Class[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [newClassName, setNewClassName] = useState('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch classes with their homeroom teacher
            const { data: classesData, error: classesError } = await supabase
                .from('classes')
                .select(`
                    *,
                    teacher_classes(
                        is_homeroom,
                        teacher:teachers(id, full_name)
                    )
                `)
                .eq('school_id', profile.school_id)
                .order('name', { ascending: true });

            if (classesError) throw classesError;

            // Fetch all teachers for the dropdown
            const { data: teachersData, error: teachersError } = await supabase
                .from('teachers')
                .select('id, full_name')
                .eq('school_id', profile.school_id)
                .order('full_name', { ascending: true });

            if (teachersError) throw teachersError;

            // Transform classes to include form_teacher info
            const transformedClasses = (classesData || []).map(cls => {
                const homeroomLink = cls.teacher_classes?.find((tc: any) => tc.is_homeroom);
                return {
                    ...cls,
                    form_teacher: homeroomLink?.teacher || null
                };
            });

            setClasses(transformedClasses);
            setTeachers(teachersData || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        const trimmedName = newClassName.trim();

        if (!trimmedName) {
            setError('Class name cannot be empty.');
            return;
        }

        try {
            let classId = editingClass?.id;

            if (editingClass) {
                // Update existing class name
                const { error: updateError } = await supabase
                    .from('classes')
                    .update({ name: trimmedName })
                    .eq('id', editingClass.id);

                if (updateError) {
                    if (updateError.code === '23505') {
                        throw new Error(`A class named "${trimmedName}" already exists in your school.`);
                    }
                    throw updateError;
                }
            } else {
                // Check if class with this name already exists in this school
                const { data: existingClassInDb } = await supabase
                    .from('classes')
                    .select('id')
                    .eq('school_id', profile.school_id)
                    .eq('name', trimmedName)
                    .maybeSingle();

                if (existingClassInDb) {
                    setError(`A class named "${trimmedName}" already exists. Please find it in the list below and click "Edit" to assign a teacher.`);
                    return;
                }

                // Add new class
                const { data: newData, error: insertError } = await supabase
                    .from('classes')
                    .insert({ 
                        name: trimmedName,
                        school_id: profile.school_id
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    if (insertError.code === '23505') {
                        throw new Error(`A class named "${trimmedName}" already exists in your school.`);
                    }
                    throw insertError;
                }
                classId = newData.id;
            }

            // Handle teacher assignment
            if (classId) {
                // 1. Remove existing homeroom assignment for this class
                // We delete any existing homeroom for this class to ensure only one teacher is the homeroom teacher
                await supabase
                    .from('teacher_classes')
                    .delete()
                    .eq('class_id', classId)
                    .eq('is_homeroom', true);

                // 2. If a teacher is selected, add the new assignment
                if (selectedTeacherId) {
                    // Check if this teacher already has this class assigned (maybe as non-homeroom)
                    const { data: existing } = await supabase
                        .from('teacher_classes')
                        .select('*')
                        .eq('teacher_id', selectedTeacherId)
                        .eq('class_id', classId)
                        .maybeSingle();

                    if (existing) {
                        // Update existing assignment to be homeroom
                        await supabase
                            .from('teacher_classes')
                            .update({ is_homeroom: true })
                            .eq('teacher_id', selectedTeacherId)
                            .eq('class_id', classId);
                    } else {
                        // Insert new assignment
                        await supabase
                            .from('teacher_classes')
                            .insert({
                                teacher_id: selectedTeacherId,
                                class_id: classId,
                                is_homeroom: true,
                                school_id: profile.school_id
                            });
                    }
                }
            }

            await fetchData();
            setEditingClass(null);
            setNewClassName('');
            setSelectedTeacherId('');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async (classToDelete: Class) => {
        if (window.confirm(`Are you sure you want to delete ${classToDelete.name}?`)) {
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', classToDelete.id);
            
            if (error) {
                setError(error.message);
            } else {
                setClasses(prev => prev.filter(c => c.id !== classToDelete.id));
            }
        }
    };

    const startEditing = (cls: Class) => {
        setEditingClass(cls);
        setNewClassName(cls.name);
        setSelectedTeacherId(cls.form_teacher?.id || '');
        setError(null);
    };

    const cancelEditing = () => {
        setEditingClass(null);
        setNewClassName('');
        setSelectedTeacherId('');
        setError(null);
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Manage Classes</h1>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg mb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="new-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {editingClass ? `Editing: ${editingClass.name}` : 'Class Name'}
                            </label>
                            <input
                                id="new-class"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="e.g., Grade 1, JHS 2"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="teacher-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Form Teacher (Optional)
                            </label>
                            <select
                                id="teacher-select"
                                value={selectedTeacherId}
                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-brand-500 focus:border-brand-500"
                            >
                                <option value="">No Teacher Assigned</option>
                                {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                         {editingClass && (
                            <button type="button" onClick={cancelEditing} className="px-6 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                                Cancel
                            </button>
                        )}
                        <button type="submit" className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500">
                            {editingClass ? 'Save Changes' : 'Add Class'}
                        </button>
                    </div>
                </form>
                {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Existing Classes</h2>
                {isLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">Loading classes...</p>
                ) : classes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classes.map(cls => (
                            <div key={cls.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cls.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Form Teacher: <span className="font-medium text-brand-600 dark:text-brand-400">{cls.form_teacher?.full_name || 'Not assigned'}</span>
                                    </p>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                    <button
                                        onClick={() => startEditing(cls)}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        title="Edit Class"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cls)}
                                        className="p-2 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                        title="Delete Class"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">No classes have been added yet.</p>
                )}
            </div>
        </div>
    );
}

export default ManageClasses;
