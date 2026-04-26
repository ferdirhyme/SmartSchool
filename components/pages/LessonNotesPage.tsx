
import React, { useState, useEffect } from 'react';
import { Plus, FileText, CheckCircle, XCircle, Clock, Printer, Trash2, ChevronDown, ChevronUp, Search, Sparkles, Loader2 } from 'lucide-react';
import { lessonNoteService, LessonNote } from '../../modules/school/lesson-note.service.ts';
import { teacherService, AssignedClass, AssignedSubject } from '../../modules/school/teacher.service.ts';
import { schoolService } from '../../modules/school/school.service.ts';
import { aiService } from '../../services/ai.service.ts';
import { Profile, UserRole, SchoolSettings } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationDialog from '../ui/ConfirmationDialog.tsx';

interface LessonNotesPageProps {
    profile: Profile;
}

const LessonNotesPage: React.FC<LessonNotesPageProps> = ({ profile }) => {
    const [notes, setNotes] = useState<LessonNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
    const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
    const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);

    // Form State
    const [weekEnding, setWeekEnding] = useState('');
    const [subject, setSubject] = useState('');
    const [className, setClassName] = useState('');
    const [term, setTerm] = useState('Term 1');
    const [strand, setStrand] = useState('');
    const [subStrand, setSubStrand] = useState('');
    const [reference, setReference] = useState('');
    const [indicatorCount, setIndicatorCount] = useState(1);
    const [rpk, setRpk] = useState('');
    const [learningIndicators, setLearningIndicators] = useState('');
    const [introduction, setIntroduction] = useState('');
    const [conclusion, setConclusion] = useState('');
    const [evaluation, setEvaluation] = useState('');
    const [duration, setDuration] = useState('');
    const [days, setDays] = useState('');
    const [coreCompetencies, setCoreCompetencies] = useState<string[]>([]);
    const [tlms, setTlms] = useState<string[]>([]);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
    } | null>(null);
    const [presentationSteps, setPresentationSteps] = useState<{ step: string; activity: string }[]>([
        { step: 'Step 1', activity: '' }
    ]);

    // Review State
    const [remarks, setRemarks] = useState('');

    const isHeadteacher = profile.role === UserRole.Headteacher;

    const handlePrintAction = () => {
        try {
            window.focus();
            window.print();
        } catch (e) {
            console.error("Print failed:", e);
        }
    };

    useEffect(() => {
        if (isPrinting && selectedNote) {
            const timer = setTimeout(() => {
                handlePrintAction();
                setIsPrinting(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isPrinting, selectedNote]);

    useEffect(() => {
        fetchNotes();
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

    const fetchNotes = async () => {
        setIsLoading(true);
        try {
            const res = isHeadteacher 
                ? await lessonNoteService.getSchoolNotesForReview()
                : await lessonNoteService.getTeacherNotes();
            
            if (res.data) setNotes(res.data);
        } catch (err) {
            console.error("Failed to fetch notes:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsActionLoading(true);
        try {
            const noteData = {
                week_ending: weekEnding,
                subject,
                class_name: className,
                term,
                strand,
                sub_strand: subStrand,
                reference,
                rpk,
                learning_indicators: learningIndicators,
                introduction,
                presentation_steps: presentationSteps,
                conclusion,
                evaluation,
                days,
                duration,
                core_competencies: coreCompetencies,
                tlms: tlms
            };

            if (isEditing && editingNoteId) {
                const { data, error } = await lessonNoteService.updateNote(editingNoteId, noteData);
                if (error) throw new Error(error);
                if (data) {
                    setNotes(notes.map(n => n.id === editingNoteId ? { ...n, ...data } : n));
                    setShowForm(false);
                    resetForm();
                    setIsEditing(false);
                    setEditingNoteId(null);
                    alert("Lesson note updated successfully!");
                }
            } else {
                const { data, error } = await lessonNoteService.createNote(noteData);
                if (error) throw new Error(error);
                if (data) {
                    setNotes([data, ...notes]);
                    setShowForm(false);
                    resetForm();
                    alert("Lesson note submitted for review!");
                }
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to save lesson note");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        setIsActionLoading(true);
        try {
            const { data, error } = await lessonNoteService.updateStatus(id, status, remarks);
            if (error) throw new Error(error);
            if (data) {
                setNotes(notes.map(n => n.id === id ? { ...n, ...data } : n));
                setSelectedNote(null);
                setRemarks('');
                alert(`Lesson note ${status} successfully!`);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update status");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmation({
            title: "Delete Lesson Note?",
            message: "This action cannot be undone. All data associated with this lesson note will be permanently removed.",
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const { error } = await lessonNoteService.deleteNote(id);
                    if (error) throw new Error(error);
                    setNotes(prev => prev.filter(n => n.id !== id));
                    setSelectedNote(null);
                    alert("Lesson note deleted.");
                } catch (err) {
                    console.error("Delete failed:", err);
                    alert(err instanceof Error ? err.message : "Failed to delete note");
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const handleEdit = (note: LessonNote) => {
        setIsEditing(true);
        setEditingNoteId(note.id);
        setWeekEnding(note.week_ending || '');
        setSubject(note.subject || '');
        setClassName(note.class_name || '');
        setTerm(note.term || 'Term 1');
        setStrand(note.strand || '');
        setSubStrand(note.sub_strand || '');
        setReference(note.reference || '');
        setRpk(note.rpk || '');
        setLearningIndicators(note.learning_indicators || '');
        setIntroduction(note.introduction || '');
        setConclusion(note.conclusion || '');
        setEvaluation(note.evaluation || '');
        setDays(note.days || '');
        setDuration(note.duration || '');
        setCoreCompetencies(note.core_competencies || []);
        setTlms(note.tlms || []);
        setPresentationSteps(note.presentation_steps || []);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAiGenerate = async () => {
        if (!subject || !className || !strand) {
            alert("Please select Subject, Class, and enter a Strand first.");
            return;
        }

        setIsAiGenerating(true);
        try {
            const result = await aiService.generateLessonPlan({
                subject,
                className,
                term,
                strand,
                subStrand,
                topic: strand,
                reference,
                indicatorCount
            });

            if (result) {
                if (result.strand) setStrand(result.strand);
                if (result.subStrand) setSubStrand(result.subStrand);
                setLearningIndicators(result.indicator || '');
                setRpk(result.rpk || '');
                setCoreCompetencies(result.coreCompetencies && Array.isArray(result.coreCompetencies) ? result.coreCompetencies : (result.coreCompetencies ? [result.coreCompetencies] : []));
                setTlms(result.learningResources && Array.isArray(result.learningResources) ? result.learningResources : (result.learningResources ? [result.learningResources] : []));
                setIntroduction(result.introduction || '');
                setConclusion(result.conclusion || '');
                setEvaluation(result.evaluation || '');
                
                if (result.presentationSteps && Array.isArray(result.presentationSteps)) {
                    setPresentationSteps(result.presentationSteps);
                } else if (result.mainActivities) {
                    setPresentationSteps([{ step: 'Main Activities', activity: result.mainActivities }]);
                }
                
                if (result.keyWords) {
                    setEvaluation(prev => prev + "\nKey Words: " + result.keyWords);
                }
            }
        } catch (err) {
            console.error("AI Generation failed:", err);
            alert("Failed to generate lesson plan with AI. Please try again.");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const resetForm = () => {
        setWeekEnding('');
        setSubject('');
        setClassName('');
        setTerm('Term 1');
        setStrand('');
        setSubStrand('');
        setReference('');
        setIndicatorCount(1);
        setRpk('');
        setLearningIndicators('');
        setIntroduction('');
        setConclusion('');
        setEvaluation('');
        setDays('');
        setDuration('');
        setCoreCompetencies([]);
        setTlms([]);
        setPresentationSteps([{ step: 'Step 1', activity: '' }]);
    };

    const addStep = () => {
        setPresentationSteps([...presentationSteps, { step: `Step ${presentationSteps.length + 1}`, activity: '' }]);
    };

    const removeStep = (index: number) => {
        setConfirmation({
            title: "Remove Task/Activity?",
            message: "Are you sure you want to remove this step from your lesson plan?",
            confirmText: "Remove",
            onConfirm: () => {
                setPresentationSteps(prev => prev.filter((_, i) => i !== index));
            }
        });
    };

    const updateStep = (index: number, activity: string) => {
        const newSteps = [...presentationSteps];
        newSteps[index].activity = activity;
        setPresentationSteps(newSteps);
    };

    const filteredNotes = notes.filter(n => 
        n.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.strand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.teacher?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <>
            <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lesson Notes</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isHeadteacher ? 'Review and authorize teacher lesson notes.' : 'Prepare and manage your lesson notes.'}
                    </p>
                </div>
                {!isHeadteacher && (
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="bg-brand-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-brand-700 transition-all shadow-sm font-bold"
                    >
                        {showForm ? <XCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? 'Cancel' : 'New Lesson Note'}
                    </button>
                )}
            </div>

            <div className="relative w-full md:w-72 no-print">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700"
                />
            </div>

            {showForm && !isHeadteacher && (
                <motion.form 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleSubmit} 
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-brand-100 dark:border-brand-900 shadow-lg space-y-6 no-print"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {isEditing ? 'Edit Lesson Note' : 'Prepare Lesson Note'}
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Week Ending</label>
                            <input type="date" required value={weekEnding} onChange={e => setWeekEnding(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject</label>
                            {assignedSubjects.length > 0 ? (
                                <select 
                                    required 
                                    value={subject} 
                                    onChange={e => setSubject(e.target.value)} 
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Select Subject</option>
                                    {assignedSubjects.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    required 
                                    value={subject} 
                                    onChange={e => setSubject(e.target.value)} 
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                                    placeholder="e.g. Mathematics" 
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Class</label>
                            {assignedClasses.length > 0 ? (
                                <select 
                                    required 
                                    value={className} 
                                    onChange={e => setClassName(e.target.value)} 
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">Select Class</option>
                                    {assignedClasses.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    required 
                                    value={className} 
                                    onChange={e => setClassName(e.target.value)} 
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                                    placeholder="e.g. Basic 7" 
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Term</label>
                            <select 
                                value={term} 
                                onChange={e => setTerm(e.target.value)} 
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option>Term 1</option>
                                <option>Term 2</option>
                                <option>Term 3</option>
                            </select>
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Day(s)</label>
                            <input 
                                type="text" 
                                value={days} 
                                onChange={e => setDays(e.target.value)} 
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                                placeholder="e.g. Mon, Wed" 
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duration</label>
                            <input 
                                type="text" 
                                value={duration} 
                                onChange={e => setDuration(e.target.value)} 
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                                placeholder="e.g. 60 mins" 
                            />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Strand</label>
                            <input type="text" required value={strand} onChange={e => setStrand(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SUB-STRAND</label>
                            <input type="text" value={subStrand} onChange={e => setSubStrand(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reference</label>
                            <input 
                                type="text" 
                                value={reference} 
                                onChange={e => setReference(e.target.value)} 
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                                placeholder="e.g. GES New Curriculum, Page 45"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Number of Learning Indicators</label>
                            <input 
                                type="number" 
                                min="1" 
                                max="10"
                                value={indicatorCount} 
                                onChange={e => setIndicatorCount(parseInt(e.target.value) || 1)} 
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RPK (Relevant Previous Knowledge)</label>
                        <textarea value={rpk} onChange={e => setRpk(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-20 resize-none" placeholder="What do students already know?" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Learning Indicators / Objectives</label>
                        <textarea required value={learningIndicators} onChange={e => setLearningIndicators(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-24 resize-none" placeholder="What should students achieve?" />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Presentation Steps</label>
                            <button type="button" onClick={addStep} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Step
                            </button>
                        </div>
                        {presentationSteps.map((step, index) => (
                            <div key={index} className="flex gap-3 items-start">
                                <div className="w-20 shrink-0 pt-2.5 text-xs font-bold text-gray-400">{step.step}</div>
                                <textarea 
                                    required
                                    value={step.activity}
                                    onChange={e => updateStep(index, e.target.value)}
                                    className="flex-grow p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-20 resize-none"
                                    placeholder="Describe the activity..."
                                />
                                {presentationSteps.length > 1 && (
                                    <button type="button" onClick={() => removeStep(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Conclusion</label>
                            <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-20 resize-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Evaluation / Exercise</label>
                            <textarea value={evaluation} onChange={e => setEvaluation(e.target.value)} className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-20 resize-none" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => { setShowForm(false); resetForm(); setIsEditing(false); setEditingNoteId(null); }} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
                        <button type="submit" disabled={isActionLoading} className="bg-brand-600 text-white px-8 py-2 rounded-xl font-bold disabled:opacity-50 shadow-md">
                            {isActionLoading ? 'Saving...' : isEditing ? 'Update Lesson Note' : 'Submit Lesson Note'}
                        </button>
                    </div>
                </motion.form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
                {filteredNotes.map(note => (
                    <motion.div 
                        layout
                        key={note.id} 
                        className={`bg-white dark:bg-gray-800 p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${selectedNote?.id === note.id ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-100 dark:border-gray-700'}`}
                        onClick={() => setSelectedNote(note)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-lg ${note.status === 'approved' ? 'bg-green-100 text-green-600' : note.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                note.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                note.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {note.status}
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white truncate">{note.strand}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{note.subject} • {note.class_name}</p>
                        
                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium">
                                    <Clock className="w-3 h-3" />
                                    {new Date(note.created_at).toLocaleDateString()}
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedNote(note);
                                        setIsPrinting(true);
                                    }}
                                    className="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                                    title="Quick Print"
                                    disabled={isPrinting}
                                >
                                    {isPrinting && selectedNote?.id === note.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                                </button>
                                {!isHeadteacher && (
                                    <div className="flex items-center gap-1">
                                        <button 
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(note);
                                            }}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Plus className="w-3.5 h-3.5 rotate-45" /> 
                                            {/* Note: I'll use separate icons for Edit and Trash2 below */}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(note.id);
                                            }}
                                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {isHeadteacher && (
                                <span className="text-[10px] font-bold text-brand-600">By: {note.teacher?.full_name}</span>
                            )}
                        </div>
                    </motion.div>
                ))}
                {filteredNotes.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No lesson notes found.</p>
                    </div>
                )}
            </div>

            {/* Detailed View / Print View */}
            <AnimatePresence>
                {selectedNote && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm no-print">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl flex flex-col"
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
                                            {schoolSettings?.school_name || 'Lesson Note Details'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                selectedNote.status === 'approved' ? 'bg-green-100 text-green-700' : 
                                                selectedNote.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {selectedNote.status}
                                            </span>
                                            {schoolSettings?.motto && <span className="text-[10px] italic text-gray-400">"{schoolSettings.motto}"</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setIsPrinting(true)} 
                                        className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all active:scale-95 shadow-sm border border-brand-100 dark:border-brand-800" 
                                        title="Print Lesson Note"
                                        disabled={isPrinting}
                                    >
                                        {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedNote(null)} 
                                        className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 space-y-8" id="printable-note">
                                {/* Details row for preview */}
                                <div className="hidden md:flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-gray-400 uppercase tracking-tight border-b border-gray-100 dark:border-gray-700 pb-6 mb-2">
                                    {schoolSettings?.address && <span>{schoolSettings.address}</span>}
                                    {schoolSettings?.phone && <span>Tel: {schoolSettings.phone}</span>}
                                    {schoolSettings?.email && <span>Email: {schoolSettings.email}</span>}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Week Ending</label>
                                        <p className="font-bold">{new Date(selectedNote.week_ending).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Subject</label>
                                        <p className="font-bold">{selectedNote.subject}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Class</label>
                                        <p className="font-bold">{selectedNote.class_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Term</label>
                                        <p className="font-bold">{selectedNote.term}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Day(s)</label>
                                        <p className="font-bold">{selectedNote.days || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Duration</label>
                                        <p className="font-bold">{selectedNote.duration || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Reference</label>
                                        <p className="font-bold">{selectedNote.reference || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Teacher</label>
                                        <p className="font-bold">{selectedNote.teacher?.full_name || profile.full_name}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Strand / SUB-STRAND</h4>
                                            <p className="text-gray-900 dark:text-white font-medium">{selectedNote.strand}</p>
                                            {selectedNote.sub_strand && <p className="text-sm text-gray-500 mt-1">{selectedNote.sub_strand}</p>}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">RPK</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNote.rpk || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Core Competencies</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedNote.core_competencies?.map((c, i) => (
                                                    <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{c}</span>
                                                )) || 'N/A'}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Learning Resources (TLMs)</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedNote.tlms?.map((t, i) => (
                                                    <span key={i} className="px-2 py-1 bg-brand-50 dark:bg-brand-900/20 rounded text-xs text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800">{t}</span>
                                                )) || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Learning Indicators</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNote.learning_indicators}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-4">Presentation / Activities</h4>
                                    <div className="space-y-4">
                                        {selectedNote.presentation_steps.map((step, i) => (
                                            <div key={i} className="flex gap-4">
                                                <div className="w-16 shrink-0 text-xs font-black text-gray-300 pt-1">{step.step}</div>
                                                <div className="flex-grow p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-800">
                                                    {step.activity}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <div>
                                        <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Conclusion</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNote.conclusion || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-2">Evaluation</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNote.evaluation || 'N/A'}</p>
                                    </div>
                                </div>

                                {selectedNote.headteacher_remarks && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl">
                                        <h4 className="text-[10px] font-bold text-amber-600 uppercase mb-1">Headteacher Remarks</h4>
                                        <p className="text-sm text-amber-900 dark:text-amber-200 italic">"{selectedNote.headteacher_remarks}"</p>
                                    </div>
                                )}

                                {isHeadteacher && selectedNote.status === 'pending' && (
                                    <div className="pt-8 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Review Remarks</label>
                                            <textarea 
                                                value={remarks}
                                                onChange={e => setRemarks(e.target.value)}
                                                className="w-full p-4 border rounded-2xl dark:bg-gray-900 dark:border-gray-700 h-24 resize-none"
                                                placeholder="Add your feedback here..."
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedNote.id, 'rejected')}
                                                disabled={isActionLoading}
                                                className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <XCircle className="w-5 h-5" /> Reject Note
                                            </button>
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedNote.id, 'approved')}
                                                disabled={isActionLoading}
                                                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                                            >
                                                <CheckCircle className="w-5 h-5" /> Approve & Sign
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>            {/* Print-only layout - Formatted like traditional GES template */}
            <div className="hidden print:block print-content bg-white text-black p-4 font-serif">
                {selectedNote && (
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
                                {schoolSettings?.school_name || 'Weekly Lesson Plan'}
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
                                <p className="text-xs font-black uppercase tracking-[0.2em]">{schoolSettings ? 'Weekly Lesson Plan' : 'SmartSchool Digital Management System'}</p>
                            </div>
                        </div>
                        
                        {/* Header Box */}
                        <div className="grid grid-cols-2 gap-0 border-2 border-black">
                            <div className="border-r-2 border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Week Ending</p>
                                <p className="font-bold text-sm tracking-wide">{new Date(selectedNote.week_ending).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <div className="border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Subject</p>
                                <p className="font-bold text-sm tracking-wide">{selectedNote.subject}</p>
                            </div>
                            <div className="border-r-2 border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Class</p>
                                <p className="font-bold text-sm tracking-wide">{selectedNote.class_name}</p>
                            </div>
                            <div className="border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Term</p>
                                <p className="font-bold text-sm tracking-wide">{selectedNote.term}</p>
                            </div>
                            <div className="border-r-2 border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Day(s)</p>
                                <p className="font-bold text-sm tracking-wide">{selectedNote.days || 'N/A'}</p>
                            </div>
                            <div className="border-b-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Duration</p>
                                <p className="font-bold text-sm tracking-wide">{selectedNote.duration || 'N/A'}</p>
                            </div>
                            <div className="border-r-2 border-black p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Reference</p>
                                <p className="font-bold text-[11px] leading-tight">{selectedNote.reference || 'GES Standard Based Curriculum'}</p>
                            </div>
                            <div className="p-2">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Teacher</p>
                                <p className="font-bold text-sm tracking-wide uppercase">{selectedNote.teacher?.full_name || profile.full_name}</p>
                            </div>
                        </div>

                        {/* Content Sections */}
                        <div className="space-y-0 border-2 border-black border-t-0">
                            <div className="border-t-2 border-black p-3 bg-gray-50 print:bg-transparent">
                                <h2 className="font-black text-xs uppercase mb-1">Strand / Sub-Strand</h2>
                                <p className="text-sm italic">{selectedNote.strand} <span className="mx-2">»</span> {selectedNote.sub_strand || 'N/A'}</p>
                            </div>

                            <div className="border-t-2 border-black p-3">
                                <h2 className="font-black text-xs uppercase mb-1">Relevant Previous Knowledge (RPK)</h2>
                                <p className="text-sm">{selectedNote.rpk || 'N/A'}</p>
                            </div>

                            <div className="grid grid-cols-2 border-t-2 border-black">
                                <div className="border-r-2 border-black p-3">
                                    <h2 className="font-black text-xs uppercase mb-1">Core Competencies</h2>
                                    <p className="text-xs leading-relaxed">{selectedNote.core_competencies?.join(', ') || 'N/A'}</p>
                                </div>
                                <div className="p-3">
                                    <h2 className="font-black text-xs uppercase mb-1">Learning Resources (TLMs)</h2>
                                    <p className="text-xs italic">{selectedNote.tlms?.join(', ') || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="border-t-2 border-black p-3">
                                <h2 className="font-black text-xs uppercase mb-1">Learning Indicators / Objectives</h2>
                                <p className="text-sm font-bold leading-relaxed">{selectedNote.learning_indicators}</p>
                            </div>

                            <div className="border-t-2 border-black">
                                <h2 className="font-black text-xs uppercase p-3 bg-gray-50 print:bg-transparent border-b-2 border-black text-center">Presentation (Step-by-Step Activities)</h2>
                                <div className="divide-y-2 divide-black">
                                    <div className="flex bg-gray-50 print:bg-transparent">
                                        <div className="w-24 shrink-0 p-2 font-bold text-[10px] uppercase text-center border-r-2 border-black">Step</div>
                                        <div className="flex-1 p-2 font-bold text-[10px] uppercase text-center">Teacher & Learner Activities</div>
                                    </div>
                                    {selectedNote.presentation_steps.map((s, i) => (
                                        <div key={i} className="flex">
                                            <div className="w-24 shrink-0 p-3 font-black text-sm uppercase text-center border-r-2 border-black flex items-center justify-center">
                                                {s.step}
                                            </div>
                                            <div className="flex-1 p-3 text-sm leading-relaxed">
                                                {s.activity}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t-2 border-black grid grid-cols-2 divide-x-2 divide-black">
                                <div className="p-3">
                                    <h2 className="font-black text-xs uppercase mb-1">Conclusion</h2>
                                    <p className="text-xs">{selectedNote.conclusion}</p>
                                </div>
                                <div className="p-3">
                                    <h2 className="font-black text-xs uppercase mb-1">Evaluation / Remarks</h2>
                                    <p className="text-xs italic">{selectedNote.evaluation}</p>
                                </div>
                            </div>
                        </div>

                        {/* Formal Signatures */}
                        <div className="mt-12 grid grid-cols-2 gap-16 px-4">
                            <div className="text-center">
                                <div className="border-b-2 border-black mb-1 h-12"></div>
                                <p className="text-[10px] font-black uppercase">Teacher's Signature & Date</p>
                            </div>
                            <div className="text-center relative">
                                {selectedNote.status === 'approved' && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 rotate-[-12deg] border-4 border-green-600 px-6 py-2 rounded-lg text-green-600 font-black text-2xl uppercase opacity-60 pointer-events-none">
                                        Approved
                                    </div>
                                )}
                                <div className="border-b-2 border-black mb-1 h-12 flex items-center justify-center">
                                    {selectedNote.status === 'approved' && selectedNote.approved_at && (
                                        <span className="text-[10px] font-bold italic translate-y-2">Verified: {new Date(selectedNote.approved_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                                <p className="text-[10px] font-black uppercase">Headteacher's Signature & Date</p>
                            </div>
                        </div>

                        <div className="text-[10px] text-gray-400 text-center mt-12 italic border-t border-gray-100 pt-4">
                            Generated by SmartSchool DMS • Professional Ghanaian Lesson Note Management • Ref: {selectedNote.id.substring(0,8).toUpperCase()}
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
        confirmText={confirmation?.confirmText}
    />
</div>
</>
);
};

export default LessonNotesPage;
