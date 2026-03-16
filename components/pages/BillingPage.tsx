
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
                        // Insert the successful transaction into the database
                        // The Database Trigger will automatically handle the balance update.
                        const { error: insertError } = await supabase.from('transactions').insert({
                            user_id: session.user.id,
                            amount: topUpAmount,
                            reference: response.reference,
                            status: 'success',
                            gateway: 'paystack'
                        });

                        if (insertError) throw insertError;

                        await fetchTransactions();
                        setMessage({ type: 'success', text: 'Payment successful! Your balance has been updated.' });
                    } catch (err: any) {
                        console.error("Error recording transaction:", err);
                        setMessage({ type: 'error', text: 'Payment was successful at Paystack, but we failed to record it in our system. Reference: ' + response.reference });
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
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Billing</h1>

            {message && (
                <div
                    className={`p-4 rounded-md mb-6 ${
                        message.type === 'success'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top-up Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Top Up Credit</h2>
                        <form onSubmit={handleTopUp} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="amount"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                                >
                                    Amount ({settings?.currency || '...'})
                                </label>
                                <input
                                    id="amount"
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="e.g., 50.00"
                                    required
                                    className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading || !settings?.paystack_public_key}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                            >
                                {isLoading ? 'Processing...' : 'Pay'}
                            </button>
                             {!settings?.paystack_public_key && (
                                <div className="mt-4 space-y-3">
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
                                        The payment gateway is not configured. A Super Admin must set the Paystack Public Key in the platform settings.
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => refetchSettings()}
                                        className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Transaction History</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Amount</th>
                                        <th className="px-6 py-3">Reference</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isFetchingHistory ? (
                                        <tr>
                                            <td colSpan={5} className="text-center p-6">
                                                Loading history...
                                            </td>
                                        </tr>
                                    ) : transactions.length > 0 ? (
                                        transactions.map((tx) => (
                                            <tr key={tx.id} className="border-b dark:border-gray-700">
                                                <td className="px-6 py-4">{new Date(tx.created_at).toLocaleString()}</td>
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                    {settings?.currency || ''} {tx.amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{tx.reference}</td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                                                            tx.status
                                                        )}`}
                                                    >
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                 <td className="px-6 py-4 text-right">
                                                    {tx.status === 'pending' && (
                                                        <button onClick={() => openCancelModal(tx)} className="text-xs font-medium text-red-500 hover:text-red-700">
                                                            Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="text-center p-6">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setIsCancelModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Confirm Cancellation</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Are you sure you want to delete this pending transaction of {settings?.currency} {transactionToCancel.amount.toFixed(2)}? This action cannot be undone.
                        </p>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={() => { setIsCancelModalOpen(false); setTransactionToCancel(null); }}
                                className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleConfirmCancelTransaction}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                            >
                                Yes, Cancel Transaction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingPage;
