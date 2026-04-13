import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { StudentProfile, StudentAssessment, StudentAttendance, Class, Profile } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';

interface StudentProfilePageProps {
    studentId: string;
    onBack: () => void;
    profile: Profile;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ studentId, onBack, profile: userProfile }) => {
    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [assessments, setAssessments] = useState<(StudentAssessment & { subject: { name: string } })[]>([]);
    const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
    const [allClasses, setAllClasses] = useState<Class[]>([]);
    const [academicYears, setAcademicYears] = useState<number[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'details' | 'academics' | 'attendance'>('details');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<StudentProfile>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    
    // Filters
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedTerm, setSelectedTerm] = useState<string>('Term 1');
    const [attendanceStartDate, setAttendanceStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [attendanceEndDate, setAttendanceEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const fetchStudentProfile = useCallback(async () => {
        if (!userProfile?.school_id) {
            setError("School ID not found in profile.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const [studentRes, classesRes, yearsRes] = await Promise.all([
                supabase.from('students').select('*, class:classes(id, name)').eq('id', studentId).eq('school_id', userProfile.school_id).single(),
                supabase.from('classes').select('*').eq('school_id', userProfile.school_id).order('name'),
                supabase.from('student_assessments').select('year').eq('student_id', studentId).eq('school_id', userProfile.school_id)
            ]);
            
            if (studentRes.error) throw studentRes.error;
            setStudent(studentRes.data as StudentProfile);
            setFormData(studentRes.data);
            setAllClasses(classesRes.data || []);

            // Set available academic years for the filter dropdown
            if (yearsRes.data) {
                const years = new Set(yearsRes.data.map(a => a.year));
                const sortedYears = Array.from(years).filter((y): y is number => y != null).sort((a, b) => b - a);
                setAcademicYears(sortedYears);
                if (sortedYears.length > 0) {
                    setSelectedYear(sortedYears[0]);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        fetchStudentProfile();
    }, [fetchStudentProfile]);

    // Fetch assessments only when the academics tab is active or filters change
    useEffect(() => {
        const fetchAssessments = async () => {
            if (activeTab !== 'academics' || !studentId || !selectedYear || !selectedTerm) {
                setAssessments([]); // Clear data if tab is not active
                return;
            }
            if (!student?.class?.id) {
                setAssessments([]);
                return;
            }
            setIsLoading(true);
            const { data, error: fetchError } = await supabase
                .from('student_assessments')
                .select('*, subject:subjects(name)')
                .eq('student_id', studentId)
                .eq('year', selectedYear)
                .eq('term', selectedTerm)
                .eq('school_id', userProfile.school_id);

            if (fetchError) setError(fetchError.message);
            else setAssessments((data as any[]) || []);
            setIsLoading(false);
        };
        fetchAssessments();
    }, [activeTab, studentId, selectedYear, selectedTerm, student]);

    // Fetch attendance only when the attendance tab is active or filters change
    useEffect(() => {
        const fetchAttendance = async () => {
            if (activeTab !== 'attendance' || !studentId || !attendanceStartDate || !attendanceEndDate) {
                setAttendance([]); // Clear data if tab is not active
                return;
            }
            setIsLoading(true);
            const { data, error: fetchError } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('school_id', userProfile.school_id)
                .gte('attendance_date', attendanceStartDate)
                .lte('attendance_date', attendanceEndDate)
                .order('attendance_date', { ascending: true });

            if (fetchError) setError(fetchError.message);
            else setAttendance(data || []);
            setIsLoading(false);
        };
        fetchAttendance();
    }, [activeTab, studentId, attendanceStartDate, attendanceEndDate]);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'class_id') {
            const selectedClass = allClasses.find(c => c.id === value) || null;
            setFormData(prev => ({ ...prev, class: selectedClass }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);
        setError(null);
        try {
            let imageUrl = formData.image_url;
            if (imageFile) {
                const filePath = `students/${Date.now()}_${imageFile.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, imageFile, { upsert: true });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                imageUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            const { id, class: studentClass, ...updateData } = formData;
            const updatePayload = {
                ...updateData,
                class_id: formData.class?.id || null,
                image_url: imageUrl,
            };

            const { error: updateError } = await supabase.from('students').update(updatePayload).eq('id', studentId);
            if (updateError) throw updateError;
            
            setMessage('Profile updated successfully.');
            await fetchStudentProfile();
            setIsEditing(false);
            setImageFile(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const inputClasses = "block w-full p-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";
    const readOnlyClasses = `${inputClasses} bg-gray-100 dark:bg-gray-800 cursor-not-allowed`;

    if (isLoading && !student) return <p>Loading student profile...</p>;
    if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-md">Error: {error}</div>
    if (!student) return <p>Student not found.</p>;

    return (
        <div>
            <button onClick={onBack} className="flex items-center text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 mb-4">
                &larr; Back to Student List
            </button>
            {message && <div className="p-4 rounded-md mb-4 bg-green-100 text-green-800">{message}</div>}

            <form onSubmit={handleSave}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                            {formData.image_url ? <img src={formData.image_url} alt={student.full_name} className="w-full h-full object-cover" /> : null}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{student.full_name}</h1>
                            <p className="text-gray-600 dark:text-gray-300">{student.admission_number} &bull; {student.class?.name || 'No Class'}</p>
                        </div>
                    </div>
                    <div>
                        {!isEditing ? (
                            <button type="button" onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">Edit Profile</button>
                        ) : (
                            <div className="flex gap-2">
                                <button type="button" onClick={() => { setIsEditing(false); setFormData(student); }} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-md">Cancel</button>
                                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm text-white bg-brand-600 rounded-md disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b dark:border-gray-700 mb-6">
                    <nav className="flex space-x-4">
                        {['details', 'academics', 'attendance'].map(tab => (
                            <button key={tab} type="button" onClick={() => setActiveTab(tab as any)} className={`px-3 py-2 font-medium text-sm rounded-t-md ${activeTab === tab ? 'border-b-2 border-brand-500 text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Tab Content */}
                {activeTab === 'details' && (
                    <div className="space-y-6">
                         {isEditing && (
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <h3 className="text-lg font-semibold mb-2">Profile Picture</h3>
                                <ImageUpload onFileChange={setImageFile} defaultImageUrl={formData.image_url} />
                            </div>
                        )}
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Student Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="text-xs">Full Name</label><input type="text" name="full_name" value={formData.full_name || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                                <div><label className="text-xs">Date of Birth</label><input type="date" name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                                <div><label className="text-xs">Gender</label><select name="gender" value={formData.gender} onChange={handleFormChange} disabled={!isEditing} className={isEditing ? inputClasses : readOnlyClasses}><option>Male</option><option>Female</option></select></div>
                                <div><label className="text-xs">Class</label><select name="class_id" value={formData.class?.id || ''} onChange={handleFormChange} disabled={!isEditing} className={isEditing ? inputClasses : readOnlyClasses}><option value="">-- No Class --</option>{allClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                <div><label className="text-xs">NHIS Number</label><input type="text" name="nhis_number" value={formData.nhis_number || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                            </div>
                        </div>
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4">Guardian Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className="text-xs">Guardian Name</label><input type="text" name="guardian_name" value={formData.guardian_name || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                                <div><label className="text-xs">Guardian Contact</label><input type="text" name="guardian_contact" value={formData.guardian_contact || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                                <div><label className="text-xs">GPS Address</label><input type="text" name="gps_address" value={formData.gps_address || ''} onChange={handleFormChange} readOnly={!isEditing} className={isEditing ? inputClasses : readOnlyClasses} /></div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'academics' && (
                    <div>
                        <div className="flex gap-4 mb-4">
                             <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={inputClasses}><option value="">All Years</option>{academicYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                            <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className={inputClasses}><option value="Term 1">Term 1</option><option value="Term 2">Term 2</option><option value="Term 3">Term 3</option></select>
                        </div>
                        {isLoading ? <p>Loading academic data...</p> : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-2 text-left">Subject</th><th className="p-2 text-center">CA Score</th><th className="p-2 text-center">Exam Score</th><th className="p-2 text-center">Total</th><th className="p-2 text-left">Remarks</th></tr></thead>
                                <tbody>{assessments.map(a => <tr key={a.id} className="border-b dark:border-gray-700">
                                    <td className="p-2 font-medium">{a.subject.name}</td>
                                    <td className="p-2 text-center">{a.continuous_assessment_score} / 60</td>
                                    <td className="p-2 text-center">{a.exam_score} / 40</td>
                                    <td className="p-2 text-center font-bold">{a.total_score} / 100</td>
                                    <td className="p-2">{a.remarks}</td></tr>)}
                                </tbody>
                            </table>
                        )}
                        {!isLoading && assessments.length === 0 && <p className="p-4 text-center text-gray-500">No assessment data for the selected period.</p>}
                    </div>
                )}
                 
                {activeTab === 'attendance' && (
                     <div>
                        <div className="flex gap-4 mb-4">
                            <input type="date" value={attendanceStartDate} onChange={e => setAttendanceStartDate(e.target.value)} className={inputClasses}/>
                            <input type="date" value={attendanceEndDate} onChange={e => setAttendanceEndDate(e.target.value)} className={inputClasses}/>
                        </div>
                        {isLoading ? <p>Loading attendance data...</p> : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Status</th></tr></thead>
                                <tbody>{attendance.map(a => <tr key={a.id} className="border-b dark:border-gray-700">
                                    <td className="p-2">{new Date(a.attendance_date).toLocaleDateString()}</td>
                                    <td className={`p-2 font-medium ${a.status === 'Present' ? 'text-green-600' : a.status === 'Late' ? 'text-yellow-600' : 'text-red-600'}`}>{a.status}</td>
                                </tr>)}
                                </tbody>
                            </table>
                        )}
                        {!isLoading && attendance.length === 0 && <p className="p-4 text-center text-gray-500">No attendance data for the selected period.</p>}
                     </div>
                )}

            </form>
        </div>
    );
};

export default StudentProfilePage;