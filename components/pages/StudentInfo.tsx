import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { StudentProfile, Class, Profile } from '../../types.ts';
import StudentProfilePage from './StudentProfilePage.tsx';
import { Users, School, UserCheck, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';

interface StudentInfoProps {
    profile: Profile;
}

const StudentInfo: React.FC<StudentInfoProps> = ({ profile }) => {
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!profile?.school_id) return;
            setIsLoading(true);
            try {
                const [studentsRes, classesRes] = await Promise.all([
                    supabase.from('students').select('*, class:classes(id, name)').eq('school_id', profile.school_id).order('full_name'),
                    supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name')
                ]);

                if (studentsRes.error) throw studentsRes.error;
                if (classesRes.error) throw classesRes.error;

                setStudents(studentsRes.data as StudentProfile[] || []);
                setClasses(classesRes.data as Class[] || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const total = students.length;
        const byClass = classes.map(cls => ({
            ...cls,
            count: students.filter(s => s.class_id === cls.id).length
        }));
        const unassigned = students.filter(s => !s.class_id).length;
        
        const maleCount = students.filter(s => s.gender === 'Male').length;
        const femaleCount = students.filter(s => s.gender === 'Female').length;

        return { total, byClass, unassigned, maleCount, femaleCount };
    }, [students, classes]);

    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                student.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;
            return matchesSearch && matchesClass;
        });
    }, [students, searchTerm, selectedClass]);

    if (!profile?.school_id) {
        return <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
            <p className="font-bold">Access Error</p>
            <p className="text-sm">Your profile is not correctly linked to a school. Please contact support.</p>
        </div>;
    }

    if (viewingStudentId) {
        return <StudentProfilePage studentId={viewingStudentId} onBack={() => setViewingStudentId(null)} profile={profile} />;
    }

    if (isLoading) {
        return <p>Loading students...</p>;
    }
    
    if (error) {
        return <p className="text-red-500">Error: {error}</p>;
    }
    
    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Student Information</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm">
                    <UserCheck className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{stats.total} Total Enrolled</span>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl">
                            <Users className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Enrollment</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</h3>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{stats.maleCount} Boys</span>
                        <span className="text-pink-600 dark:text-pink-400 font-medium">{stats.femaleCount} Girls</span>
                    </div>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                            <School className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Classes</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{classes.length}</h3>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Average {stats.total > 0 ? Math.round(stats.total / classes.length) : 0} students per class
                    </p>
                </motion.div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
                            <Filter className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unassigned</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unassigned}</h3>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Students without a class assignment
                    </p>
                </motion.div>
            </div>

            {/* Class Breakdown */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Class Enrollment Breakdown</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {stats.byClass.map((cls) => (
                        <div 
                            key={cls.id} 
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                selectedClass === cls.id 
                                ? 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800' 
                                : 'bg-gray-50 border-gray-100 dark:bg-gray-700/30 dark:border-gray-600 hover:border-brand-200'
                            }`}
                            onClick={() => setSelectedClass(selectedClass === cls.id ? 'all' : cls.id)}
                        >
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{cls.name}</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{cls.count}</p>
                            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 h-1 rounded-full overflow-hidden">
                                <div 
                                    className="bg-brand-500 h-full" 
                                    style={{ width: `${stats.total > 0 ? (cls.count / stats.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name or admission number..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                </div>
                <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                >
                    <option value="all">All Classes</option>
                    {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                </select>
            </div>
            
            <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-4">Full Name</th>
                            <th scope="col" className="px-6 py-4">Admission No.</th>
                            <th scope="col" className="px-6 py-4">Class</th>
                            <th scope="col" className="px-6 py-4">Guardian</th>
                            <th scope="col" className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-600">
                                            {student.image_url ? (
                                                <img src={student.image_url} alt={student.full_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                        <span>{student.full_name}</span>
                                    </div>
                                </th>
                                <td className="px-6 py-4">{student.admission_number}</td>
                                <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">
                                        {student.class?.name || 'Unassigned'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{student.guardian_name}</td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => setViewingStudentId(student.id)} 
                                        className="inline-flex items-center px-3 py-1.5 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors text-xs font-semibold"
                                    >
                                        View Profile
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredStudents.length === 0 && !isLoading && (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No students found matching your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentInfo;