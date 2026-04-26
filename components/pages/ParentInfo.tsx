
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Student, UserRole } from '../../types.ts';
import { Users, Search, Link as LinkIcon, UserPlus, Trash2, ShieldCheck, Mail, Phone, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ParentInfoProps {
    profile: Profile;
}

const ParentInfo: React.FC<ParentInfoProps> = ({ profile }) => {
    const [parents, setParents] = useState<Profile[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [selectedParent, setSelectedParent] = useState<Profile | null>(null);
    const [studentSearch, setStudentSearch] = useState('');
    const [studentSuggestions, setStudentSuggestions] = useState<Student[]>([]);
    const [isGlobalSearching, setIsGlobalSearching] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [parentsRes, studentsRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('school_id', profile.school_id).eq('role', UserRole.Parent).order('full_name'),
                supabase.from('students').select('*').eq('school_id', profile.school_id).order('full_name')
            ]);

            setParents(parentsRes.data || []);
            setStudents(studentsRes.data || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStudentSearch = (val: string) => {
        setStudentSearch(val);
        if (val.length < 2) {
            setStudentSuggestions([]);
            return;
        }
        const matches = students.filter(s => 
            s.full_name.toLowerCase().includes(val.toLowerCase()) || 
            s.admission_number.toLowerCase().includes(val.toLowerCase())
        ).slice(0, 5);
        setStudentSuggestions(matches);
    };

    const linkStudent = async (student: Student) => {
        if (!selectedParent) return;
        
        try {
            const currentAdmissions = selectedParent.admission_numbers || [];
            if (currentAdmissions.includes(student.admission_number)) {
                alert('This student is already linked to this parent.');
                return;
            }

            const updatedAdmissions = [...currentAdmissions, student.admission_number];
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    admission_numbers: updatedAdmissions,
                    school_id: profile.school_id,
                    is_onboarded: true
                })
                .eq('id', selectedParent.id);

            if (error) throw error;

            setParents(prev => prev.map(p => 
                p.id === selectedParent.id ? { ...p, admission_numbers: updatedAdmissions } : p
            ));
            setSelectedParent(prev => prev ? { ...prev, admission_numbers: updatedAdmissions } : null);
            setStudentSearch('');
            setStudentSuggestions([]);
        } catch (err) {
            alert('Failed to link student.');
        }
    };

    const unlinkStudent = async (admissionNum: string) => {
        if (!selectedParent) return;
        
        if (!confirm('Are you sure you want to unlink this student from this parent?')) return;

        try {
            const updatedAdmissions = (selectedParent.admission_numbers || []).filter(a => a !== admissionNum);
            const { error } = await supabase
                .from('profiles')
                .update({ admission_numbers: updatedAdmissions })
                .eq('id', selectedParent.id);

            if (error) throw error;

            setParents(prev => prev.map(p => 
                p.id === selectedParent.id ? { ...p, admission_numbers: updatedAdmissions } : p
            ));
            setSelectedParent(prev => prev ? { ...prev, admission_numbers: updatedAdmissions } : null);
        } catch (err) {
            alert('Failed to unlink student.');
        }
    };

    const filteredParents = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return parents;

        return parents.filter(p => {
            const nameMatch = p.full_name.toLowerCase().includes(term);
            const emailMatch = p.email?.toLowerCase().includes(term);
            
            // Search by linked student names
            const studentMatch = (p.admission_numbers || []).some(adm => {
                const s = students.find(student => student.admission_number === adm);
                return s?.full_name.toLowerCase().includes(term) || adm.toLowerCase().includes(term);
            });

            return nameMatch || emailMatch || studentMatch;
        });
    }, [parents, students, searchTerm]);

    const handleGlobalSearch = async () => {
        if (!searchTerm || searchTerm.length < 3) return;
        setIsGlobalSearching(true);
        try {
            // Search for parents regardless of school_id (but limited results for privacy)
            // Ideally we search for school_id is null parents
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', UserRole.Parent)
                .is('school_id', null)
                .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
                .limit(10);

            if (error) throw error;

            if (data && data.length > 0) {
                // Merge without duplicates
                setParents(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newParents = data.filter(p => !existingIds.has(p.id));
                    return [...prev, ...newParents];
                });
            } else {
                alert('No unlinked parent accounts found matching that search.');
            }
        } catch (err) {
            console.error('Global search error:', err);
        } finally {
            setIsGlobalSearching(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-400 font-bold uppercase tracking-widest text-xs">Loading Guardians...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-brand-600" />
                        Guardian Management
                    </h1>
                    <p className="text-gray-500 font-medium">Link parent accounts to their respective wards for dashboard access.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Parent List */}
                <div className="lg:col-span-12 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Search by name, email, or ward's name..."
                                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm focus:ring-2 focus:ring-brand-500/20 transition-all font-bold"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleGlobalSearch}
                            disabled={isGlobalSearching || searchTerm.length < 3}
                            className="px-8 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-3xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                        >
                            {isGlobalSearching ? (
                                <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                            ) : (
                                <Users className="w-4 h-4" />
                            )}
                            Find Unlinked Parents
                        </button>
                    </div>

                    {filteredParents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredParents.map(parent => (
                                <div key={parent.id} className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!parent.school_id && (
                                                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded-lg">Unlinked</span>
                                            )}
                                            <button 
                                                onClick={() => setSelectedParent(parent)}
                                                className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"
                                            >
                                                <LinkIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white truncate">{parent.full_name}</h4>
                                    <div className="space-y-1 mt-1">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium truncate">
                                            <Mail className="w-3 h-3" /> {parent.email}
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-700">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Linked Wards ({(parent.admission_numbers || []).length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(parent.admission_numbers || []).map(adm => {
                                                const student = students.find(s => s.admission_number === adm);
                                                return (
                                                    <div key={adm} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-full group/chip border border-gray-100 dark:border-gray-700">
                                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                                            {student ? student.full_name : adm}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {(parent.admission_numbers || []).length === 0 && (
                                                <p className="text-xs text-gray-400 italic font-medium">No students linked yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/10 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Users className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">No parents found</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center mt-2 font-medium">
                                We couldn't find any parents matching "{searchTerm}". Use the "Find Unlinked Parents" button to search the platform for accounts not yet linked to your school.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal for Linking */}
            <AnimatePresence>
                {selectedParent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-brand-100 dark:border-brand-900/30"
                        >
                            <div className="p-8 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                                <h3 className="text-2xl font-black mb-1">Manage Wards</h3>
                                <p className="text-gray-500 font-medium">Linking students to <span className="text-brand-600 font-bold">{selectedParent.full_name}</span></p>
                            </div>
                            
                            <div className="p-8 space-y-8">
                                {/* Search Student to Add */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Add New Student</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input 
                                            type="text" 
                                            placeholder="Search by student name or admission ID..."
                                            className="w-full pl-10 pr-4 py-4 bg-gray-50 dark:bg-gray-900/50 border border-transparent focus:border-brand-500/20 rounded-2xl font-bold transition-all text-sm"
                                            value={studentSearch}
                                            onChange={e => handleStudentSearch(e.target.value)}
                                        />
                                        
                                        <AnimatePresence>
                                            {studentSuggestions.length > 0 && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                                                >
                                                    {studentSuggestions.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => linkStudent(s)}
                                                            className="w-full p-4 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors uppercase text-sm tracking-tight">{s.full_name}</p>
                                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">{s.admission_number}</p>
                                                            </div>
                                                            <UserPlus className="w-5 h-5 text-gray-300 group-hover:text-brand-600 transition-colors" />
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Currently Linked Students */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Currently Linked</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(selectedParent.admission_numbers || []).map(adm => {
                                            const student = students.find(s => s.admission_number === adm);
                                            return (
                                                <div key={adm} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl group border border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                                                            <UserPlus className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-gray-900 dark:text-white">{student ? student.full_name : adm}</p>
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{adm}</p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => unlinkStudent(adm)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {(selectedParent.admission_numbers || []).length === 0 && (
                                            <div className="col-span-full py-8 text-center bg-gray-50/50 dark:bg-gray-900/10 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                                <p className="text-sm text-gray-400 font-medium">No students linked to this account yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button 
                                        onClick={() => setSelectedParent(null)}
                                        className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-900/20 active:scale-95"
                                    >
                                        Done / Close
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ParentInfo;
