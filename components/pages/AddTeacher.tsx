import React, { useState, FormEvent, useEffect } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { Teacher, Class, Subject, Profile } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';
import BulkImportModal, { Result } from '../common/BulkImportModal.tsx';

// Define props to include the logged-in user's profile
interface AddTeacherProps {
  profile: Profile;
  prefillProfile?: Profile;
}

const AddTeacher: React.FC<AddTeacherProps> = ({ profile, prefillProfile }) => {
  // Update initialState to include the required school_id from the profile
  const initialState: Omit<Teacher, 'id' | 'image_url'> = {
    school_id: profile.school_id,
    staff_id: '',
    full_name: prefillProfile?.full_name || '',
    date_of_birth: '',
    rank: '',
    phone_number: '',
    email: prefillProfile?.email || '',
  };

  const [formData, setFormData] = useState(initialState);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedTeachableClassIds, setSelectedTeachableClassIds] = useState<string[]>([]);
  const [homeroomClassId, setHomeroomClassId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPrerequisites, setIsFetchingPrerequisites] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Update form if prefillProfile changes (e.g. after redirection)
  useEffect(() => {
    const fetchData = async () => {
      setIsFetchingPrerequisites(true);
      setFetchError(null);
      try {
        const [classRes, subjectRes] = await Promise.all([
          supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name'),
          supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name'),
        ]);

        if (classRes.error) throw classRes.error;
        if (subjectRes.error) throw subjectRes.error;

        setClasses(classRes.data || []);
        setSubjects(subjectRes.data || []);

        // If we are editing/prefilling, fetch current assignments
        if (prefillProfile) {
          // Find the teacher record by email to get the correct ID for assignments
          const { data: teacherRecord } = await supabase
            .from('teachers')
            .select('id')
            .eq('email', prefillProfile.email)
            .single();

          const teacherIdToUse = teacherRecord?.id || prefillProfile.id;

          const [teacherClassesRes, teacherSubjectsRes] = await Promise.all([
            supabase.from('teacher_classes').select('class_id, is_homeroom').eq('teacher_id', teacherIdToUse),
            supabase.from('teacher_subjects').select('subject_id').eq('teacher_id', teacherIdToUse)
          ]);

          if (teacherClassesRes.data) {
            const classIds = teacherClassesRes.data.map(tc => tc.class_id);
            setSelectedTeachableClassIds(classIds);
            const homeroom = teacherClassesRes.data.find(tc => tc.is_homeroom);
            if (homeroom) setHomeroomClassId(homeroom.class_id);
          }
          if (teacherSubjectsRes.data) {
            setSelectedSubjects(teacherSubjectsRes.data.map(ts => ts.subject_id));
          }
        }
      } catch (err: any) {
        console.error('Error fetching prerequisites:', err);
        setFetchError(err.message || "Failed to load required data.");
      } finally {
        setIsFetchingPrerequisites(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };
  
  const handleTeachableClassChange = (classId: string) => {
    setSelectedTeachableClassIds(prev => {
        const isSelected = prev.includes(classId);
        if (isSelected) {
            // If we are un-checking the class, also ensure it's not the homeroom class
            if (homeroomClassId === classId) {
                setHomeroomClassId(null);
            }
            return prev.filter(id => id !== classId);
        } else {
            return [...prev, classId];
        }
    });
  };

  const handleHomeroomChange = (classId: string) => {
    setHomeroomClassId(classId);
    // Automatically select the class as teachable if it's made a homeroom
    if (!selectedTeachableClassIds.includes(classId)) {
        setSelectedTeachableClassIds(prev => [...prev, classId]);
    }
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    let imageUrl: string | undefined = undefined;
    if (imageFile) {
      const filePath = `teachers/${Date.now()}_${imageFile.name}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, imageFile);
      if (uploadError) {
        setMessage({ type: 'error', text: `Image upload failed: ${uploadError.message}` });
        setIsLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
    }

    const teacherData = { 
      ...formData, 
      
      image_url: imageUrl, 
      staff_id: formData.staff_id || `T-${Date.now()}` 
    };
    
    const { data: newTeacher, error: teacherError } = await supabase
      .from('teachers')
      .upsert(teacherData, { onConflict: 'email' })
      .select()
      .single();

    if (teacherError) {
      console.error("Failed to add/update teacher:", teacherError);
      setMessage({ type: 'error', text: `Failed to add teacher: ${teacherError.message}` });
      setIsLoading(false);
      return;
    }

    let hasErrors = false;
    if (newTeacher) {
      try {
        const { error: delSubjError } = await supabase.from('teacher_subjects').delete().eq('teacher_id', newTeacher.id);
        if (delSubjError) console.error('Error deleting subjects:', delSubjError);
        if (selectedSubjects.length > 0) {
          const teacherSubjects = selectedSubjects.map(subject_id => ({
            teacher_id: newTeacher.id,
            subject_id: subject_id,
            school_id: profile.school_id
          }));
          const { error: subjectsError } = await supabase.from('teacher_subjects').upsert(teacherSubjects, { onConflict: 'teacher_id,subject_id' });
          if (subjectsError) {
            console.error("Error assigning subjects:", subjectsError);
            hasErrors = true;
            setMessage({ type: 'error', text: `Teacher added, but failed to assign subjects: ${subjectsError.message}` });
          }
        }
      } catch (err) {
        console.error("Unexpected error in subject assignment:", err);
      }
    }

    if (newTeacher) {
      try {
        const { error: delClassError } = await supabase.from('teacher_classes').delete().eq('teacher_id', newTeacher.id);
        if (delClassError) console.error('Error deleting classes:', delClassError);
        if (selectedTeachableClassIds.length > 0) {
          const teacherClasses = selectedTeachableClassIds.map(class_id => ({
            teacher_id: newTeacher.id,
            class_id: class_id,
            is_homeroom: class_id === homeroomClassId,
            school_id: profile.school_id
          }));
          const { error: classesError } = await supabase.from('teacher_classes').upsert(teacherClasses, { onConflict: 'teacher_id,class_id' });
          if (classesError) {
            console.error("Error assigning classes:", classesError);
            hasErrors = true;
            setMessage({ type: 'error', text: `Teacher added, but failed to assign classes: ${classesError.message}` });
          }
        }
      } catch (err) {
        console.error("Unexpected error in class assignment:", err);
      }
    }

    if (!hasErrors) {
        setMessage({ type: 'success', text: `Successfully added teacher ${newTeacher.full_name}.` });
        setFormData(initialState);
        setImageFile(null);
        setSelectedSubjects([]);
        setSelectedTeachableClassIds([]);
        setHomeroomClassId(null);
    }
    setIsLoading(false);
  };

  const handleTeacherBulkImport = (file: File): Promise<Result> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          resolve({ successes: [], failures: [{ row: 1, reason: 'Could not read file content.', data: '' }] });
          return;
        }
        
        const allRows = content.split('\n').map((row: string) => row.trim()).filter(row => row);
        const rows = allRows.slice(1);

        const results: Result = { successes: [], failures: [] };
        const newTeachers: Omit<Teacher, 'id' | 'image_url'>[] = [];

        for (let i = 0; i < rows.length; i++) {
          const rowData = rows[i];
          const [staff_id, full_name, email, date_of_birth, rank, phone_number] = rowData.split(',');

          if (!staff_id || !full_name || !email || !date_of_birth || !rank || !phone_number) {
            results.failures.push({ row: i + 2, reason: 'Missing required fields.', data: rowData });
            continue;
          }

          // Added school_id to bulk import data
          newTeachers.push({
            school_id: profile.school_id, staff_id: staff_id.trim(),
            full_name: full_name.trim(),
            email: email.trim(),
            date_of_birth: date_of_birth.trim(),
            rank: rank.trim(),
            phone_number: phone_number.trim(),
          });
        }

        if (newTeachers.length > 0) {
          const { error } = await supabase.from('teachers').upsert(newTeachers, { onConflict: 'email' });
          if (error) {
            results.failures.push({ row: 0, reason: `Database error: ${error.message}`, data: 'ALL' });
          } else {
            newTeachers.forEach(t => results.successes.push(t.full_name));
          }
        }
        resolve(results);
      };
      reader.onerror = () => {
        resolve({ successes: [], failures: [{ row: 1, reason: 'Error reading file.', data: '' }] });
      };
      reader.readAsText(file);
    });
  };
  
  const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

  if (fetchError) {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Add New Teacher</h1>
            <div className="p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">{fetchError}</div>
        </div>
    );
  }

  if (isFetchingPrerequisites) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Add New Teacher</h1>
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add New Teacher</h1>
        <button
          onClick={() => setIsBulkModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
        >
          Bulk Add Teachers
        </button>
      </div>

      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImport={handleTeacherBulkImport}
        title="Bulk Add Teachers"
        templateHeaders={[
          'staff_id', 'full_name', 'email', 'date_of_birth (YYYY-MM-DD)', 'rank', 'phone_number'
        ]}
        templateFileName="teachers_template.csv"
      />
      
      {message && (
        <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Teacher's Details</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff ID *</label>
                <input type="text" name="staff_id" required value={formData.staff_id} onChange={handleChange} className={inputClasses} placeholder="e.g., T-12345"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} className={inputClasses} placeholder="e.g., John Smith"/>
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  value={formData.email} 
                  onChange={handleChange} 
                  className={`${inputClasses} ${prefillProfile ? 'bg-gray-200 cursor-not-allowed opacity-75' : ''}`} 
                  placeholder="teacher@example.com"
                  readOnly={!!prefillProfile}
                />
                {prefillProfile && (
                  <p className="text-[10px] text-gray-500 mt-1 italic">Email is locked to the user's account.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth *</label>
                <input type="date" name="date_of_birth" required value={formData.date_of_birth} onChange={handleChange} className={inputClasses}/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rank *</label>
                <input 
                  type="text" 
                  name="rank" 
                  required 
                  value={formData.rank} 
                  onChange={handleChange} 
                  className={inputClasses} 
                  placeholder="e.g., Senior Superintendent I"
                  list="rank-suggestions"
                />
                <datalist id="rank-suggestions">
                  <option value="Director-General" />
                  <option value="Deputy Director-General" />
                  <option value="Director I" />
                  <option value="Director II" />
                  <option value="Deputy Director" />
                  <option value="Assistant Director I" />
                  <option value="Assistant Director II" />
                  <option value="Principal Superintendent" />
                  <option value="Senior Superintendent I" />
                  <option value="Senior Superintendent II" />
                  <option value="Superintendent I" />
                  <option value="Superintendent II" />
                  <option value="Teacher" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                <input type="tel" name="phone_number" required value={formData.phone_number} onChange={handleChange} className={inputClasses} placeholder="e.g., 0201234567"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher's Photo</label>
              <ImageUpload onFileChange={setImageFile} />
            </div>
          </div>
        </div>

        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
           <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Class Assignments</h2>
           <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select all classes the teacher will teach in, and then choose one to be their homeroom class.</p>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {classes.map(cls => (
                <div key={cls.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`class-check-${cls.id}`}
                    checked={selectedTeachableClassIds.includes(cls.id)}
                    onChange={() => handleTeachableClassChange(cls.id)}
                    className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                  />
                  <label htmlFor={`class-check-${cls.id}`} className="text-sm text-gray-700 dark:text-gray-300 flex-grow">{cls.name}</label>
                  <input
                    type="radio"
                    id={`homeroom-radio-${cls.id}`}
                    name="homeroom-class"
                    value={cls.id}
                    checked={homeroomClassId === cls.id}
                    onChange={() => handleHomeroomChange(cls.id)}
                    disabled={!selectedTeachableClassIds.includes(cls.id)}
                    className="h-4 w-4 text-brand-600 border-gray-300 focus:ring-brand-500 disabled:opacity-50"
                    title={selectedTeachableClassIds.includes(cls.id) ? "Set as homeroom" : "Class must be selected first"}
                  />
                </div>
              ))}
           </div>
        </div>

        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
           <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Assign Subjects</h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {subjects.map(subject => (
                <label key={subject.id} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject.id)}
                    onChange={() => handleSubjectChange(subject.id)}
                    className="h-4 w-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{subject.name}</span>
                </label>
              ))}
           </div>
        </div>
        
        <div className="flex justify-end">
          <button type="submit" disabled={isLoading} className="inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50">
            {isLoading ? 'Submitting...' : 'Add Teacher'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTeacher;