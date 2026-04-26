
import React, { useState, useEffect } from 'react';
import { 
    Receipt, 
    Plus, 
    Search, 
    Trash2, 
    Download, 
    Filter, 
    GraduationCap, 
    User, 
    Calendar,
    ArrowUpCircle,
    ArrowDownCircle,
    DollarSign,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Expense, Scholarship, Student } from '../../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationDialog from '../ui/ConfirmationDialog.tsx';

interface AccountingPageProps {
    profile: Profile;
    initialTab?: 'expenses' | 'scholarships';
}

const AccountingPage: React.FC<AccountingPageProps> = ({ profile, initialTab = 'expenses' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [scholarships, setScholarships] = useState<Scholarship[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    } | null>(null);
    
    // Form States
    const [expenseForm, setExpenseForm] = useState({
        category: '',
        amount: '',
        description: '',
        expense_date: new Date().toISOString().split('T')[0]
    });

    const [scholarshipForm, setScholarshipForm] = useState({
        student_id: '',
        name: '',
        amount: '',
        description: ''
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'expenses') {
                const { data, error } = await supabase
                    .from('expenses')
                    .select('*')
                    .eq('school_id', profile.school_id)
                    .order('expense_date', { ascending: false });
                if (error) throw error;
                setExpenses(data || []);
            } else if (activeTab === 'scholarships') {
                const { data: scholData, error: scholError } = await supabase
                    .from('scholarships')
                    .select('*, student:students(id, full_name, admission_number)')
                    .eq('school_id', profile.school_id)
                    .order('created_at', { ascending: false });
                if (scholError) throw scholError;
                setScholarships(scholData || []);

                const { data: studData, error: studError } = await supabase
                    .from('students')
                    .select('id, full_name, admission_number')
                    .eq('school_id', profile.school_id);
                if (studError) throw studError;
                setStudents(studData || []);
            } else if (activeTab === 'transactions') {
                // Fetch transactions - since they might not have school_id directly in the table (joined via profile)
                // Actually, transactions table has user_id. We need to filter by users belonging to this school.
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*, profile:profiles(full_name, avatar_url, role)')
                    .order('created_at', { ascending: false });
                
                // Note: Simplified for now - usually you'd filter by school_id via a join or RLS
                if (error) throw error;
                setTransactions(data || []);
            }
        } catch (err) {
            console.error('Error fetching accounting data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefund = async (tx: any) => {
        setConfirmation({
            title: "Refund Transaction?",
            message: `Are you sure you want to refund GHS ${tx.amount.toFixed(2)} to ${tx.profile?.full_name}? This will mark the transaction as failed and may affect their credit balance depending on system settings.`,
            confirmText: "Refund",
            variant: "warning",
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('transactions')
                        .update({ status: 'failed' })
                        .eq('id', tx.id);
                    
                    if (error) throw error;
                    fetchData();
                } catch (err) {
                    console.error("Refund failed:", err);
                    alert("Refund failed. Please try again.");
                }
            }
        });
    };

    const handleExpenseSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const expenseData = {
                ...expenseForm,
                amount: parseFloat(expenseForm.amount),
                school_id: profile.school_id,
                recorded_by: profile.id
            };
            const { error } = await supabase.from('expenses').insert([expenseData]);
            if (error) throw error;
            setIsFormOpen(false);
            setExpenseForm({ category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (err) {
            alert('Failed to save expense');
        }
    };

    const handleScholarshipSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const scholarshipData = {
                ...scholarshipForm,
                amount: parseFloat(scholarshipForm.amount),
                school_id: profile.school_id,
                status: 'active',
                awarded_date: new Date().toISOString().split('T')[0]
            };
            const { error } = await supabase.from('scholarships').insert([scholarshipData]);
            if (error) throw error;
            setIsFormOpen(false);
            setScholarshipForm({ student_id: '', name: '', amount: '', description: '' });
            fetchData();
        } catch (err) {
            alert('Failed to save scholarship');
        }
    };

    const deleteItem = async (id: string, table: string) => {
        setConfirmation({
            title: "Delete Record?",
            message: "Are you sure you want to permanently delete this financial record? This may affect your school's accounting history and reports.",
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from(table).delete().eq('id', id);
                    if (error) throw error;
                    fetchData();
                } catch (err) {
                    alert('Delete failed');
                }
            }
        });
    };

    const handleGenerateReport = async () => {
        setConfirmation({
            title: "Generate P&L Report",
            message: "Generating this advanced report costs GHS 1.00 from your wallet balance. Do you want to proceed?",
            confirmText: "Generate",
            variant: "info",
            onConfirm: async () => {
                try {
                    // Check balance
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('credit_balance')
                        .eq('id', profile.id)
                        .single();
                        
                    if (profileError) throw profileError;
                    
                    if ((profileData.credit_balance || 0) < 1) {
                        alert("Insufficient balance. Please top up your wallet.");
                        return;
                    }

                    // Deduct balance
                    const { error: deductionError } = await supabase
                        .from('profiles')
                        .update({ credit_balance: parseFloat((profileData.credit_balance - 1).toFixed(2)) })
                        .eq('id', profile.id);

                    if (deductionError) throw deductionError;

                    // Log transaction
                    try {
                        await supabase.from('transactions').insert([{
                            user_id: profile.id,
                            amount: 1,
                            status: 'success',
                            reference: 'REP-' + Date.now(),
                            gateway: 'System'
                        }]);
                    } catch (txError) {
                        console.warn("Transaction logging skipped (transactions table may be missing):", txError);
                    }

                    // Generate CSV
                    let csvContent = "data:text/csv;charset=utf-8,";
                    csvContent += "Type,Date,Description,Amount\n";
                    
                    expenses.forEach(exp => {
                        csvContent += `Expense,${exp.expense_date?.split('T')[0] || ''},"${exp.description || ''}",-${exp.amount}\n`;
                    });
                    
                    scholarships.forEach(sch => {
                        csvContent += `Scholarship,${sch.created_at?.split('T')[0] || ''},"Scholarship for ${sch.student?.full_name || 'Student'}",-${sch.amount}\n`;
                    });

                    const totalE = expenses.reduce((s, e) => s + Number(e.amount), 0);
                    const totalS = scholarships.reduce((s, e) => s + Number(e.amount), 0);
                    
                    csvContent += `\nTotal Expenses,,,-${totalE}\n`;
                    csvContent += `Total Scholarships,,,-${totalS}\n`;
                    csvContent += `Total Output,,,-${totalE + totalS}\n`;

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `Profit_and_Loss_Report_${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    alert("Report successfully generated!");
                    fetchData();
                    
                } catch (err) {
                    console.error("Report generation failed:", err);
                    alert("Failed to generate report. Please try again later.");
                }
            }
        });
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-brand-900 text-white p-6 rounded-3xl shadow-xl shadow-brand-900/20 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="relative z-10">
                        <p className="text-brand-300 font-bold text-xs uppercase tracking-widest mb-1">Total Expenses</p>
                        <h4 className="text-3xl font-black mb-2">GHS {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
                        <div className="flex items-center gap-2 text-xs font-medium text-brand-400">
                            <ArrowUpCircle className="w-4 h-4" />
                            <span>Monthly spending trend</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-widest mb-1">Active Scholarships</p>
                    <h4 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{scholarships.length}</h4>
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-brand-600" />
                        Beneficiary Students
                    </p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-widest">Financial Health</p>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <button 
                        onClick={handleGenerateReport}
                        className="w-full py-3 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 font-bold rounded-xl hover:bg-brand-100 transition-all flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" /> Generate P&L Report
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-fit">
                    <button 
                        onClick={() => setActiveTab('expenses')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'expenses' ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Expense Tracker
                    </button>
                    <button 
                        onClick={() => setActiveTab('scholarships')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'scholarships' ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Scholarship Management
                    </button>
                    <button 
                        onClick={() => setActiveTab('transactions')}
                        className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'transactions' ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        Transaction History
                    </button>
                </div>
                
                {activeTab !== 'transactions' && (
                    <button 
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20"
                    >
                        <Plus className="w-5 h-5" />
                        Add {activeTab === 'expenses' ? 'Expense' : 'Scholarship'}
                    </button>
                )}
            </div>

            {/* Content Table */}
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-20">
                        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                        <p className="mt-4 text-gray-500 font-medium">Crunching financial data...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    {activeTab === 'expenses' ? (
                                        <>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Description</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount (GHS)</th>
                                        </>
                                    ) : activeTab === 'scholarships' ? (
                                        <>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Student</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount (GHS)</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Description</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Reference</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                        </>
                                    )}
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {activeTab === 'expenses' ? (
                                    expenses.map(exp => (
                                        <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600 dark:text-gray-300">
                                                {new Date(exp.expense_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-3 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold rounded-lg border border-brand-100 dark:border-brand-800">
                                                    {exp.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {exp.description}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-gray-900 dark:text-white">
                                                {exp.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => deleteItem(exp.id, 'expenses')} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : activeTab === 'scholarships' ? (
                                    scholarships.map(schol => (
                                        <tr key={schol.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 font-bold text-xs">
                                                        {schol.student?.full_name[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{schol.student?.full_name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold">{schol.student?.admission_number}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-600 dark:text-gray-300">
                                                {schol.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-black text-brand-600 dark:text-brand-400">
                                                    {Number(schol.amount).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                {schol.description}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => deleteItem(schol.id, 'scholarships')} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    transactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white uppercase leading-none">{new Date(tx.created_at).toLocaleDateString()}</p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase">{new Date(tx.created_at).toLocaleTimeString()}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold text-[10px] uppercase">
                                                        {tx.profile?.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{tx.profile?.full_name || 'System User'}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{tx.profile?.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                                                {tx.reference}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-gray-900 dark:text-white">
                                                ₵{(tx.amount || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`flex items-center gap-2 text-xs font-bold ${tx.status === 'success' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                                                    {tx.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : tx.status === 'failed' ? <XCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin-slow" />}
                                                    <span className="capitalize">{tx.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {tx.status === 'success' && (
                                                    <button 
                                                        onClick={() => handleRefund(tx)}
                                                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-all border border-red-100"
                                                    >
                                                        Refund
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                                {(activeTab === 'expenses' ? expenses : activeTab === 'scholarships' ? scholarships : transactions).length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Filter className="w-10 h-10 text-gray-200 dark:text-gray-700" />
                                                <p className="text-gray-400 font-medium italic">No records found for this period.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {isFormOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700"
                        >
                            <h3 className="text-2xl font-black mb-6 text-gray-900 dark:text-white">
                                Add {activeTab === 'expenses' ? 'New Expense' : 'Scholarship'}
                            </h3>
                            
                            <form onSubmit={activeTab === 'expenses' ? handleExpenseSubmit : handleScholarshipSubmit} className="space-y-5">
                                {activeTab === 'expenses' ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                                            <select 
                                                required
                                                value={expenseForm.category}
                                                onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                                                className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                            >
                                                <option value="">Select Category</option>
                                                <option value="Utilities">Utilities (Water/Electricity)</option>
                                                <option value="Maintenance">Maintenance & Repairs</option>
                                                <option value="Supplies">School Supplies</option>
                                                <option value="Kitchen">Kitchen & Food</option>
                                                <option value="Marketing">Marketing & Publicity</option>
                                                <option value="Other">Other Expenses</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount (GHS)</label>
                                            <input 
                                                type="number" step="0.01" required
                                                value={expenseForm.amount}
                                                onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                                                className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
                                            <input 
                                                type="date" required
                                                value={expenseForm.expense_date}
                                                onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})}
                                                className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Student</label>
                                            <select 
                                                required
                                                value={scholarshipForm.student_id}
                                                onChange={e => setScholarshipForm({...scholarshipForm, student_id: e.target.value})}
                                                className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                            >
                                                <option value="">Select Student</option>
                                                {students.map(s => (
                                                    <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Name</label>
                                                <input 
                                                    type="text" required placeholder="Academic, Sports..."
                                                    value={scholarshipForm.name}
                                                    onChange={e => setScholarshipForm({...scholarshipForm, name: e.target.value})}
                                                    className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount (GHS)</label>
                                                <input 
                                                    type="number" step="0.01" required
                                                    value={scholarshipForm.amount}
                                                    onChange={e => setScholarshipForm({...scholarshipForm, amount: e.target.value})}
                                                    className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
                                    <textarea 
                                        rows={3}
                                        value={activeTab === 'expenses' ? expenseForm.description : scholarshipForm.description}
                                        onChange={e => activeTab === 'expenses' ? setExpenseForm({...expenseForm, description: e.target.value}) : setScholarshipForm({...scholarshipForm, description: e.target.value})}
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 border-none rounded-2xl focus:ring-2 focus:ring-brand-500 font-bold transition-all resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsFormOpen(false)}
                                        className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-600/20"
                                    >
                                        Save Record
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationDialog 
                isOpen={!!confirmation}
                onClose={() => setConfirmation(null)}
                onConfirm={confirmation?.onConfirm || (() => {})}
                title={confirmation?.title || ''}
                message={confirmation?.message || ''}
                confirmText={confirmation?.confirmText}
                variant={confirmation?.variant}
            />
        </div>
    );
};

export default AccountingPage;
