
import React, { useState, useEffect } from 'react';
import { Plus, FileText, Sparkles, Loader2, Printer, Trash2, Search, ChevronDown, ChevronUp, XCircle, CheckCircle, X } from 'lucide-react';
import { teacherService, AssignedClass, AssignedSubject } from '../../modules/school/teacher.service.ts';
import { aiService } from '../../services/ai.service.ts';
import { schoolService } from '../../modules/school/school.service.ts';
import { Profile, UserRole, SchoolSettings } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase.ts';
import ConfirmationDialog from '../ui/ConfirmationDialog.tsx';

interface SchemeOfLearningPageProps {
    profile: Profile;
}

interface SchemeEntry {
    week: number;
    subStrand: string;
    contentStandard: string;
    indicators: string;
    resources: string;
}

interface SchemeOfLearning {
    id: string;
    subject: string;
    class_name: string;
    term: string;
    academic_year: string;
    scheme: SchemeEntry[];
    created_at: string;
    teacher_id: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    feedback?: string;
    school_id: string;
    teacher?: { full_name: string };
}

const SchemeOfLearningPage: React.FC<SchemeOfLearningPageProps> = ({ profile }) => {
    const [schemes, setSchemes] = useState<SchemeOfLearning[]>([]);
    const [selectedScheme, setSelectedScheme] = useState<SchemeOfLearning | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
    const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
    const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Form State
    const [subject, setSubject] = useState('');
    const [className, setClassName] = useState('');
    const [term, setTerm] = useState('Term 1');
    const [academicYear, setAcademicYear] = useState('2023/2024');
    const [schemeEntries, setSchemeEntries] = useState<SchemeEntry[]>(
        Array.from({ length: 12 }, (_, i) => ({
            week: i + 1,
            subStrand: '',
            contentStandard: '',
            indicators: '',
            resources: ''
        }))
    );

    const isHeadteacher = profile.role === UserRole.Headteacher;

    useEffect(() => {
        fetchSchemes();
        fetchSchoolSettings();
        if (!isHeadteacher) {
            fetchAssignments();
        }
    }, []);

    const fetchSchoolSettings = async () => {
        try {
            const res = await schoolService.getMySchoolSettings();
            if (res.data) setSchoolSettings(res.data);
        } catch (err) {
            console.error("Failed to fetch school settings:", err);
        }
    };

    const fetchAssignments = async () => {
        try {
            const res = await teacherService.getMyAssignments();
            if (res.data) {
                setAssignedClasses(res.data.classes);
                setAssignedSubjects(res.data.subjects);
            }
        } catch (err) {
            console.error("Failed to fetch assignments:", err);
        }
    };

    const fetchSchemes = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('schemes_of_learning')
                .select('*, teacher:profiles(full_name)')
                .eq('school_id', profile.school_id)
                .order('created_at', { ascending: false });
            
            if (!isHeadteacher) {
                query = query.eq('teacher_id', profile.id);
            }

            const { data, error } = await query;
            
            if (error) throw error;
            setSchemes(data || []);
        } catch (err) {
            console.error("Failed to fetch schemes:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!subject || !className || !term) {
            alert("Please select Subject, Class, and Term first.");
            return;
        }

        setIsAiGenerating(true);
        try {
            const result = await aiService.generateSchemeOfLearning({
                subject,
                className,
                term
            });

            if (result && result.scheme) {
                setSchemeEntries(result.scheme);
            }
        } catch (err) {
            console.error("AI Generation failed:", err);
            alert("Failed to generate scheme with AI. Please try again.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSave = {
                subject,
                class_name: className,
                term,
                academic_year: academicYear,
                scheme: schemeEntries,
                school_id: profile.school_id,
                teacher_id: profile.id,
                status: 'pending'
            };

            if (isEditing && editingSchemeId) {
                const { data, error } = await supabase
                    .from('schemes_of_learning')
                    .update(dataToSave)
                    .eq('id', editingSchemeId)
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setSchemes(schemes.map(s => s.id === editingSchemeId ? { ...s, ...data } : s));
                    setShowForm(false);
                    resetForm();
                    setIsEditing(false);
                    setEditingSchemeId(null);
                    alert("Scheme of Learning updated successfully!");
                }
            } else {
                const { data, error } = await supabase
                    .from('schemes_of_learning')
                    .insert(dataToSave)
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setSchemes([data, ...schemes]);
                    setShowForm(false);
                    resetForm();
                    alert("Scheme of Learning saved successfully!");
                }
            }
        } catch (err: any) {
            alert(err.message || "Failed to save scheme");
        }
    };

    const resetForm = () => {
        setSubject('');
        setClassName('');
        setTerm('Term 1');
        setSchemeEntries(Array.from({ length: 12 }, (_, i) => ({
            week: i + 1,
            subStrand: '',
            contentStandard: '',
            indicators: '',
            resources: ''
        })));
    };

    const handleEdit = (scheme: SchemeOfLearning) => {
        setIsEditing(true);
        setEditingSchemeId(scheme.id);
        setSubject(scheme.subject || '');
        setClassName(scheme.class_name || '');
        setTerm(scheme.term || 'Term 1');
        setAcademicYear(scheme.academic_year || '2023/2024');
        setSchemeEntries(scheme.scheme || []);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        setConfirmation({
            title: "Delete Scheme of Learning?",
            message: "All curriculum data for this term will be permanently removed. This action cannot be undone.",
            onConfirm: async () => {
                setIsLoading(true);
                try {
                    const { error } = await supabase
                        .from('schemes_of_learning')
                        .delete()
                        .eq('id', id);
                    if (error) throw error;
                    setSchemes(prev => prev.filter(s => s.id !== id));
                    setSelectedScheme(null);
                    alert("Scheme of Learning deleted.");
                } catch (err: any) {
                    alert(err.message || "Failed to delete scheme");
                } finally {
                    setIsLoading(false);
                }
            }
        });
    };

    const handlePrint = (scheme: SchemeOfLearning) => {
        setSelectedScheme(scheme);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected', feedback?: string) => {
        try {
            const { error } = await supabase
                .from('schemes_of_learning')
                .update({ status, feedback })
                .eq('id', id);

            if (error) throw error;
            setSchemes(schemes.map(s => s.id === id ? { ...s, status, feedback } : s));
            if (selectedScheme?.id === id) {
                setSelectedScheme(prev => prev ? { ...prev, status, feedback } : null);
            }
            alert(`Scheme ${status} successfully!`);
        } catch (err: any) {
            alert(err.message || "Failed to update scheme status");
        }
    };

    const StatusBadge = ({ status }: { status: SchemeOfLearning['status'] }) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-600',
            pending: 'bg-yellow-100 text-yellow-600',
            approved: 'bg-green-100 text-green-600',
            rejected: 'bg-red-100 text-red-600',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${styles[status]}`}>
                {status}
            </span>
        );
    };

    return (
        <>
            <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Termly Scheme of Learning</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Plan your termly curriculum and learning goals.
                    </p>
                </div>
                {!isHeadteacher && (
                    <button 
                        onClick={() => {
                            if (showForm) {
                                setShowForm(false);
                                resetForm();
                                setIsEditing(false);
                                setEditingSchemeId(null);
                            } else {
                                setShowForm(true);
                            }
                        }}
                        className="bg-brand-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-brand-700 transition-all shadow-sm font-bold"
                    >
                        {showForm ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancel' : 'New Scheme'}
                    </button>
                )}
            </div>

            {showForm && (
                <motion.form 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleSubmit}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-brand-100 dark:border-brand-900 shadow-lg space-y-6 no-print"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {isEditing ? 'Edit Scheme of Learning' : 'Prepare Scheme of Learning'}
                        </h3>
                        <button
                            type="button"
                            onClick={handleAiGenerate}
                            disabled={true}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-xl cursor-not-allowed transition-all font-bold text-sm shadow-sm"
                        >
                            <Sparkles className="w-4 h-4" />
                            Generate with AI (Coming Soon...)
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                            <select required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Select Subject</option>
                                {assignedSubjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class</label>
                            <select required value={className} onChange={e => setClassName(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                <option value="">Select Class</option>
                                {assignedClasses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Term</label>
                            <select value={term} onChange={e => setTerm(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                                <option>Term 1</option>
                                <option>Term 2</option>
                                <option>Term 3</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Academic Year</label>
                            <input type="text" value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                    <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase border dark:border-gray-600">Week</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase border dark:border-gray-600">Sub-Strand</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase border dark:border-gray-600">Content Standard</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase border dark:border-gray-600">Indicators</th>
                                    <th className="p-3 text-left text-xs font-bold text-gray-500 uppercase border dark:border-gray-600">Resources</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schemeEntries.map((entry, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 border dark:border-gray-600 text-center font-bold">{entry.week}</td>
                                        <td className="p-2 border dark:border-gray-600">
                                            <textarea 
                                                value={entry.subStrand} 
                                                onChange={e => {
                                                    const newEntries = [...schemeEntries];
                                                    newEntries[idx].subStrand = e.target.value;
                                                    setSchemeEntries(newEntries);
                                                }}
                                                className="w-full p-1 bg-transparent border-none focus:ring-0 resize-none text-sm"
                                            />
                                        </td>
                                        <td className="p-2 border dark:border-gray-600">
                                            <textarea 
                                                value={entry.contentStandard} 
                                                onChange={e => {
                                                    const newEntries = [...schemeEntries];
                                                    newEntries[idx].contentStandard = e.target.value;
                                                    setSchemeEntries(newEntries);
                                                }}
                                                className="w-full p-1 bg-transparent border-none focus:ring-0 resize-none text-sm"
                                            />
                                        </td>
                                        <td className="p-2 border dark:border-gray-600">
                                            <textarea 
                                                value={entry.indicators} 
                                                onChange={e => {
                                                    const newEntries = [...schemeEntries];
                                                    newEntries[idx].indicators = e.target.value;
                                                    setSchemeEntries(newEntries);
                                                }}
                                                className="w-full p-1 bg-transparent border-none focus:ring-0 resize-none text-sm"
                                            />
                                        </td>
                                        <td className="p-2 border dark:border-gray-600">
                                            <textarea 
                                                value={entry.resources} 
                                                onChange={e => {
                                                    const newEntries = [...schemeEntries];
                                                    newEntries[idx].resources = e.target.value;
                                                    setSchemeEntries(newEntries);
                                                }}
                                                className="w-full p-1 bg-transparent border-none focus:ring-0 resize-none text-sm"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => { setShowForm(false); resetForm(); setIsEditing(false); setEditingSchemeId(null); }} className="px-6 py-2 rounded-xl border font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                        <button 
                            type="button" 
                            onClick={() => handlePrint({
                                id: 'TEMP',
                                subject,
                                class_name: className,
                                term,
                                academic_year: academicYear,
                                scheme: schemeEntries,
                                created_at: new Date().toISOString(),
                                teacher_id: profile.id,
                                status: 'draft',
                                school_id: profile.school_id || ''
                            })}
                            disabled={!subject || !className}
                            className="px-6 py-2 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-xl font-bold hover:bg-brand-50 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Printer className="w-4 h-4" />
                            Print Preview
                        </button>
                        <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-sm">{isEditing ? 'Update Scheme' : 'Save Scheme'}</button>
                    </div>
                </motion.form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {schemes.map(scheme => (
                    <div 
                        key={scheme.id} 
                        onClick={() => setSelectedScheme(scheme)}
                        className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-2">
                                <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl w-fit">
                                    <FileText className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                                </div>
                                <StatusBadge status={scheme.status} />
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isHeadteacher && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleEdit(scheme); }} 
                                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                        title="Edit"
                                                                    >
                                        <Plus className="w-4 h-4 rotate-45" />
                                    </button>
                                )}
                                {(scheme.status === 'pending' || scheme.status === 'rejected') && !isHeadteacher && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(scheme.id); }} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{scheme.subject}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{scheme.class_name} • {scheme.term}</p>
                        <p className="text-xs text-gray-400 mb-4">{scheme.academic_year} {isHeadteacher && `• By ${scheme.teacher?.full_name}`}</p>
                        
                        {scheme.status === 'rejected' && scheme.feedback && (
                            <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-xs rounded-lg border border-red-100 dark:border-red-900/30">
                                <strong>Feedback:</strong> {scheme.feedback}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrint(scheme);
                                }}
                                className="w-full py-2 border border-brand-200 dark:border-brand-800 rounded-xl text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all flex items-center justify-center gap-2 no-print"
                            >
                                <Printer className="w-4 h-4" />
                                Print Scheme
                            </button>

                            {isHeadteacher && scheme.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleUpdateStatus(scheme.id, 'approved')}
                                        className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all text-sm"
                                    >
                                        Approve
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const reason = prompt("Enter rejection reason:");
                                            if (reason) handleUpdateStatus(scheme.id, 'rejected', reason);
                                        }}
                                        className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all text-sm"
                                    >
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {selectedScheme && !window.matchMedia('print').matches && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm no-print">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
                                <div className="flex items-center gap-4">
                                    {schoolSettings?.logo_url && (
                                        <img 
                                            src={schoolSettings.logo_url} 
                                            alt="School Logo" 
                                            className="w-10 h-10 object-contain"
                                            referrerPolicy="no-referrer"
                                        />
                                    )}
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                                            {schoolSettings?.school_name || 'Weekly Scheme of Learning'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <StatusBadge status={selectedScheme.status} />
                                            {schoolSettings?.motto && <span className="text-[10px] italic text-gray-400">"{schoolSettings.motto}"</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handlePrint(selectedScheme)} 
                                        className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"
                                        title="Print Scheme"
                                    >
                                        <Printer className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => setSelectedScheme(null)} 
                                        className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 space-y-8">
                                {/* Details row for preview */}
                                <div className="hidden md:flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-gray-400 uppercase tracking-tight border-b border-gray-100 dark:border-gray-700 pb-6 mb-2">
                                    {schoolSettings?.address && <span>{schoolSettings.address}</span>}
                                    {schoolSettings?.phone && <span>Tel: {schoolSettings.phone}</span>}
                                    {schoolSettings?.email && <span>Email: {schoolSettings.email}</span>}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Subject</label>
                                        <p className="font-bold">{selectedScheme.subject}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Class</label>
                                        <p className="font-bold">{selectedScheme.class_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Term</label>
                                        <p className="font-bold">{selectedScheme.term}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Academic Year</label>
                                        <p className="font-bold">{selectedScheme.academic_year}</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                                                <th className="p-3 border dark:border-gray-600 text-[10px] font-bold uppercase text-left w-16">Week</th>
                                                <th className="p-3 border dark:border-gray-600 text-[10px] font-bold uppercase text-left">Sub-Strand</th>
                                                <th className="p-3 border dark:border-gray-600 text-[10px] font-bold uppercase text-left">Content Standard</th>
                                                <th className="p-3 border dark:border-gray-600 text-[10px] font-bold uppercase text-left">Indicators</th>
                                                <th className="p-3 border dark:border-gray-600 text-[10px] font-bold uppercase text-left">Resources</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedScheme.scheme.map((entry) => (
                                                <tr key={entry.week}>
                                                    <td className="p-3 border dark:border-gray-600 text-sm font-bold text-center">{entry.week}</td>
                                                    <td className="p-3 border dark:border-gray-600 text-sm">{entry.subStrand}</td>
                                                    <td className="p-3 border dark:border-gray-600 text-sm">{entry.contentStandard}</td>
                                                    <td className="p-3 border dark:border-gray-600 text-sm">{entry.indicators}</td>
                                                    <td className="p-3 border dark:border-gray-600 text-sm">{entry.resources}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {isHeadteacher && selectedScheme.status === 'pending' && (
                                    <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                                        <div className="bg-brand-50 dark:bg-brand-900/10 p-6 rounded-2xl">
                                            <h4 className="font-bold mb-4 flex items-center gap-2">
                                                <CheckCircle className="w-5 h-5 text-brand-600" />
                                                Review Actions
                                            </h4>
                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const reason = prompt("Enter rejection reason:");
                                                        if (reason) handleUpdateStatus(selectedScheme.id, 'rejected', reason);
                                                    }}
                                                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <XCircle className="w-5 h-5" /> Reject Scheme
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateStatus(selectedScheme.id, 'approved');
                                                    }}
                                                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
                                                >
                                                    <CheckCircle className="w-5 h-5" /> Approve Scheme
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Print-only Layout - Professional GES Format */}
            <div className="hidden print:block print-content bg-white text-black p-4 font-serif">
                {selectedScheme && (
                    <div className="border-[3px] border-black p-6 space-y-6">
                        <div className="text-center border-b-2 border-black pb-4 mb-6 flex flex-col items-center">
                            {schoolSettings?.logo_url && (
                                <img 
                                    src={schoolSettings.logo_url} 
                                    alt="School Logo" 
                                    className="w-20 h-20 object-contain mb-2"
                                    referrerPolicy="no-referrer"
                                />
                            )}
                            <h1 className="text-2xl font-black uppercase tracking-widest leading-none">
                                {schoolSettings?.school_name || 'Weekly Scheme of Learning'}
                            </h1>
                            {schoolSettings?.motto && (
                                <p className="text-[10px] italic font-bold text-gray-600 mt-1 uppercase tracking-tight">
                                    "{schoolSettings.motto}"
                                </p>
                            )}
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 text-[9px] font-bold uppercase text-gray-500">
                                {schoolSettings?.address && <span>{schoolSettings.address}</span>}
                                {schoolSettings?.phone && <span>Tel: {schoolSettings.phone}</span>}
                                {schoolSettings?.email && <span>Email: {schoolSettings.email}</span>}
                            </div>
                            <div className="mt-3 border-t-2 border-black w-full pt-1">
                                <p className="text-xs font-black uppercase tracking-[0.2em]">{schoolSettings ? 'Weekly Scheme of Learning' : 'SmartSchool Digital Management System'}</p>
                            </div>
                        </div>

                        {/* Header Box */}
                        <div className="grid grid-cols-2 gap-0 border-2 border-black">
                            <div className="border-r-2 border-b-2 border-black p-2">
                                <span className="text-[10px] font-black uppercase block">Subject:</span>
                                <span className="text-sm font-bold">{selectedScheme.subject}</span>
                            </div>
                            <div className="border-b-2 border-black p-2">
                                <span className="text-[10px] font-black uppercase block">Class:</span>
                                <span className="text-sm font-bold">{selectedScheme.class_name}</span>
                            </div>
                            <div className="border-r-2 border-black p-2">
                                <span className="text-[10px] font-black uppercase block">Term / Academic Year:</span>
                                <span className="text-sm font-bold">{selectedScheme.term} • {selectedScheme.academic_year}</span>
                            </div>
                            <div className="p-2">
                                <span className="text-[10px] font-black uppercase block">Reference:</span>
                                <span className="text-sm font-bold">SOL-{selectedScheme.id.substring(0,8).toUpperCase()}</span>
                            </div>
                        </div>

                        {/* Scheme Table */}
                        <table className="w-full border-2 border-black border-collapse">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border-2 border-black p-2 text-[10px] font-black uppercase w-12 text-center">Week</th>
                                    <th className="border-2 border-black p-2 text-[10px] font-black uppercase text-left w-1/4">Sub-Strand</th>
                                    <th className="border-2 border-black p-2 text-[10px] font-black uppercase text-left w-1/3">Content Standard</th>
                                    <th className="border-2 border-black p-2 text-[10px] font-black uppercase text-left">Indicators</th>
                                    <th className="border-2 border-black p-2 text-[10px] font-black uppercase text-left w-32">Resources</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedScheme.scheme.map((entry) => (
                                    <tr key={entry.week}>
                                        <td className="border-2 border-black p-2 text-xs font-bold text-center">{entry.week}</td>
                                        <td className="border-2 border-black p-2 text-xs whitespace-pre-wrap">{entry.subStrand}</td>
                                        <td className="border-2 border-black p-2 text-xs whitespace-pre-wrap">{entry.contentStandard}</td>
                                        <td className="border-2 border-black p-2 text-xs whitespace-pre-wrap">{entry.indicators}</td>
                                        <td className="border-2 border-black p-2 text-xs whitespace-pre-wrap">{entry.resources}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Formal Signatures */}
                        <div className="mt-12 grid grid-cols-2 gap-16 px-4">
                            <div className="text-center">
                                <div className="border-b-2 border-black mb-1 h-12"></div>
                                <p className="text-[10px] font-black uppercase tracking-wider">Teacher's Signature & Date</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b-2 border-black mb-1 h-12"></div>
                                <p className="text-[10px] font-black uppercase tracking-wider">Headteacher's Signature & Date</p>
                            </div>
                        </div>

                        <div className="text-[10px] text-gray-400 text-center mt-12 italic border-t border-gray-100 pt-4">
                            Generated by SmartSchool DMS • Professional Ghanaian Learning Management • Ref: {selectedScheme.id.substring(0,8).toUpperCase()}
                        </div>
                    </div>
                )}
            </div>

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

export default SchemeOfLearningPage;
