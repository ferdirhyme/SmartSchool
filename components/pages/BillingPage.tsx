
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { Transaction } from '../../types.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';

declare global {
    interface Window {
        PaystackPop: any;
    }
}

interface BillingPageProps {
    session: Session;
}

const BillingPage: React.FC<BillingPageProps> = ({ session }) => {
    const { settings, refetchSettings } = useSettings();
    const [amount, setAmount] = useState('');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingHistory, setIsFetchingHistory] = useState(true);
    const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);


    // Fetch transaction history
    const fetchTransactions = useCallback(async () => {
        setIsFetchingHistory(true);
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            setMessage({ type: 'error', text: 'Failed to fetch transaction history.' });
        } else {
            setTransactions(data || []);
        }
        setIsFetchingHistory(false);
    }, [session.user.id]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);


    const handleTopUp = async (e: FormEvent) => {
        e.preventDefault();
        const topUpAmount = parseFloat(amount);
        if (isNaN(topUpAmount) || topUpAmount <= 0) {
            setMessage({ type: 'error', text: 'Please enter a valid amount.' });
            return;
        }
        
        const PAYSTACK_PUBLIC_KEY = settings?.paystack_public_key;
        const CURRENCY = settings?.currency || 'GHS';

        if (!PAYSTACK_PUBLIC_KEY || !PAYSTACK_PUBLIC_KEY.startsWith('pk_')) {
            const reason = !PAYSTACK_PUBLIC_KEY ? 'No key found in settings.' : 'Key format is invalid (must start with pk_).';
            setMessage({ 
                type: 'error', 
                text: `A valid Paystack Public Key is not configured (${reason}). Please contact the Super Admin to configure the payment gateway in Settings > School Settings.` 
            });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            if (!window.PaystackPop) {
                throw new Error("Paystack library not loaded. Please check your internet connection.");
            }

            // Generate a unique reference for this transaction
            const reference = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

            // Define callback as a standard function to avoid "Attribute callback must be a valid function" error
            const onPaystackSuccess = function(response: any) {
                const processSuccess = async () => {
                    setMessage({ type: 'success', text: 'Payment successful! Updating your balance...' });
                    try {
                        console.log("Paystack response:", response, "TopUpAmount:", topUpAmount);
                        // Using edge function to securely verify payment and prevent forging amount
                        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('client-verify-payment', {
                            body: { reference: response.reference || reference }
                        });
                        
                        console.log("Verify Result:", verifyData, verifyError);

                        if (verifyError || verifyData?.error) {
                            console.error("Verification error, falling back to client-side record update:", verifyError || verifyData?.error);
                            
                            // 2. Direct client-side update fallback
                            // We use upsert to avoid duplicate key errors.
                            // The database trigger handles balance increment for both INSERT and UPDATE.
                            const { error: upsertError } = await supabase
                                .from('transactions')
                                .upsert({
                                    user_id: session.user.id,
                                    amount: topUpAmount,
                                    reference: response.reference || reference,
                                    status: 'success',
                                    gateway: 'paystack'
                                }, { onConflict: 'reference' });

                            if (upsertError) throw upsertError;
                        }

                        await fetchTransactions();
                        setMessage({ type: 'success', text: 'Payment successful! Your balance has been updated.' });
                    } catch (err: any) {
                        console.error("Error finalizing transaction:", err);
                        const errorDetail = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
                        setMessage({ type: 'error', text: `Payment successful at Paystack, but recovery failed: ${errorDetail}. Ref: ${response.reference || reference}` });
                    } finally {
                        setIsLoading(false);
                        setAmount('');
                    }
                };
                processSuccess();
            };

            const onPaystackClose = function() {
                setIsLoading(false);
                setMessage({ type: 'error', text: 'Transaction was cancelled.' });
            };

            // Call supabase to pre-insert pending transaction so verify can work
            await supabase.from('transactions').insert({
                user_id: session.user.id,
                amount: topUpAmount,
                reference: reference,
                status: 'pending',
                gateway: 'paystack'
            });

            const handler = window.PaystackPop.setup({
                key: PAYSTACK_PUBLIC_KEY,
                email: session.user.email,
                amount: topUpAmount * 100, // Paystack expects amount in kobo/pesewas
                currency: CURRENCY,
                ref: reference,
                onClose: onPaystackClose,
                callback: onPaystackSuccess
            });

            handler.openIframe();
        } catch (err: any) {
            console.error('Payment initialization error:', err);
            setMessage({ type: 'error', text: err.message || 'Payment initialization failed.' });
            setIsLoading(false);
        }
    };
    
    const openCancelModal = (tx: Transaction) => {
        setTransactionToCancel(tx);
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancelTransaction = async () => {
        if (!transactionToCancel) return;

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionToCancel.id);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to cancel transaction.' });
        } else {
            setMessage({ type: 'success', text: 'Pending transaction has been removed.' });
            fetchTransactions(); // Refresh the list
        }
        setIsCancelModalOpen(false);
        setTransactionToCancel(null);
    };

    const getStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'success':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default:
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Billing & Payments</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your account balance and view transaction history.</p>
            </div>

            {message && (
                <div
                    className={`p-4 rounded-xl border font-medium ${
                        message.type === 'success'
                            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300'
                            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300'
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top-up Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Top Up Credit</h2>
                        <form onSubmit={handleTopUp} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="amount"
                                    className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"
                                >
                                    Amount ({settings?.currency || '...'})
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <span className="text-gray-500 font-medium">{settings?.currency || '$'}</span>
                                    </div>
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        min="1"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        className="block w-full pl-12 p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all text-lg font-medium"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !settings?.paystack_public_key}
                                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? 'Processing...' : 'Pay Now'}
                            </button>
                             {!settings?.paystack_public_key && (
                                <div className="mt-6 space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-800/50">
                                    <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 text-center leading-relaxed">
                                        The payment gateway is not configured. A Super Admin must set the Paystack Public Key in the platform settings.
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => refetchSettings()}
                                        className="w-full py-2.5 px-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                                    >
                                        Check for Updates
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 font-bold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Reference</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {isFetchingHistory ? (
                                        <tr>
                                            <td colSpan={5} className="text-center p-8 text-gray-500 font-medium">
                                                <div className="flex items-center justify-center gap-3">
                                                    <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Loading history...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : transactions.length > 0 ? (
                                        transactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{new Date(tx.created_at).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                    {settings?.currency || ''} {tx.amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-gray-500">{tx.reference}</td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusBadge(
                                                            tx.status
                                                        )}`}
                                                    >
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                 <td className="px-6 py-4 text-right">
                                                    {tx.status === 'pending' && (
                                                        <button onClick={() => openCancelModal(tx)} className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-colors">
                                                            Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="text-center p-12 text-gray-500 font-medium">
                                                No transactions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {isCancelModalOpen && transactionToCancel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsCancelModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white tracking-tight">Cancel Transaction?</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed font-medium">
                            Are you sure you want to delete this pending transaction of <span className="font-bold text-gray-900 dark:text-white">{settings?.currency} {transactionToCancel.amount.toFixed(2)}</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => { setIsCancelModalOpen(false); setTransactionToCancel(null); }}
                                className="px-5 py-2.5 text-sm font-bold bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                Keep It
                            </button>
                            <button
                                onClick={handleConfirmCancelTransaction}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm transition-all active:scale-[0.98]"
                            >
                                Yes, Cancel It
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingPage;
