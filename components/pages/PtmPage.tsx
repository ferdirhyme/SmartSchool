
import React, { useState, useEffect } from 'react';
import { 
    Video, 
    Calendar, 
    Plus, 
    Clock, 
    Users, 
    CheckCircle2, 
    XCircle, 
    AlertCircle,
    User,
    ArrowRight,
    MessageCircle,
    Loader2,
    CalendarDays,
    ChevronRight,
    MoreVertical
} from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, PtmMeeting, UserRole, Teacher } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';

interface PtmPageProps {
    profile: Profile;
}

const PtmPage: React.FC<PtmPageProps> = ({ profile }) => {
    const [loading, setLoading] = useState(true);
    const [meetings, setMeetings] = useState<PtmMeeting[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [parents, setParents] = useState<Profile[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Form States
    const [meetingForm, setMeetingForm] = useState({
        teacher_id: '',
        student_id: '',
        parent_id: '',
        scheduled_at: '',
        duration: 30,
        notes: ''
    });

    const [studentSearch, setStudentSearch] = useState('');
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [studentSuggestions, setStudentSuggestions] = useState<any[]>([]);
    const [lookupSuccess, setLookupSuccess] = useState<boolean | null>(null);
    const [selectedStudentForLink, setSelectedStudentForLink] = useState<any | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase.from('ptm_meetings').select('*, teacher:teachers(full_name), parent:profiles(full_name), student:students(full_name, admission_number, guardian_name, guardian_contact, gps_address)').eq('school_id', profile.school_id).order('scheduled_at', { ascending: true });
            
            if (profile.role === UserRole.Teacher) {
                query = query.eq('teacher_id', profile.id);
            } else if (profile.role === UserRole.Parent) {
                query = query.eq('parent_id', profile.id);
            }

            const { data: mData } = await query;
            setMeetings(mData || []);

            // Pre-fetch related lists for scheduling
            if (profile.role !== UserRole.Parent) {
                const { data: pData } = await supabase
                    .from('profiles')
                    .select('id, full_name, admission_numbers')
                    .eq('school_id', profile.school_id)
                    .eq('role', UserRole.Parent);
                setParents(pData || []);
            }
            if (profile.role !== UserRole.Teacher) {
                const { data: tData } = await supabase.from('teachers').select('id, full_name').eq('school_id', profile.school_id);
                setTeachers(tData || []);
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStudentSearch = async (val: string) => {
        setStudentSearch(val);
        if (val.length < 2) {
            setStudentSuggestions([]);
            return;
        }

        setIsSearchingStudent(true);
        try {
            // Search students by name or admission number
            const { data: students } = await supabase
                .from('students')
                .select('id, full_name, admission_number, guardian_name, guardian_contact, gps_address')
                .or(`full_name.ilike.%${val}%,admission_number.ilike.%${val}%`)
                .eq('school_id', profile.school_id)
                .limit(5);

            setStudentSuggestions(students || []);
        } catch (err) {
            console.error('Student search error:', err);
        } finally {
            setIsSearchingStudent(false);
        }
    };

    const selectStudent = async (student: any) => {
        setStudentSearch(`${student.full_name} (${student.admission_number})`);
        setStudentSuggestions([]);
        setLookupSuccess(null);
        setSelectedStudentForLink(student);
        
        // Update meeting form with student_id
        setMeetingForm(prev => ({ ...prev, student_id: student.id }));
        
        setIsSearchingStudent(true);
        try {
            // 1. Local Search first (more efficient if we already have parents)
            let foundParentId = '';
            
            // Link via admission number
            const linkedParent = parents.find(p => 
                p.admission_numbers?.includes(student.admission_number)
            );

            if (linkedParent) {
                foundParentId = linkedParent.id;
            } else {
                // Fallback: Name match (Trim and Case-Insensitive)
                if (student.guardian_name) {
                    const cleanGuardianName = student.guardian_name.trim().toLowerCase();
                    const nameMatch = parents.find(p => 
                        p.full_name.trim().toLowerCase() === cleanGuardianName
                    );
                    if (nameMatch) foundParentId = nameMatch.id;
                }
            }

            if (foundParentId) {
                setMeetingForm(prev => ({ ...prev, parent_id: foundParentId }));
                setLookupSuccess(true);
            } else {
                // 3. Last resort: Real-time DB check (in case parents was stale)
                const { data: parentProfiles } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('school_id', profile.school_id)
                    .eq('role', UserRole.Parent)
                    .contains('admission_numbers', [student.admission_number])
                    .limit(1);

                if (parentProfiles && parentProfiles.length > 0) {
                    setMeetingForm(prev => ({ ...prev, parent_id: parentProfiles[0].id }));
                    setLookupSuccess(true);
                    // Refresh parent list for consistency
                    fetchData();
                } else {
                    setLookupSuccess(false);
                }
            }
        } catch (err) {
            console.error('Guardian lookup error:', err);
            setLookupSuccess(false);
        } finally {
            setIsSearchingStudent(false);
        }
    };

    const handleManualLink = async () => {
        if (!selectedStudentForLink || !meetingForm.parent_id) return;
        
        setIsSearchingStudent(true);
        try {
            const parent = parents.find(p => p.id === meetingForm.parent_id);
            if (!parent) return;

            const currentAdmissions = parent.admission_numbers || [];
            if (!currentAdmissions.includes(selectedStudentForLink.admission_number)) {
                const updatedAdmissions = [...currentAdmissions, selectedStudentForLink.admission_number];
                
                const { error } = await supabase
                    .from('profiles')
                    .update({ admission_numbers: updatedAdmissions })
                    .eq('id', parent.id);

                if (error) throw error;
                
                // Update local state
                setParents(prev => prev.map(p => 
                    p.id === parent.id ? { ...p, admission_numbers: updatedAdmissions } : p
                ));
                setLookupSuccess(true);
                alert(`Successfully linked ${selectedStudentForLink.full_name} to ${parent.full_name}'s account.`);
            }
        } catch (err) {
            console.error('Manual link error:', err);
            alert('Failed to link student to parent profile.');
        } finally {
            setIsSearchingStudent(false);
        }
    };

    const handleCreateMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...meetingForm,
                school_id: profile.school_id,
                teacher_id: profile.role === UserRole.Teacher ? profile.id : meetingForm.teacher_id,
                parent_id: profile.role === UserRole.Parent ? profile.id : meetingForm.parent_id
            };
            const { error } = await supabase.from('ptm_meetings').insert([payload]);
            if (error) throw error;
            setIsFormOpen(false);
            fetchData();
        } catch (err) {
            alert('Failed to schedule meeting');
        }
    };

    const updateStatus = async (id: string, status: 'completed' | 'canceled') => {
        try {
            const { error } = await supabase.from('ptm_meetings').update({ status }).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) {
            alert('Update failed');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Video className="w-8 h-8 text-brand-600" />
                        PTM Scheduler
                    </h1>
                    <p className="text-gray-500 font-medium">Virtual Parent-Teacher Meetings & Consultation Booking.</p>
                </div>
                {profile.role !== UserRole.Parent && (
                    <button 
                        onClick={() => {
                            setStudentSearch('');
                            setStudentSuggestions([]);
                            setIsSearchingStudent(false);
                            setIsFormOpen(true);
                        }}
                        className="px-6 py-3 bg-brand-900 text-white font-black rounded-2xl hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-brand-900/20"
                    >
                        <CalendarDays className="w-5 h-5" /> Schedule Consultation
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                    <p className="mt-4 text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Agenda...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Filter / Calendar Sidebar? later */}
                    
                    {/* Meeting List */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Upcoming Consultations</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {meetings.map(meeting => (
                                <div key={meeting.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                    <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-brand-600">
                                                <CalendarDays className="w-4 h-4" />
                                                <span className="text-xs font-black uppercase tracking-tight">{new Date(meeting.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                            </div>
                                            <p className="text-xl font-black text-gray-900 dark:text-white">{new Date(meeting.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meeting.status === 'scheduled' ? 'bg-brand-50 text-brand-700' : meeting.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {meeting.status}
                                        </span>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Participants</p>
                                                <p className="text-sm font-black text-gray-700 dark:text-gray-300">
                                                    {meeting.teacher?.full_name} & {meeting.parent?.full_name || meeting.student?.guardian_name || 'Guardian'}
                                                </p>
                                                {meeting.student && (
                                                    <p className="text-[10px] font-bold text-brand-600 uppercase mt-0.5">
                                                        Student: {meeting.student.full_name} ({meeting.student.admission_number})
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {meeting.notes && (
                                            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                                                <p className="text-xs text-gray-500 italic">"{meeting.notes}"</p>
                                            </div>
                                        )}
                                        <div className="pt-2 flex gap-3">
                                            {meeting.status === 'scheduled' && (
                                                <>
                                                    <button className="flex-1 py-3 bg-brand-600 text-white font-black text-xs uppercase rounded-xl hover:bg-brand-700 transition-all flex items-center justify-center gap-2">
                                                        <Video className="w-4 h-4" /> Join Call
                                                    </button>
                                                    {profile.role !== UserRole.Parent && (
                                                        <button 
                                                            onClick={() => updateStatus(meeting.id!, 'completed')}
                                                            className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-green-600 rounded-xl transition-all"
                                                        >
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {meetings.length === 0 && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-20 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Calendar className="w-8 h-8 text-gray-200" />
                                </div>
                                <h4 className="text-lg font-bold text-gray-400">No consultations scheduled.</h4>
                                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">Connect with parents or teachers to facilitate student success through collaboration.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-brand-100 dark:border-brand-900/30"
                        >
                            <h3 className="text-2xl font-black mb-6">Schedule Consultation</h3>
                            <form onSubmit={handleCreateMeeting} className="space-y-5">
                                {profile.role !== UserRole.Teacher && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Teacher</label>
                                        <select required className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl font-bold" value={meetingForm.teacher_id} onChange={e => setMeetingForm({...meetingForm, teacher_id: e.target.value})}>
                                            <option value="">Teacher Name</option>
                                            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                        </select>
                                    </div>
                                )}
                                 {profile.role !== UserRole.Parent && (
                                    <div className="space-y-5">
                                        <div className="relative">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Find Student (Name or admission #)</label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    placeholder="Enter student name or ID..."
                                                    className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl font-bold"
                                                    value={studentSearch}
                                                    onChange={e => handleStudentSearch(e.target.value)}
                                                />
                                                {isSearchingStudent && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-600" />}
                                            </div>
                                            <AnimatePresence>
                                                {studentSuggestions.length > 0 && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 rounded-2xl shadow-2xl border border-brand-100 dark:border-brand-900/30 overflow-hidden max-h-60 overflow-y-auto"
                                                    >
                                                        {studentSuggestions.map(s => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => selectStudent(s)}
                                                                className="w-full p-4 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex items-center justify-between border-b border-gray-50 dark:border-gray-700 last:border-none group"
                                                            >
                                                                <div>
                                                                    <p className="font-bold text-gray-900 dark:text-white group-hover:text-brand-600">{s.full_name}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <p className="text-[10px] text-gray-400 uppercase font-black">{s.admission_number}</p>
                                                                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                                        <p className="text-[10px] text-gray-400 font-bold italic">{s.guardian_name || 'No guardian set'}</p>
                                                                    </div>
                                                                </div>
                                                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-600 transition-colors" />
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {selectedStudentForLink && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admission Guardian Info</p>
                                                            <p className="text-sm font-black text-gray-900 dark:text-white mt-1">{selectedStudentForLink.guardian_name || 'Name not set'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</p>
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1">{selectedStudentForLink.guardian_contact || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                    {selectedStudentForLink.gps_address && (
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GPS Address</p>
                                                            <p className="text-xs font-medium text-gray-500 mt-1">{selectedStudentForLink.gps_address}</p>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}

                                            <div className="flex items-center justify-between mt-2 px-1">
                                                <p className="text-[9px] text-gray-400 uppercase font-bold italic">Auto-fills guardian profile if match found.</p>
                                                {lookupSuccess === false && (
                                                    <div className="flex flex-col gap-2 mt-2">
                                                        <p className="text-[9px] text-amber-600 dark:text-amber-400 font-black uppercase flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> No app account found for this guardian
                                                        </p>
                                                    </div>
                                                )}
                                                {lookupSuccess === true && (
                                                    <p className="text-[9px] text-green-600 dark:text-green-400 font-black uppercase flex items-center gap-1 mt-2">
                                                        <CheckCircle2 className="w-3 h-3" /> Linked to App Account
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Link to App Account (Optional)</label>
                                                {lookupSuccess === false && meetingForm.parent_id && (
                                                    <button 
                                                        type="button"
                                                        onClick={handleManualLink}
                                                        className="text-[10px] font-black text-brand-600 uppercase hover:underline"
                                                    >
                                                        Link Account Permanently
                                                    </button>
                                                )}
                                            </div>
                                            <select className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl font-bold" value={meetingForm.parent_id} onChange={e => setMeetingForm({...meetingForm, parent_id: e.target.value})}>
                                                <option value="">No App Account Selected</option>
                                                {parents.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Meeting Date & Time</label>
                                    <input type="datetime-local" required className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl font-bold" value={meetingForm.scheduled_at} onChange={e => setMeetingForm({...meetingForm, scheduled_at: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Agenda / Notes</label>
                                    <textarea rows={2} required placeholder="Academic performance review..." className="w-full p-4 bg-gray-50 dark:bg-gray-900/50 border-none rounded-2xl font-bold font-medium resize-none text-sm" value={meetingForm.notes} onChange={e => setMeetingForm({...meetingForm, notes: e.target.value})} />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => {
                                        setIsFormOpen(false);
                                        setStudentSearch('');
                                        setStudentSuggestions([]);
                                    }} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 font-bold rounded-2xl">Cancel</button>
                                    <button type="submit" className="flex-1 py-4 bg-brand-900 text-white font-bold rounded-2xl shadow-xl shadow-brand-900/20">Send Invitation</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PtmPage;
