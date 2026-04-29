import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { Profile, UserRole, Teacher, Student, StudentProfile } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';

interface ProfilePageProps {
  session: Session;
  profile: Profile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ session, profile }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // This will hold the detailed profile from tables like 'teachers' or 'students'
    const [detailedProfile, setDetailedProfile] = useState<any | null>(null);
    // This will hold form data during editing
    const [formData, setFormData] = useState<any>({});
    // State for the new image file
    const [imageFile, setImageFile] = useState<File | null>(null);

    const fetchDetailedProfile = useCallback(async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            let fetchedProfile = null;
            if (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) {
                const { data: teacherIdData, error: rpcError } = await supabase
                    .rpc('get_teacher_id_by_auth_email');
                
                let teacherId = teacherIdData;
                if (teacherId === 'null') teacherId = null;

                if (rpcError || !teacherId) {
                    throw new Error("Could not find your teacher profile. This is likely a database permission issue. Please contact your administrator and ask them to run the required setup script from the Settings > Advanced page.");
                }
                const { data, error } = await supabase.from('teachers').select('*').eq('id', teacherId).single();
                if (error) throw error;
                fetchedProfile = data;
            } else if (profile.role === UserRole.Student) {
                const admissionNumber = profile.admission_numbers?.[0];
                if (!admissionNumber) throw new Error("Student admission number not found in your profile.");
                const { data, error } = await supabase.from('students').select('*, class:classes(id, name)').eq('admission_number', admissionNumber).single();
                if (error) throw error;
                fetchedProfile = data;
            } else if (profile.role === UserRole.Parent) {
                // Parent data is mostly in the main profile
                fetchedProfile = { ...profile };
            }
            
            setDetailedProfile(fetchedProfile);
            setFormData({ ...profile, ...fetchedProfile });

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to load profile details.' });
        } finally {
            setIsLoading(false);
        }
    }, [profile, session.user.id]);

    useEffect(() => {
        fetchDetailedProfile();
    }, [fetchDetailedProfile]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            let imageUrl = formData.image_url;

            // Handle image upload if a new file is selected
            if (imageFile && (profile.role === UserRole.Student || profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher)) {
                const folder = (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) ? 'teachers' : 'students';
                const filePath = `${folder}/${detailedProfile.id}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, imageFile, { upsert: true });

                if (uploadError) throw uploadError;
                
                // Get public URL and add a timestamp to prevent caching issues
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                imageUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            }

            // Step 1: Update the central `profiles` table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    full_name: formData.full_name, 
                    admission_numbers: formData.admission_numbers,
                    avatar_url: imageUrl 
                })
                .eq('id', session.user.id);
            if (profileError) throw profileError;

            // Step 2: Update the role-specific table
            if (profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) {
                const teacherUpdate = {
                    full_name: formData.full_name,
                    date_of_birth: formData.date_of_birth,
                    rank: formData.rank,
                    phone_number: formData.phone_number,
                    image_url: imageUrl
                };
                const { error: teacherError } = await supabase.from('teachers').update(teacherUpdate).eq('id', detailedProfile.id);
                if (teacherError) throw teacherError;
            }
            if (profile.role === UserRole.Student) {
                const { id, created_at, image_url, admission_number, class: studentClass, ...studentData } = formData;
                const { error: studentError } = await supabase.from('students').update({ ...studentData, image_url: imageUrl }).eq('id', detailedProfile.id);
                if (studentError) throw studentError;
            }
            
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);
            setImageFile(null); // Reset file state
            await fetchDetailedProfile(); // Refresh data
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCancel = () => {
        setIsEditing(false);
        setImageFile(null); // Reset file state
        setFormData({ ...profile, ...detailedProfile }); // Reset form to original data
    };
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all";
    const readOnlyClasses = `${inputClasses} bg-gray-100 dark:bg-gray-800/80 cursor-not-allowed opacity-70`;

    const renderField = (label: string, name: keyof any, type = 'text', readOnly = !isEditing) => {
        const value = formData[name] || '';
        if (type === 'select') {
             return (
                 <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                    <select name={name as string} value={value} onChange={handleFormChange} disabled={readOnly} className={readOnly ? readOnlyClasses : inputClasses}>
                        <option>Male</option>
                        <option>Female</option>
                    </select>
                </div>
             );
        }
        return (
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                <input type={type} name={name as string} value={value} onChange={handleFormChange} readOnly={readOnly} className={readOnly ? readOnlyClasses : inputClasses} />
            </div>
        );
    };

    if (isLoading) return (
        <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-all active:scale-[0.98] shadow-sm">
                        Edit Profile
                    </button>
                )}
            </div>

            {message && (
                <div className={`p-4 rounded-xl border mb-6 font-medium ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300'}`}>
                    {message.text}
                </div>
            )}
            
            <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Image Column */}
                    {(profile.role === UserRole.Student || profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) && (
                        <div className="lg:col-span-1">
                             <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Profile Picture</h2>
                                {isEditing ? (
                                    <ImageUpload onFileChange={setImageFile} defaultImageUrl={formData.image_url} />
                                ) : (
                                    <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center border border-gray-100 dark:border-gray-700">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} alt={formData.full_name} className="w-full h-full object-cover"/>
                                        ) : (
                                            <div className="text-center text-gray-400 dark:text-gray-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                <span className="block text-sm font-bold">No Image</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                             </div>
                        </div>
                    )}
                    
                    {/* Form Fields Column */}
                    <div className={(profile.role === UserRole.Student || profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm space-y-8">
                            {/* Common Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderField("Full Name", "full_name")}
                                {renderField("Email Address", "email", 'email', true)}
                            </div>
                            
                            {/* Role-Specific Fields */}
                            {(profile.role === UserRole.Teacher || profile.role === UserRole.Headteacher) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderField("Date of Birth", "date_of_birth", 'date')}
                                    {renderField("Phone Number", "phone_number", 'tel')}
                                    {renderField("Rank", "rank")}
                                </div>
                            )}
                            {profile.role === UserRole.Student && (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderField("Date of Birth", "date_of_birth", 'date')}
                                    {renderField("Gender", "gender", 'select')}
                                    {renderField("NHIS Number", "nhis_number")}
                                </div>
                                <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Guardian Details</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {renderField("Guardian Name", "guardian_name")}
                                        {renderField("Guardian Contact", "guardian_contact", 'tel')}
                                        {renderField("GPS Address", "gps_address")}
                                    </div>
                                </div>
                                </>
                            )}
                            {profile.role === UserRole.Parent && (
                                <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Ward's Admission Number(s)
                                    </label>
                                {isEditing ? (
                                        <p className="text-sm text-gray-500 font-medium">Editing admission numbers is not supported yet.</p>
                                ) : (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl font-mono text-sm">
                                            {(formData.admission_numbers || []).join(', ')}
                                        </div>
                                )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isEditing && (
                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button type="button" onClick={handleCancel} className="px-6 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ProfilePage;