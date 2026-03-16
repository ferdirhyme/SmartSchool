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
            if (profile.role === UserRole.Teacher) {
                const { data: teacherId, error: rpcError } = await supabase
                    .rpc('get_teacher_id_by_auth_email');
                
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
            if (imageFile && (profile.role === UserRole.Student || profile.role === UserRole.Teacher)) {
                const filePath = `${profile.role.toLowerCase()}s/${detailedProfile.id}`;
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
            if (profile.role === UserRole.Teacher) {
                const { id, created_at, email, image_url, ...teacherData } = formData;
                const { error: teacherError } = await supabase.from('teachers').update({ ...teacherData, image_url: imageUrl }).eq('id', detailedProfile.id);
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
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";
    const readOnlyClasses = `${inputClasses} bg-gray-200 dark:bg-gray-800 cursor-not-allowed`;

    const renderField = (label: string, name: keyof any, type = 'text', readOnly = !isEditing) => {
        const value = formData[name] || '';
        if (type === 'select') {
             return (
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                    <select name={name as string} value={value} onChange={handleFormChange} disabled={readOnly} className={readOnly ? readOnlyClasses : inputClasses}>
                        <option>Male</option>
                        <option>Female</option>
                    </select>
                </div>
             );
        }
        return (
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                <input type={type} name={name as string} value={value} onChange={handleFormChange} readOnly={readOnly} className={readOnly ? readOnlyClasses : inputClasses} />
            </div>
        );
    };

    if (isLoading) return <p>Loading profile...</p>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">
                        Edit Profile
                    </button>
                )}
            </div>

            {message && (
                <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}
            
            <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Image Column */}
                    {(profile.role === UserRole.Student || profile.role === UserRole.Teacher) && (
                        <div className="lg:col-span-1">
                             <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Profile Picture</h2>
                                {isEditing ? (
                                    <ImageUpload onFileChange={setImageFile} defaultImageUrl={formData.image_url} />
                                ) : (
                                    <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                        {formData.image_url ? (
                                            <img src={formData.image_url} alt={formData.full_name} className="w-full h-full object-cover"/>
                                        ) : (
                                            <div className="text-center text-gray-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                <span className="mt-2 block text-sm font-medium">No Image</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                             </div>
                        </div>
                    )}
                    
                    {/* Form Fields Column */}
                    <div className={(profile.role === UserRole.Student || profile.role === UserRole.Teacher) ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg space-y-6">
                            {/* Common Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderField("Full Name", "full_name")}
                                {renderField("Email Address", "email", 'email', true)}
                            </div>
                            
                            {/* Role-Specific Fields */}
                            {profile.role === UserRole.Teacher && (
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
                                <h2 className="text-xl font-semibold pt-4 border-t dark:border-gray-600">Guardian Details</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {renderField("Guardian Name", "guardian_name")}
                                    {renderField("Guardian Contact", "guardian_contact", 'tel')}
                                    {renderField("GPS Address", "gps_address")}
                                </div>
                                </>
                            )}
                            {profile.role === UserRole.Parent && (
                                <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Ward's Admission Number(s)
                                    </label>
                                {isEditing ? (
                                        <p className="text-xs text-gray-500">Editing admission numbers is not supported yet.</p>
                                ) : (
                                        <p>{(formData.admission_numbers || []).join(', ')}</p>
                                )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isEditing && (
                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={handleCancel} className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-500">Cancel</button>
                        <button type="submit" disabled={isSaving} className="px-6 py-3 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ProfilePage;