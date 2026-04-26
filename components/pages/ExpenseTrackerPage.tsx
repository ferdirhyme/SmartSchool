
import React, { useState, useEffect } from 'react';
import { Plus, Search, TrendingDown, Award, Loader2, Calendar, Filter, PieChart, ArrowDownRight, ArrowUpRight, DollarSign, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Expense, Scholarship, Student } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';

interface ExpenseTrackerPageProps {
    profile: Profile;
}

const ExpenseTrackerPage: React.FC<ExpenseTrackerPageProps> = ({ profile }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [scholarships, setScholarships] = useState<Scholarship[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'expenses' | 'scholarships'>('expenses');
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [showAddScholarship, setShowAddScholarship] = useState(false);

    // Form states
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        category: 'Maintenance',
        amount: 0,
        description: '',
        expense_date: new Date().toISOString().split('T')[0]
    });

    const [newScholarship, setNewScholarship] = useState<Partial<Scholarship>>({
        student_id: '',
        name: 'Academic Excellence',
        amount: 0,
        description: '',
        status: 'active',
        awarded_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [expRes, scholRes, studentsRes] = await Promise.all([
                supabase.from('expenses').select('*').eq('school_id', profile.school_id).order('expense_date', { ascending: false }),
                supabase.from('scholarships').select('*, student:students(*)').eq('school_id', profile.school_id).order('created_at', { ascending: false }),
                supabase.from('students').select('*').eq('school_id', profile.school_id).order('full_name')
            ]);
            if (expRes.error) throw expRes.error;
            if (scholRes.error) throw scholRes.error;
            if (studentsRes.error) throw studentsRes.error;
            setExpenses(expRes.data || []);
            setScholarships(scholRes.data || []);
            setStudents(studentsRes.data || []);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const expenseData = { ...newExpense, school_id: profile.school_id, recorded_by: profile.id };
            const { error } = await supabase.from('expenses').insert([expenseData]);
            if (error) throw error;
            setShowAddExpense(false);
            setNewExpense({ category: 'Maintenance', amount: 0, description: '', expense_date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAddScholarship = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const scholarshipData = { ...newScholarship, school_id: profile.school_id };
            const { error } = await supabase.from('scholarships').insert([scholarshipData]);
            if (error) throw error;
            setShowAddScholarship(false);
            setNewScholarship({ student_id: '', name: 'Academic Excellence', amount: 0, description: '', status: 'active', awarded_date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const totalScholarships = scholarships.length;

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Growth</h1>
                    <p className="text-gray-500 text-sm mt-1">Monitor operational expenses and manage student scholarships.</p>
                </div>
                <button 
                    onClick={() => activeTab === 'expenses' ? setShowAddExpense(true) : setShowAddScholarship(true)}
                    className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 flex items-center gap-2 shadow-sm"
                >
                    <Plus className="w-4 h-4" /> {activeTab === 'expenses' ? 'Add Expense' : 'Award Scholarship'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl w-fit mb-4">
                        <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-gray-500 text-sm font-medium">Total Expenses</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalExpenses.toLocaleString()} <span className="text-xs text-gray-400 font-normal">GHS</span></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl w-fit mb-4">
                        <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-gray-500 text-sm font-medium">Active Scholarships</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalScholarships} <span className="text-xs text-gray-400 font-normal">Students</span></div>
                </div>
                <div className="bg-brand-600 p-6 rounded-2xl shadow-xl shadow-brand-600/20 text-white">
                    <div className="p-3 bg-white/20 rounded-xl w-fit mb-4">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-white/80 text-sm font-medium">Net Operational Cash</div>
                    <div className="text-2xl font-bold mt-1">Refreshed Daily</div>
                </div>
            </div>

            <div className="flex bg-gray-100 dark:bg-gray-700/30 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'expenses' ? 'bg-white dark:bg-gray-800 text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Expenses Tracker
                </button>
                <button
                    onClick={() => setActiveTab('scholarships')}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'scholarships' ? 'bg-white dark:bg-gray-800 text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Scholarships
                </button>
            </div>

            {activeTab === 'expenses' ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Category</th>
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Amount</th>
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Date</th>
                                </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {expenses.map(expense => (
                                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4 font-bold">{expense.category}</td>
                                    <td className="p-4 text-red-600 font-bold">{Number(expense.amount).toLocaleString()}</td>
                                    <td className="p-4 text-sm">{new Date(expense.expense_date).toLocaleDateString()}</td>
                                    <td className="p-4 text-sm text-gray-500">{expense.description || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Student</th>
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Name</th>
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Amount (GHS)</th>
                                <th className="p-4 font-bold text-gray-700 dark:text-gray-300">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {scholarships.map(scholarship => (
                                <tr key={scholarship.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold">{scholarship.student?.full_name}</div>
                                        <div className="text-xs text-gray-500">{scholarship.student?.admission_number}</div>
                                    </td>
                                    <td className="p-4 font-medium">{scholarship.name}</td>
                                    <td className="p-4 text-green-600 font-bold">{Number(scholarship.amount).toLocaleString()}</td>
                                    <td className="p-4 text-sm text-gray-500">{scholarship.description || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AnimatePresence>
                {showAddExpense && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold mb-6">Log Expense</h2>
                            <form onSubmit={handleAddExpense} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                    <select required value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl">
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Utility Bills">Utility Bills</option>
                                        <option value="Staff Welfare">Staff Welfare</option>
                                        <option value="Events">Events</option>
                                        <option value="Stationery">Stationery</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                                    <input required type="number" step="0.01" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" />
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                        <input required type="date" value={newExpense.expense_date} onChange={e => setNewExpense({...newExpense, expense_date: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                    <textarea rows={3} value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" placeholder="Purpose of this expense..." />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowAddExpense(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-600/20">Save Expense</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showAddScholarship && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-md rounded-3xl p-8 shadow-2xl"
                        >
                            <h2 className="text-2xl font-bold mb-6">Award Scholarship</h2>
                            <form onSubmit={handleAddScholarship} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Select Student</label>
                                    <select required value={newScholarship.student_id} onChange={e => setNewScholarship({...newScholarship, student_id: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl">
                                        <option value="">Choose a student...</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Scholarship Name</label>
                                        <input required type="text" value={newScholarship.name} onChange={e => setNewScholarship({...newScholarship, name: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Amount (GHS)</label>
                                        <input required type="number" step="0.01" value={newScholarship.amount} onChange={e => setNewScholarship({...newScholarship, amount: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                    <textarea rows={3} value={newScholarship.description} onChange={e => setNewScholarship({...newScholarship, description: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 border-none rounded-xl" placeholder="More details about the award..." />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowAddScholarship(false)} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-600/20">Award Scholarship</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ExpenseTrackerPage;
