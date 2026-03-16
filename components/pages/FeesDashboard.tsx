import React, { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase.ts';
import { FeeType, Student, FeePayment, Profile } from '../../types.ts';

// --- FeeType Management Component ---
const FeeTypeManager = ({ profile }: { profile: Profile }) => {
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFeeTypeModalOpen, setIsFeeTypeModalOpen] = useState(false);
    const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
    const [formData, setFormData] = useState<Partial<FeeType>>({ name: '', description: '', default_amount: 0 });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFeeTypes = async () => {
            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('fee_types')
                    .select('*')
                    .eq('school_id', profile.school_id)
                    .order('name');
                if (fetchError) throw fetchError;
                setFeeTypes(data || []);
            } catch (err: any) {
                console.error("Error fetching fee types:", err);
                if (err.message && err.message.includes('relation "public.fee_types" does not exist')) {
                    setError('Database Table Missing: Please go to Settings > Advanced and run the "3. Fees & Billing Setup" script.');
                } else {
                    setError(`Failed to load fee types: ${err.message}`);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchFeeTypes();
    }, [profile.school_id]);

    useEffect(() => {
        if (editingFeeType) {
            setFormData(editingFeeType);
        } else {
            setFormData({ name: '', description: '', default_amount: 0, school_id: profile.school_id });
        }
    }, [editingFeeType, profile.school_id]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        const { error: upsertError } = await supabase.from('fee_types').upsert({
            ...formData,
            school_id: profile.school_id
        });
        if (upsertError) {
            setError(upsertError.message)
        } else {
            const { data } = await supabase
                .from('fee_types')
                .select('*')
                .eq('school_id', profile.school_id)
                .order('name');
            setFeeTypes(data || []);
            setIsFeeTypeModalOpen(false);
            setEditingFeeType(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure? This may fail if payments are associated with this fee type.')) {
            const { error: deleteError } = await supabase.from('fee_types').delete().eq('id', id);
            if (deleteError) setError(deleteError.message);
            else setFeeTypes(prev => prev.filter(ft => ft.id !== id));
        }
    };
    
    return (
        <div>
            {error && <div className="p-4 rounded-md mb-6 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Manage Fee Types</h2>
                <button onClick={() => { setEditingFeeType(null); setIsFeeTypeModalOpen(true); }} className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700">Add Fee Type</button>
            </div>
            {isFeeTypeModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsFeeTypeModalOpen(false)}>
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setIsFeeTypeModalOpen(false)} className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 no-print" aria-label="Close modal">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h3 className="text-xl font-bold mb-4">{editingFeeType ? 'Edit' : 'Add'} Fee Type</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium">Name</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Description (Optional)</label>
                                <input type="text" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Default Amount (Optional)</label>
                                <input type="number" step="0.01" value={formData.default_amount ?? ''} onChange={e => { const val = parseFloat(e.target.value); setFormData({...formData, default_amount: isNaN(val) ? undefined : val }); }} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"/>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setIsFeeTypeModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-md">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                {isLoading ? (
                    <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading fee types...</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Default Amount</th><th className="px-6 py-3">Actions</th></tr></thead>
                        <tbody>
                            {feeTypes.map(ft => (
                            <tr key={ft.id} className="border-b dark:border-gray-700">
                                <td className="px-6 py-4">{ft.name}</td>
                                <td className="px-6 py-4">{ft.default_amount != null ? `GHS ${ft.default_amount.toFixed(2)}` : 'N/A'}</td>
                                <td className="px-6 py-4 space-x-2">
                                <button onClick={() => { setEditingFeeType(ft); setIsFeeTypeModalOpen(true); }} className="font-medium text-blue-600 hover:underline">Edit</button>
                                <button onClick={() => handleDelete(ft.id)} className="font-medium text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// --- Payment Management Component ---
const PaymentManager = ({ profile }: { profile: Profile }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchedStudents, setSearchedStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<FeePayment[]>([]);
    const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
    const [isFetchingFeeTypes, setIsFetchingFeeTypes] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [currentReceipt, setCurrentReceipt] = useState<FeePayment | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const initialPaymentState = {
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash' as FeePayment['payment_method'],
        fee_type_id: '',
        amount_paid: 0,
        notes: '',
    };
    const [paymentData, setPaymentData] = useState<Partial<FeePayment>>(initialPaymentState);
    const [amountDue, setAmountDue] = useState<number | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFeeTypes = async () => {
            setIsFetchingFeeTypes(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('fee_types')
                    .select('*')
                    .eq('school_id', profile.school_id)
                    .order('name');
                if (fetchError) throw fetchError;
                setFeeTypes(data || []);
            } catch (err: any) {
                console.error("Error fetching fee types:", err);
                if (err.message && err.message.includes('relation "public.fee_types" does not exist')) {
                    setError('Database Table Missing: Please go to Settings > Advanced and run the "3. Fees & Billing Setup" script.');
                } else {
                    setError(`Failed to load fee types: ${err.message}`);
                }
            } finally {
                setIsFetchingFeeTypes(false);
            }
        };
        fetchFeeTypes();
    }, [profile.school_id]);

    useEffect(() => {
        const fetchPaymentHistory = async () => {
            if (!selectedStudent) return;
            setIsLoading(true);
            try {
                const { data, error: fetchError } = await supabase
                    .from('fee_payments')
                    .select('*, fee_type:fee_types(name)')
                    .eq('student_id', selectedStudent.id)
                    .eq('school_id', profile.school_id)
                    .order('payment_date', { ascending: false });
                if (fetchError) setError(fetchError.message);
                else setPaymentHistory(data as any[] || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPaymentHistory();
    }, [selectedStudent, profile.school_id]);

    const handleSearchStudents = async (term: string) => {
        if (term.trim().length < 2) {
            setSearchedStudents([]);
            return;
        }
        const { data } = await supabase
            .from('students')
            .select('*')
            .eq('school_id', profile.school_id)
            .or(`full_name.ilike.%${term}%,admission_number.ilike.%${term}%`)
            .limit(10);
        setSearchedStudents(data || []);
    };
    
    const handlePrintReceipt = (receiptToPrint: FeePayment | null) => {
        if (!receiptToPrint || !selectedStudent) return;
    
        const receiptHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt</title>
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 80mm;
                        font-size: 12px;
                        line-height: 1.4;
                        margin: 0;
                        padding: 10px;
                        color: #000;
                    }
                    .container { padding: 5px; }
                    h1 { text-align: center; font-size: 16px; margin: 0 0 10px 0; text-transform: uppercase; }
                    p { margin: 0; }
                    .item { display: flex; justify-content: space-between; }
                    hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
                    .text-center { text-align: center; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>SmartSchool</h1>
                    <p class="text-center">Payment Receipt</p>
                    <p class="text-center"><small>${new Date(receiptToPrint.created_at).toLocaleString()}</small></p>
                    <hr>
                    <p>Receipt No: ${receiptToPrint.receipt_number}</p>
                    <p>Student: ${selectedStudent.full_name}</p>
                    <p>Admission No: ${selectedStudent.admission_number}</p>
                    <hr>
                    <div class="item">
                        <span>Fee Type:</span>
                        <span>${receiptToPrint.fee_type?.name}</span>
                    </div>
                    <div class="item">
                        <span>Payment Date:</span>
                        <span>${receiptToPrint.payment_date}</span>
                    </div>
                     <div class="item">
                        <span>Method:</span>
                        <span>${receiptToPrint.payment_method}</span>
                    </div>
                    <hr>
                    <div class="item bold">
                        <span>Amount Paid:</span>
                        <span>GHS ${receiptToPrint.amount_paid.toFixed(2)}</span>
                    </div>
                    <hr>
                    ${receiptToPrint.notes ? `<p>Notes: ${receiptToPrint.notes}</p><hr>` : ''}
                    <p class="text-center">Thank you!</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.close();
                    }
                </script>
            </body>
            </html>
        `;
    
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        } else {
            alert('Please allow pop-ups for this website to print receipts.');
        }
    };
    
    const closePaymentModal = () => {
        setIsPaymentModalOpen(false);
        setPaymentData(initialPaymentState);
        setAmountDue(null);
        setPaymentError(null);
    };

    useEffect(() => {
        const calculateAmountDue = async () => {
            if (!paymentData.fee_type_id || !selectedStudent) {
                setAmountDue(null); return;
            }
            const selectedFeeType = feeTypes.find(ft => ft.id === paymentData.fee_type_id);
            if (!selectedFeeType || typeof selectedFeeType.default_amount !== 'number') {
                setAmountDue(null); return;
            }
            const { data } = await supabase.from('fee_payments').select('amount_paid').eq('student_id', selectedStudent.id).eq('fee_type_id', paymentData.fee_type_id);
            const totalPaid = (data || []).reduce((sum, p) => sum + p.amount_paid, 0);
            const due = selectedFeeType.default_amount - totalPaid;
            setAmountDue(due < 0 ? 0 : due);
        };
        calculateAmountDue();
    }, [paymentData.fee_type_id, selectedStudent, feeTypes]);
    
    useEffect(() => {
        if (amountDue !== null && paymentData.amount_paid) {
            if (paymentData.amount_paid > amountDue) {
                setPaymentError(`Amount cannot exceed the balance of GHS ${amountDue.toFixed(2)}.`);
            } else {
                setPaymentError(null);
            }
        } else {
            setPaymentError(null);
        }
    }, [paymentData.amount_paid, amountDue]);

    const handleRecordPayment = async (e: FormEvent) => {
        e.preventDefault();
        if (paymentError || !selectedStudent || !paymentData.fee_type_id || !paymentData.amount_paid || paymentData.amount_paid <= 0) return;
        
        const receipt_number = `RCPT-${Date.now()}`;
        const finalData = { 
            ...paymentData, 
            student_id: selectedStudent.id, 
            receipt_number,
            school_id: profile.school_id
        };

        const { data, error: insertError } = await supabase.from('fee_payments').insert(finalData).select('*, student:students(full_name, admission_number), fee_type:fee_types(name)').single();
        if (insertError) {
            setError(insertError.message);
        } else {
            setPaymentHistory(prev => [data as any, ...prev]);
            closePaymentModal();
            setCurrentReceipt(data as any);
            setIsReceiptModalOpen(true);
        }
    };
    
    return (
        <div>
            {error && <div className="p-4 rounded-md mb-6 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{error}</div>}
            <h2 className="text-2xl font-bold mb-4">Record Student Payment</h2>
            <div className="mb-4">
                <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); handleSearchStudents(e.target.value); }} placeholder="Search student by name or admission no..." className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400" />
            </div>

            {searchedStudents.length > 0 && !selectedStudent && (
                <ul className="mb-4 space-y-2">
                    {searchedStudents.map(s => <li key={s.id}><button onClick={() => { setSelectedStudent(s); setSearchTerm(''); setSearchedStudents([]); }} className="text-blue-600 hover:underline">{s.full_name} ({s.admission_number})</button></li>)}
                </ul>
            )}

            {selectedStudent && (
                <div>
                    <div className="flex justify-between items-start p-4 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                        <div>
                            <h3 className="text-xl font-bold">{selectedStudent.full_name}</h3>
                            <p className="text-sm">{selectedStudent.admission_number}</p>
                        </div>
                        <div>
                           <button onClick={() => setSelectedStudent(null)} className="text-sm text-red-600 hover:underline">Clear</button>
                           <button onClick={() => setIsPaymentModalOpen(true)} disabled={isFetchingFeeTypes} className="ml-4 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">Record Payment</button>
                        </div>
                    </div>
                    
                    <h4 className="font-bold mb-2">Payment History</h4>
                    {isLoading ? (
                        <div className="text-center p-6 text-gray-500 dark:text-gray-400">Loading history...</div>
                    ) : (
                        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Fee Type</th><th className="px-6 py-3">Amount Paid</th><th className="px-6 py-3">Receipt No.</th><th className="px-6 py-3">Action</th></tr></thead>
                                <tbody>
                                    {paymentHistory.map(p => (
                                    <tr key={p.id} className="border-b dark:border-gray-700">
                                        <td className="px-6 py-4">{p.payment_date}</td>
                                        <td className="px-6 py-4">{p.fee_type?.name}</td>
                                        <td className="px-6 py-4">GHS {p.amount_paid.toFixed(2)}</td>
                                        <td className="px-6 py-4">{p.receipt_number}</td>
                                        <td className="px-6 py-4"><button onClick={() => { setCurrentReceipt(p); setIsReceiptModalOpen(true); }} className="font-medium text-blue-600 hover:underline">View Receipt</button></td>
                                    </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            
            {isPaymentModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={closePaymentModal}>
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <button onClick={closePaymentModal} className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 no-print" aria-label="Close modal">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h3 className="text-xl font-bold mb-4">New Payment for {selectedStudent?.full_name}</h3>
                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Fee Type</label>
                                <select required value={paymentData.fee_type_id} onChange={e => setPaymentData({...paymentData, fee_type_id: e.target.value, amount_paid: 0})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option value="">-- Select Fee Type --</option>
                                    {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                                </select>
                                {feeTypes.length === 0 && !isFetchingFeeTypes && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        No fee types found. Please create one in the "Manage Fee Types" tab first.
                                    </p>
                                )}
                            </div>
                            {amountDue !== null && (
                                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-md text-sm text-center text-blue-800 dark:text-blue-200">
                                    Amount Due for this Fee: <strong>GHS {amountDue.toFixed(2)}</strong>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium">Amount Paid</label>
                                <input type="number" step="0.01" required value={paymentData.amount_paid || ''} onChange={e => setPaymentData({...paymentData, amount_paid: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"/>
                                {paymentError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{paymentError}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Payment Date</label>
                                <input type="date" required value={paymentData.payment_date} onChange={e => setPaymentData({...paymentData, payment_date: e.target.value})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Payment Method</label>
                                <select value={paymentData.payment_method} onChange={e => setPaymentData({...paymentData, payment_method: e.target.value as any})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                    <option>Cash</option><option>Bank Transfer</option><option>Mobile Money</option><option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Notes (Optional)</label>
                                <textarea value={paymentData.notes || ''} onChange={e => setPaymentData({...paymentData, notes: e.target.value})} className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"/>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={closePaymentModal} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md">Cancel</button>
                                <button type="submit" disabled={!!paymentError || !paymentData.amount_paid || paymentData.amount_paid <= 0} className="px-4 py-2 bg-brand-600 text-white rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-500">Record Payment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isReceiptModalOpen && currentReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsReceiptModalOpen(false)}>
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 text-gray-900 dark:text-gray-200" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 no-print" aria-label="Close modal">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div>
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold">SmartSchool Payment Receipt</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Date: {new Date(currentReceipt.created_at).toLocaleString()}</p>
                            </div>
                            <div className="space-y-2 text-sm">
                                <p><strong>Receipt No:</strong> {currentReceipt.receipt_number}</p>
                                <p><strong>Student Name:</strong> {selectedStudent?.full_name}</p>
                                <p><strong>Admission No:</strong> {selectedStudent?.admission_number}</p>
                                <hr className="my-2 border-gray-300 dark:border-gray-600"/>
                                <p><strong>Fee Type:</strong> {currentReceipt.fee_type?.name}</p>
                                <p><strong>Amount Paid:</strong> GHS {currentReceipt.amount_paid.toFixed(2)}</p>
                                <p><strong>Payment Date:</strong> {currentReceipt.payment_date}</p>
                                <p><strong>Payment Method:</strong> {currentReceipt.payment_method}</p>
                                {currentReceipt.notes && <p><strong>Notes:</strong> {currentReceipt.notes}</p>}
                            </div>
                            <div className="text-center mt-8 text-xs text-gray-500">Thank you for your payment.</div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6 no-print">
                            <button type="button" onClick={() => setIsReceiptModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 dark:text-gray-200 rounded-md">Close</button>
                            <button type="button" onClick={() => handlePrintReceipt(currentReceipt)} className="px-4 py-2 bg-brand-600 text-white rounded-md">Print Receipt</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const FeesDashboard: React.FC<{ profile: Profile }> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'payments' | 'types'>('payments');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Fees Management</h1>
      <div className="flex border-b mb-4">
        <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 ${activeTab === 'payments' ? 'border-b-2 border-brand-600 font-semibold text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'}`}>Student Payments</button>
        <button onClick={() => setActiveTab('types')} className={`px-4 py-2 ${activeTab === 'types' ? 'border-b-2 border-brand-600 font-semibold text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'}`}>Manage Fee Types</button>
      </div>
       <div className={activeTab === 'payments' ? 'block' : 'hidden'}>
        <PaymentManager profile={profile} />
      </div>
      <div className={activeTab === 'types' ? 'block' : 'hidden'}>
        <FeeTypeManager profile={profile} />
      </div>
    </div>
  );
};

export default FeesDashboard;
