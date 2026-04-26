import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { TeacherProfile, Class, Subject, TeachableClassLink, Profile } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';
import { Users, BookOpen, Award, Search, UserCheck, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationDialog from '../ui/ConfirmationDialog.tsx';

interface TeacherInfoProps {
    profile: Profile;
}

const TeacherInfo: React.FC<TeacherInfoProps> = ({ profile }) => {
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
    const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [allClasses, setAllClasses] = useState<Class[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRank, setSelectedRank] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assigningTeacher, setAssigningTeacher] = useState<TeacherProfile | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select(`
                *,
                subjects:teacher_subjects(subject:subjects(*)),
                teachable_classes:teacher_classes(is_homeroom, class:classes(*))
            `)
            .eq('school_id', profile.school_id)
            .order('full_name');
        
        if (teacherError) {
            setError(teacherError.message);
        } else {
            const transformedTeachers = (teacherData || []).map(teacher => {
                const subjects = (teacher.subjects || []).map((ts: any) => ts.subject).filter(Boolean);
                const teachable_classes: TeachableClassLink[] = (teacher.teachable_classes || [])
                    .map((tc: any) => ({
                        class: tc.class,
                        is_homeroom: tc.is_homeroom,
                    }))
                    .filter((tc: any) => tc.class);

                const { subjects: _, teachable_classes: __, ...rest } = teacher;
                return { ...rest, subjects, teachable_classes };
            });
            setTeachers(transformedTeachers as TeacherProfile[]);
        }

        const { data: classData } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name');
        setAllClasses(classData || []);
        const { data: subjectData } = await supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name');
        setAllSubjects(subjectData || []);

        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);
    
    const getHomeroomClass = (teacher: TeacherProfile) => {
        return teacher.teachable_classes.find(tc => tc.is_homeroom)?.class;
    };

    const stats = useMemo(() => {
        const total = teachers.length;
        const homeroomCount = teachers.filter(t => t.teachable_classes.some(tc => tc.is_homeroom)).length;
        const ranks = Array.from(new Set(teachers.map(t => t.rank))).filter(Boolean);
        const rankBreakdown = ranks.map(rank => ({
            name: rank,
            count: teachers.filter(t => t.rank === rank).length
        }));
        
        const totalSubjectsAssigned = teachers.reduce((acc, t) => acc + t.subjects.length, 0);
        const avgSubjects = total > 0 ? (totalSubjectsAssigned / total).toFixed(1) : 0;

        return { total, homeroomCount, rankBreakdown, avgSubjects, ranks };
    }, [teachers]);

    const filteredTeachers = useMemo(() => {
        return teachers.filter(teacher => {
            const matchesSearch = teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                teacher.staff_id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRank = selectedRank === 'all' || teacher.rank === selectedRank;
            return matchesSearch && matchesRank;
        });
    }, [teachers, searchTerm, selectedRank]);

    const handleEdit = (teacher: TeacherProfile) => {
        setEditingTeacher({ ...teacher });
        setMessage(null);
        setError(null);
    };
    
    const handleCancelEdit = () => {
        setEditingTeacher(null);
        setImageFile(null);
    };

    const handleUpdate = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingTeacher) return;
        
        setIsUpdating(true);
        setMessage(null);
        setError(null);
        
        let imageUrl = editingTeacher.image_url;

        // 1. Handle image upload if a new file is selected
        if (imageFile) {
            const filePath = `teachers/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, imageFile);
            if (uploadError) {
                setError(`Image upload failed: ${uploadError.message}`);
                setIsUpdating(false);
                return;
            }
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }

        // 2. Prepare update payload for the teachers table
        const { id, subjects, teachable_classes, ...teacherData } = editingTeacher;
        const updatePayload = { ...teacherData, image_url: imageUrl };

        const { error: updateError } = await supabase.from('teachers').update(updatePayload).eq('id', id);

        if (updateError) {
            setError(`Failed to update teacher info: ${updateError.message}`);
            setIsUpdating(false);
            return;
        }

        // 3. Update subjects (delete all then re-insert)
        await supabase.from('teacher_subjects').delete().eq('teacher_id', id);
        if (subjects.length > 0) {
            const newSubjectLinks = subjects.map(s => ({ teacher_id: id, subject_id: s.id, school_id: profile.school_id }));
            const { error: subjectError } = await supabase.from('teacher_subjects').upsert(newSubjectLinks, { onConflict: 'teacher_id,subject_id' });
            if (subjectError) setError(`Failed to update subjects: ${subjectError.message}`);
        }
        
        // 4. Update classes (delete all then re-insert)
        await supabase.from('teacher_classes').delete().eq('teacher_id', id);
        if (teachable_classes && teachable_classes.length > 0) {
            const newClassLinks = teachable_classes.map(tc => ({ teacher_id: id, class_id: tc.class.id, is_homeroom: tc.is_homeroom, school_id: profile.school_id }));
            const { error: classError } = await supabase.from('teacher_classes').upsert(newClassLinks, { onConflict: 'teacher_id,class_id' });
             if (classError) setError(`Failed to update classes: ${classError.message}`);
        }
        
        // 5. Refetch all data to reflect changes
        await fetchData();

        const { data: updatedTeacher } = await supabase.from('teachers').select(`*, subjects:teacher_subjects(subject:subjects(*)), teachable_classes:teacher_classes(is_homeroom, class:classes(*))`).eq('id', id).single();
        if(updatedTeacher) {
            const transformed = {
                ...updatedTeacher,
                subjects: (updatedTeacher.subjects || []).map((ts: any) => ts.subject).filter(Boolean),
                teachable_classes: (updatedTeacher.teachable_classes || []).map((tc: any) => ({ class: tc.class, is_homeroom: tc.is_homeroom })).filter((tc: any) => tc.class)
            }
            setSelectedTeacher(transformed as TeacherProfile);
        }
        
        setEditingTeacher(null);
        setImageFile(null);
        setMessage('Teacher information updated successfully.');
        setIsUpdating(false);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingTeacher) return;
        const { name, value } = e.target;
        setEditingTeacher(prev => ({ ...prev!, [name]: value }));
    };
    
    const handleSubjectChange = (subject: Subject) => {
        if (!editingTeacher) return;
        setEditingTeacher(prev => {
            const isSelected = prev!.subjects.some(s => s.id === subject.id);
            if (isSelected) {
                return { ...prev!, subjects: prev!.subjects.filter(s => s.id !== subject.id) };
            } else {
                return { ...prev!, subjects: [...prev!.subjects, subject] };
            }
        });
    };

    const handleTeachableClassChange = (classId: string) => {
        const target = editingTeacher || assigningTeacher;
        if (!target) return;
        
        const existingLinks = target.teachable_classes;
        const isSelected = existingLinks.some(link => link.class.id === classId);
        let newLinks: TeachableClassLink[];

        if (isSelected) {
            newLinks = existingLinks.filter(link => link.class.id !== classId);
        } else {
            const newClass = allClasses.find(c => c.id === classId);
            if (!newClass) return;
            newLinks = [...existingLinks, { class: newClass, is_homeroom: false }];
        }

        if (editingTeacher) {
            setEditingTeacher({ ...editingTeacher, teachable_classes: newLinks });
        } else {
            setAssigningTeacher({ ...assigningTeacher!, teachable_classes: newLinks });
        }
    };

    const handleHomeroomChange = (classId: string) => {
        const target = editingTeacher || assigningTeacher;
        if (!target) return;

        const newLinks = target.teachable_classes.map(link => ({
            ...link,
            is_homeroom: link.class.id === classId
        }));

        if (editingTeacher) {
            setEditingTeacher({ ...editingTeacher, teachable_classes: newLinks });
        } else {
            setAssigningTeacher({ ...assigningTeacher!, teachable_classes: newLinks });
        }
    };

    const handleQuickAssignSave = async () => {
        if (!assigningTeacher) return;
        setIsUpdating(true);
        setError(null);
        
        const id = assigningTeacher.id;
        
        try {
            // Update subjects
            await supabase.from('teacher_subjects').delete().eq('teacher_id', id);
            if (assigningTeacher.subjects.length > 0) {
                const newSubjectLinks = assigningTeacher.subjects.map(s => ({ 
                    teacher_id: id, 
                    subject_id: s.id,
                    school_id: profile.school_id
                }));
                await supabase.from('teacher_subjects').insert(newSubjectLinks);
            }
            
            // Update classes
            await supabase.from('teacher_classes').delete().eq('teacher_id', id);
            if (assigningTeacher.teachable_classes.length > 0) {
                const newClassLinks = assigningTeacher.teachable_classes.map(tc => ({ 
                    teacher_id: id, 
                    class_id: tc.class.id,
                    is_homeroom: tc.is_homeroom,
                    school_id: profile.school_id
                }));
                await supabase.from('teacher_classes').insert(newClassLinks);
            }
            
            await fetchData();
            setIsAssignModalOpen(false);
            setAssigningTeacher(null);
            setMessage('Assignments updated successfully.');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleDelete = async (teacherToDelete: TeacherProfile) => {
        setConfirmation({
            title: `Delete ${teacherToDelete.full_name}?`,
            message: `Are you sure you want to remove this teacher from the school? All their teaching records will be affected.`,
            onConfirm: async () => {
                setIsLoading(true);
                const { error: deleteError } = await supabase.from('teachers').delete().eq('id', teacherToDelete.id);
                if (deleteError) {
                    setError(`Failed to delete teacher: ${deleteError.message}`);
                } else {
                    setMessage(`${teacherToDelete.full_name} has been deleted successfully.`);
                    setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
                    if (selectedTeacher?.id === teacherToDelete.id) {
                        setSelectedTeacher(null);
                    }
                }
                setIsLoading(false);
            }
        });
    };

    if (isLoading && !teachers.length) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="flex justify-between items-center">
                    <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 h-32"></div>
                    ))}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 h-40"></div>

                <div className="flex gap-4">
                    <div className="flex-1 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                    <div className="w-48 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="h-12 bg-gray-50 dark:bg-gray-700"></div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 border-t border-gray-100 dark:border-gray-700"></div>
                    ))}
                </div>
            </div>
        );
    }
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

    if (selectedTeacher) {
        const teacherToDisplay = editingTeacher || selectedTeacher;
        const homeroomClass = getHomeroomClass(teacherToDisplay);
        return (
            <div>
                 <button onClick={() => { setSelectedTeacher(null); setEditingTeacher(null); setMessage(null); setError(null); }} className="flex items-center text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Back to Staff List
                </button>

                {message && <div className="p-4 rounded-md mb-6 bg-green-100 text-green-800">{message}</div>}
                {error && <div className="p-4 rounded-md mb-6 bg-red-100 text-red-800">{error}</div>}

                <form onSubmit={handleUpdate}>
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {editingTeacher ? `Editing: ${teacherToDisplay.full_name}` : teacherToDisplay.full_name}
                        </h1>
                        {!editingTeacher && (
                            <button type="button" onClick={() => handleEdit(selectedTeacher)} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">
                                Edit Teacher
                            </button>
                        )}
                    </div>
                    
                     <div className="space-y-8">
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2 space-y-6">
                                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Personal Details</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff ID</label>
                                            <input type="text" value={teacherToDisplay.staff_id} readOnly className={`${inputClasses} bg-gray-200 dark:bg-gray-800 cursor-not-allowed`} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                            <input type="text" name="full_name" value={teacherToDisplay.full_name} onChange={handleFormChange} readOnly={!editingTeacher} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                                            <input type="email" name="email" value={teacherToDisplay.email} onChange={handleFormChange} readOnly={!editingTeacher} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                                            <input type="date" name="date_of_birth" value={teacherToDisplay.date_of_birth} onChange={handleFormChange} readOnly={!editingTeacher} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank</label>
                                            <input type="text" name="rank" value={teacherToDisplay.rank} onChange={handleFormChange} readOnly={!editingTeacher} className={inputClasses} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                                            <input type="tel" name="phone_number" value={teacherToDisplay.phone_number} onChange={handleFormChange} readOnly={!editingTeacher} className={inputClasses} />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher's Photo</label>
                                    {editingTeacher ? (
                                        <ImageUpload onFileChange={setImageFile} defaultImageUrl={teacherToDisplay.image_url} />
                                    ) : (
                                        <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                            {teacherToDisplay.image_url ? (
                                                <img src={teacherToDisplay.image_url} alt={teacherToDisplay.full_name} className="w-full h-full object-cover"/>
                                            ) : (
                                                <span className="text-gray-500">No Image</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                           <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Class Assignments</h2>
                           {editingTeacher ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {allClasses.map(cls => {
                                        const isSelected = teacherToDisplay.teachable_classes.some(tc => tc.class.id === cls.id);
                                        const isHomeroom = isSelected && teacherToDisplay.teachable_classes.find(tc => tc.class.id === cls.id)?.is_homeroom;
                                        return (
                                            <div key={cls.id} className="flex items-center space-x-2">
                                                <input type="checkbox" id={`edit-class-check-${cls.id}`} checked={isSelected} onChange={() => handleTeachableClassChange(cls.id)} className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
                                                <label htmlFor={`edit-class-check-${cls.id}`} className="flex-grow text-sm">{cls.name}</label>
                                                <input type="radio" id={`edit-homeroom-${cls.id}`} name="homeroom-class" checked={!!isHomeroom} onChange={() => handleHomeroomChange(cls.id)} disabled={!isSelected} className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500 disabled:opacity-50" />
                                            </div>
                                        )
                                    })}
                                </div>
                           ) : (
                                <div>
                                    <p><strong className="font-medium">Homeroom Class:</strong> {homeroomClass?.name || 'N/A'}</p>
                                    <p className="mt-2"><strong className="font-medium">Other Teachable Classes:</strong></p>
                                    {(teacherToDisplay.teachable_classes?.length ?? 0) > 0 ? (
                                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                                            {teacherToDisplay.teachable_classes?.filter(tc => !tc.is_homeroom).map(tc => <li key={tc.class.id}>{tc.class.name}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400">No other classes assigned.</p>
                                    )}
                                </div>
                           )}
                        </div>

                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                           <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Assigned Subjects</h2>
                            {editingTeacher ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {allSubjects.map(subject => (
                                        <label key={subject.id} className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={teacherToDisplay.subjects.some(s => s.id === subject.id)}
                                            onChange={() => handleSubjectChange(subject)}
                                            className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{subject.name}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    {teacherToDisplay.subjects.length > 0 ? (
                                        <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                                            {teacherToDisplay.subjects.map(s => <li key={s.id}>{s.name}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 dark:text-gray-400">No subjects assigned.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {editingTeacher && (
                        <div className="flex justify-end gap-4 mt-8">
                            <button type="button" onClick={handleCancelEdit} className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:hover:bg-gray-700 dark:border-gray-500">Cancel</button>
                            <button type="submit" disabled={isUpdating} className="px-6 py-3 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50">
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff List</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
                    <UserCheck className="w-4 h-4 text-brand-500" />
                    <span className="font-medium">{stats.total} Active Staff</span>
                </div>
            </div>

            {message && <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-100 dark:border-green-800">{message}</div>}
            {error && !message && <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-100 dark:border-red-800">{error}</div>}
            
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl">
                            <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Faculty</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</h3>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {stats.homeroomCount} Homeroom Teachers
                    </p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                            <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Academic Load</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgSubjects}</h3>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Average subjects per teacher
                    </p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                            <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ranks</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.ranks.length}</h3>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Distinct professional ranks
                    </p>
                </motion.div>
            </div>

            {/* Rank Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Staff Rank Distribution</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {stats.rankBreakdown.map((rank) => (
                        <div 
                            key={rank.name} 
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                selectedRank === rank.name 
                                ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' 
                                : 'bg-gray-50 border-gray-100 dark:bg-gray-700/30 dark:border-gray-600 hover:border-brand-200'
                            }`}
                            onClick={() => setSelectedRank(selectedRank === rank.name ? 'all' : rank.name)}
                        >
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 truncate">{rank.name}</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{rank.count}</p>
                            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 h-1 rounded-full overflow-hidden">
                                <div 
                                    className="bg-brand-500 h-full" 
                                    style={{ width: `${stats.total > 0 ? (rank.count / stats.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or staff ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                </div>
                <select
                    value={selectedRank}
                    onChange={e => setSelectedRank(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                >
                    <option value="all">All Ranks</option>
                    {stats.ranks.map(rank => (
                        <option key={rank} value={rank}>{rank}</option>
                    ))}
                </select>
            </div>

            <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-4">Full Name</th>
                            <th scope="col" className="px-6 py-4">Staff ID</th>
                            <th scope="col" className="px-6 py-4">Rank</th>
                            <th scope="col" className="px-6 py-4">Homeroom Class</th>
                            <th scope="col" className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredTeachers.map(teacher => {
                            const homeroom = getHomeroomClass(teacher);
                            return (
                                <tr key={teacher.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-600">
                                                {teacher.image_url ? (
                                                    <img src={teacher.image_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <Users className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>
                                            <span>{teacher.full_name}</span>
                                        </div>
                                    </th>
                                    <td className="px-6 py-4 font-mono text-xs">{teacher.staff_id}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded text-xs font-medium">
                                            {teacher.rank}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {homeroom ? (
                                            <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs font-medium">
                                                {homeroom.name}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic text-xs">None</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap space-x-3">
                                        <button 
                                            onClick={() => { setAssigningTeacher({...teacher}); setIsAssignModalOpen(true); }} 
                                            className="inline-flex items-center px-3 py-1.5 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors text-xs font-semibold"
                                        >
                                            Assign Subjects
                                        </button>
                                        <button 
                                            onClick={() => setSelectedTeacher(teacher)} 
                                            className="inline-flex items-center px-3 py-1.5 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors text-xs font-semibold"
                                        >
                                            View Profile
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(teacher)} 
                                            className="inline-flex items-center px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs font-semibold"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {filteredTeachers.length === 0 && !isLoading && (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No teachers found matching your criteria.</p>
                    </div>
                )}
            </div>

            {/* Quick Assign Modal */}
            {isAssignModalOpen && assigningTeacher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Assignments</h2>
                                <p className="text-sm text-gray-500">{assigningTeacher.full_name}</p>
                            </div>
                            <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

                            <section>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Class Assignments</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {allClasses.map(cls => {
                                        const isSelected = assigningTeacher.teachable_classes.some(tc => tc.class.id === cls.id);
                                        const isHomeroom = isSelected && assigningTeacher.teachable_classes.find(tc => tc.class.id === cls.id)?.is_homeroom;
                                        return (
                                            <div key={cls.id} className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${isSelected ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/30 dark:border-gray-600'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    id={`modal-class-${cls.id}`} 
                                                    checked={isSelected} 
                                                    onChange={() => handleTeachableClassChange(cls.id)} 
                                                    className="h-5 w-5 text-brand-600 border-gray-300 rounded focus:ring-brand-500" 
                                                />
                                                <label htmlFor={`modal-class-${cls.id}`} className="flex-grow text-sm font-medium text-gray-700 dark:text-gray-300">{cls.name}</label>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400">Homeroom</span>
                                                    <input 
                                                        type="radio" 
                                                        name="modal-homeroom" 
                                                        checked={!!isHomeroom} 
                                                        onChange={() => handleHomeroomChange(cls.id)} 
                                                        disabled={!isSelected} 
                                                        className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500 disabled:opacity-30" 
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Subject Assignments</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {allSubjects.map(subject => {
                                        const isSelected = assigningTeacher.subjects.some(s => s.id === subject.id);
                                        return (
                                            <label 
                                                key={subject.id} 
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/30 dark:border-gray-600'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        const newSubjects = isSelected 
                                                            ? assigningTeacher.subjects.filter(s => s.id !== subject.id)
                                                            : [...assigningTeacher.subjects, subject];
                                                        setAssigningTeacher({...assigningTeacher, subjects: newSubjects});
                                                    }}
                                                    className="h-5 w-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{subject.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
                            <button 
                                onClick={() => setIsAssignModalOpen(false)} 
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleQuickAssignSave} 
                                disabled={isUpdating}
                                className="px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 shadow-lg shadow-brand-500/20 transition-all"
                            >
                                {isUpdating ? 'Saving...' : 'Save Assignments'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            <ConfirmationDialog 
                isOpen={!!confirmation}
                onClose={() => setConfirmation(null)}
                onConfirm={confirmation?.onConfirm || (() => {})}
                title={confirmation?.title || ''}
                message={confirmation?.message || ''}
            />
        </div>
        </>
    );
};

export default TeacherInfo;