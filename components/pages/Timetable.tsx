
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Class, Subject, TimetableEntry, TimeSlot, Profile } from '../../types.ts';

// Helper to format time for display (e.g., 08:00 -> 8:00 AM)
const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 === 0 ? 12 : h % 12;
    return `${formattedHour}:${minutes} ${ampm}`;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface TimetableProps {
    profile: Profile;
}

const Timetable: React.FC<TimetableProps> = ({ profile }) => {
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [currentSlot, setCurrentSlot] = useState<{ day: number, time_slot_id: string, time_label: string } | null>(null);
    const [formData, setFormData] = useState<{ subject_id: string, teacher_id: string }>({ subject_id: '', teacher_id: '' });

    const [isTimeManagerOpen, setIsTimeManagerOpen] = useState(false);
    const [newTimeSlot, setNewTimeSlot] = useState({ start_time: '', end_time: '', is_break: false });
    
    const [error, setError] = useState<string | null>(null);

    // This effect clears any existing error message as soon as the user
    // modifies the form, providing immediate feedback that they are correcting it.
    useEffect(() => {
        if (error) {
            setError(null);
        }
    }, [formData]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const [classRes, subjectRes, teacherRes, timeSlotRes] = await Promise.all([
            supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name'),
            supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name'),
            supabase.from('teachers').select('id, full_name').eq('school_id', profile.school_id).order('full_name'),
            supabase.from('time_slots').select('*').eq('school_id', profile.school_id).order('start_time')
        ]);
        setClasses(classRes.data || []);
        setSubjects(subjectRes.data || []);
        setTeachers(teacherRes.data || []);
        setTimeSlots(timeSlotRes.data || []);
        if (classRes.data?.[0] && !selectedClassId) {
            setSelectedClassId(classRes.data[0].id);
        }
        setIsLoading(false);
    }, [selectedClassId, profile.school_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchTimetable = useCallback(async () => {
        if (!selectedClassId) return;
        setIsLoading(true);
        
        // Use manual join for teachers to avoid schema relationship errors if FK is missing
        const { data, error } = await supabase
            .from('timetable')
            .select(`*, subject:subjects(id, name)`)
            .eq('class_id', selectedClassId)
            .eq('school_id', profile.school_id);
        
        if (error) {
            setError(error.message);
        } else {
            // Manually map teacher info from the pre-fetched teachers list
            const enrichedData = (data || []).map((entry: any) => {
                const foundTeacher = teachers.find(t => t.id === entry.teacher_id);
                return {
                    ...entry,
                    teacher: foundTeacher ? { id: foundTeacher.id, full_name: foundTeacher.full_name } : null
                };
            });
            setTimetable(enrichedData as TimetableEntry[]);
        }
        setIsLoading(false);
    }, [selectedClassId, teachers, profile.school_id]);

    useEffect(() => {
        if (selectedClassId) {
            fetchTimetable();
        }
    }, [selectedClassId, fetchTimetable]);
    
    const openAssignModal = (day: number, slot: TimeSlot) => {
        setError(null);
        const entry = timetable.find(e => e.day_of_week === day + 1 && e.time_slot_id === slot.id);
        setCurrentSlot({ day: day + 1, time_slot_id: slot.id, time_label: `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}` });
        setFormData({
            subject_id: entry?.subject?.id || '',
            teacher_id: entry?.teacher?.id || ''
        });
        setIsAssignModalOpen(true);
    };

    const handleAssignModalSubmit = async () => {
        if (!currentSlot || !selectedClassId) return;
        if (!profile.school_id) {
            setError("Your profile is not linked to a school. Please contact an administrator.");
            return;
        }
        setError(null);
        
        // Conflict detection: Check if the selected teacher is already booked at this time in another class.
        if (formData.teacher_id) {
            const { data: conflict, error: conflictError } = await supabase
                .from('timetable')
                .select('id, classes(name)')
                .eq('day_of_week', currentSlot.day)
                .eq('time_slot_id', currentSlot.time_slot_id)
                .eq('teacher_id', formData.teacher_id)
                .eq('school_id', profile.school_id)
                .neq('class_id', selectedClassId)
                .maybeSingle();

            if (conflictError) {
                setError(`Conflict check failed: ${conflictError.message}`);
                return;
            }
            
            if (conflict) {
                const className = (conflict.classes as any)?.name || 'another class';
                setError(`Teacher Conflict: This teacher is already assigned to ${className} during this time period.`);
                return;
            }
        }

        const { error } = await supabase.from('timetable').upsert({
            class_id: selectedClassId,
            day_of_week: currentSlot.day,
            time_slot_id: currentSlot.time_slot_id,
            subject_id: formData.subject_id || null,
            teacher_id: formData.teacher_id || null,
            school_id: profile.school_id
        }, { onConflict: 'class_id, day_of_week, time_slot_id' });
        
        if (error) {
            setError(error.message);
        } else {
            await fetchTimetable();
            setIsAssignModalOpen(false);
        }
    };

    const handleClearEntry = async () => {
        if (!currentSlot || !selectedClassId) return;
        const { error } = await supabase.from('timetable').delete()
            .eq('class_id', selectedClassId)
            .eq('day_of_week', currentSlot.day)
            .eq('time_slot_id', currentSlot.time_slot_id)
            .eq('school_id', profile.school_id);
        
        if (error) {
            setError(error.message);
        } else {
            await fetchTimetable();
            setIsAssignModalOpen(false);
        }
    }

    const handleAddTimeSlot = async (e: FormEvent) => {
        e.preventDefault();
        if (!profile.school_id) {
            setError("Your profile is not linked to a school. Please contact an administrator.");
            return;
        }
        const { error } = await supabase.from('time_slots').insert({
            ...newTimeSlot,
            school_id: profile.school_id
        });
        if (error) setError(error.message);
        else {
            setNewTimeSlot({ start_time: '', end_time: '', is_break: false });
            await fetchData();
        }
    };

    const handleDeleteTimeSlot = async (id: string) => {
        const { error } = await supabase.from('time_slots').delete()
            .eq('id', id)
            .eq('school_id', profile.school_id);
        if (error) setError(error.message);
        else await fetchData();
    };

    const getEntry = (day: number, time_slot_id: string) => {
        return timetable.find(e => e.day_of_week === day + 1 && e.time_slot_id === time_slot_id);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Class Timetable</h1>
                <button onClick={() => setIsTimeManagerOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700">Manage Time Periods</button>
            </div>

            <div className="mb-6 max-w-sm">
                <label htmlFor="class-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select a Class</label>
                <select id="class-select" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            
            {isLoading ? <p>Loading...</p> : error ? <p className="p-4 bg-red-100 text-red-700 rounded-md">{error}</p> : (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                    <table className="w-full text-sm text-center text-gray-500 dark:text-gray-400 table-fixed">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-2 py-3 w-40">Time</th>
                                {DAYS.map(day => <th key={day} scope="col" className="px-2 py-3">{day}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {timeSlots.map((slot) => (
                                <tr key={slot.id} className="border-b dark:border-gray-700">
                                    <th scope="row" className="px-2 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap bg-gray-50 dark:bg-gray-700">
                                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                    </th>
                                    {DAYS.map((_, dayIndex) => {
                                        if (slot.is_break) {
                                            return <td key={`${dayIndex}-${slot.id}`} className="px-2 py-4 bg-gray-100 dark:bg-gray-700/50 font-semibold align-middle text-xs break-words">BREAK</td>;
                                        }
                                        const entry = getEntry(dayIndex, slot.id);
                                        return (
                                            <td key={`${dayIndex}-${slot.id}`} className="px-2 py-2">
                                                <button onClick={() => openAssignModal(dayIndex, slot)} className="w-full h-24 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col justify-center items-center text-center p-1 transition-colors">
                                                    {entry?.subject ? (
                                                        <>
                                                            <strong className="text-gray-800 dark:text-gray-200 text-sm">{entry.subject.name}</strong>
                                                            <span className="text-xs mt-1">{entry.teacher?.full_name}</span>
                                                        </>
                                                    ) : <span className="text-gray-400 text-2xl">+</span>}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {isAssignModalOpen && currentSlot && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsAssignModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-1">Edit Slot</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{DAYS[currentSlot.day - 1]} - {currentSlot.time_label}</p>
                        {error && <p className="p-3 mb-4 bg-red-100 text-red-700 rounded-md text-sm">{error}</p>}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Subject</label>
                                <select value={formData.subject_id} onChange={e => setFormData(f => ({...f, subject_id: e.target.value}))} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">-- No Subject --</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Teacher</label>
                                <select value={formData.teacher_id} onChange={e => setFormData(f => ({...f, teacher_id: e.target.value}))} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">-- No Teacher --</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-6">
                            <button onClick={handleClearEntry} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Clear Entry</button>
                            <div className="space-x-2">
                                <button onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Cancel</button>
                                <button onClick={handleAssignModalSubmit} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTimeManagerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsTimeManagerOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Manage Time Periods</h2>
                        <form onSubmit={handleAddTimeSlot} className="grid grid-cols-3 gap-4 items-end p-4 border rounded-md mb-6">
                            <div>
                                <label className="block text-sm font-medium">Start Time</label>
                                <input type="time" required value={newTimeSlot.start_time} onChange={e => setNewTimeSlot(s => ({...s, start_time: e.target.value}))} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium">End Time</label>
                                <input type="time" required value={newTimeSlot.end_time} onChange={e => setNewTimeSlot(s => ({...s, end_time: e.target.value}))} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center text-sm"><input type="checkbox" checked={newTimeSlot.is_break} onChange={e => setNewTimeSlot(s => ({...s, is_break: e.target.checked}))} className="mr-2"/> Is Break?</label>
                                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">Add</button>
                            </div>
                        </form>
                        <ul className="space-y-2 max-h-64 overflow-y-auto">
                            {timeSlots.map(slot => (
                                <li key={slot.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                                    <span>{formatTime(slot.start_time)} - {formatTime(slot.end_time)} {slot.is_break && '(Break)'}</span>
                                    <button onClick={() => handleDeleteTimeSlot(slot.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                                </li>
                            ))}
                        </ul>
                         <div className="flex justify-end mt-6">
                            <button onClick={() => setIsTimeManagerOpen(false)} className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Timetable;
