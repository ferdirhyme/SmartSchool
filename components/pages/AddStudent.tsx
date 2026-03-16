
import React, { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Student, Class, Profile } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';
import BulkImportModal, { Result } from '../common/BulkImportModal.tsx';

// Define props to include the logged-in user's profile
interface AddStudentProps {
  profile: Profile;
}

const AddStudent: React.FC<AddStudentProps> = ({ profile }) => {
  // Update initialState to include the required school_id from the profile
  const initialState: Omit<Student, 'id' | 'image_url' | 'admission_number'> = {
    school_id: profile.school_id,
    full_name: '',
    date_of_birth: '',
    gender: 'Male',
    nhis_number: '',
    guardian_name: '',
    guardian_contact: '',
    gps_address: '',
    class_id: null,
  };
  const [formData, setFormData] = useState(initialState);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isFetchingPrerequisites, setIsFetchingPrerequisites] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsFetchingPrerequisites(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name');
        if (error) throw error;
        setClasses(data || []);
      } catch (err: any) {
        setFetchError(err.message || "Failed to load class data.");
      } finally {
        setIsFetchingPrerequisites(false);
      }
    };
    fetchClasses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.full_name || !formData.date_of_birth || !formData.guardian_name || !formData.guardian_contact) {
        setMessage({ type: 'error', text: 'Please fill in all required fields.' });
        return;
    }

    setIsLoading(true);
    
    // Generate a unique admission number
    const admission_number = `SS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const studentData: Partial<Student> = { ...formData, admission_number };

    // Handle image upload
    if (imageFile) {
      const filePath = `students/${Date.now()}_${imageFile.name}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, imageFile);

      if (uploadError) {
        setMessage({ type: 'error', text: `Failed to upload image: ${uploadError.message}` });
        setIsLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      studentData.image_url = urlData.publicUrl;
    }


    const { error } = await supabase.from('students').insert([studentData]);

    if (error) {
      setMessage({ type: 'error', text: `Failed to add student: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: `Successfully added ${studentData.full_name} with admission number ${admission_number}.` });
      setFormData(initialState);
      setImageFile(null);
    }
    setIsLoading(false);
  };

  const handleStudentBulkImport = async (file: File): Promise<Result> => {
    try {
      const content = await file.text();

      const allRows = content.split('\n').map((row) => row.trim()).filter((row) => row);
      const rows = allRows.slice(1);
      
      const results: Result = {
        successes: [],
        failures: [],
      };
      
      const newStudents: Omit<Student, 'id' | 'image_url'>[] = [];
      // Explicitly type the Map to ensure get() returns string | undefined, avoiding 'unknown'
      const classMap = new Map<string, string>(classes.map(c => [c.name.toLowerCase(), c.id]));

      for (let i = 0; i < rows.length; i++) {
          const rowData = rows[i];
          const values = rowData.split(',');
          const [full_name, date_of_birth, gender, guardian_name, guardian_contact, className, nhis_number, gps_address] = values;

          if (!full_name || !date_of_birth || !gender || !guardian_name || !guardian_contact) {
              results.failures.push({ row: i + 2, reason: 'Missing required fields.', data: rowData });
              continue;
          }

          const class_id = className ? classMap.get(className.trim().toLowerCase()) : null;
          if (className && !class_id) {
              results.failures.push({ row: i + 2, reason: `Class '${className}' not found.`, data: rowData });
              continue;
          }

          // Added school_id to bulk import data
          newStudents.push({
              school_id: profile.school_id,
              full_name: full_name.trim(),
              date_of_birth: date_of_birth.trim(),
              gender: (gender.trim() === 'Male' || gender.trim() === 'Female') ? gender.trim() as 'Male' : 'Male',
              guardian_name: guardian_name.trim(),
              guardian_contact: guardian_contact.trim(),
              class_id: class_id || null,
              nhis_number: nhis_number?.trim() || '',
              gps_address: gps_address?.trim() || '',
              admission_number: `SS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${i}`
          });
      }
      
      if (newStudents.length > 0) {
          const { error } = await supabase.from('students').insert(newStudents);
          if (error) {
              results.failures.push({ row: 0, reason: `Database error: ${error.message}`, data: 'ALL' });
          } else {
              newStudents.forEach(s => results.successes.push(s.full_name));
          }
      }
      return results;
    }
    catch (err: unknown) {
      const reason = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'An unknown error occurred.');
      return { successes: [], failures: [{ row: 1, reason, data: '' }] };
    }
  };
  
  const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

  if (fetchError) {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Admit New Student</h1>
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">{fetchError}</div>
        </div>
    );
  }

  if (isFetchingPrerequisites) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Admit New Student</h1>
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading form prerequisites...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admit New Student</h1>
        <button
          onClick={() => setIsBulkModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
        >
          Bulk Add Students
        </button>
      </div>

      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImport={handleStudentBulkImport}
        title="Bulk Add Students"
        templateHeaders={[
          'full_name', 'date_of_birth (YYYY-MM-DD)', 'gender (Male/Female)', 'guardian_name', 'guardian_contact',
          'class_name (optional)', 'nhis_number (optional)', 'gps_address (optional)'
        ]}
        templateFileName="students_template.csv"
      />
      
      {message && (
        <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Student Information */}
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Student Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Core details */}
            <div className="space-y-6">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input type="text" name="full_name" id="full_name" required value={formData.full_name} onChange={handleChange} className={inputClasses} placeholder="e.g., Jane Doe" />
              </div>
              <div>
                <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth *</label>
                <input type="date" name="date_of_birth" id="date_of_birth" required value={formData.date_of_birth} onChange={handleChange} className={inputClasses} />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender *</label>
                <select name="gender" id="gender" required value={formData.gender} onChange={handleChange} className={inputClasses}>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Class</label>
                <select name="class_id" id="class_id" value={formData.class_id || ''} onChange={handleChange} className={inputClasses}>
                  <option value="">-- Not Assigned --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {/* Column 2: Other details and Photo */}
            <div className="space-y-6">
              <div>
                <label htmlFor="nhis_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NHIS Number</label>
                <input type="text" name="nhis_number" id="nhis_number" value={formData.nhis_number || ''} onChange={handleChange} className={inputClasses} placeholder="e.g., 12345678"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student's Photo</label>
                <ImageUpload onFileChange={setImageFile} />
              </div>
            </div>
          </div>
        </div>

        {/* Guardian Information */}
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
           <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Guardian Details</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="guardian_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Name *</label>
              <input type="text" name="guardian_name" id="guardian_name" required value={formData.guardian_name} onChange={handleChange} className={inputClasses} placeholder="e.g., Mary Smith"/>
            </div>
            <div>
              <label htmlFor="guardian_contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Contact *</label>
              <input type="tel" name="guardian_contact" id="guardian_contact" required value={formData.guardian_contact} onChange={handleChange} className={inputClasses} placeholder="e.g., 0244123456"/>
            </div>
             <div>
              <label htmlFor="gps_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GPS Address</label>
              <input type="text" name="gps_address" id="gps_address" value={formData.gps_address || ''} onChange={handleChange} className={inputClasses} placeholder="e.g., GA-123-4567"/>
            </div>
           </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50"
          >
            {isLoading ? 'Submitting...' : 'Admit Student'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStudent;
