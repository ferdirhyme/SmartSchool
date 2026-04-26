
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    variant = 'danger'
}) => {
    const variantStyles = {
        danger: {
            icon: <Trash2 className="w-6 h-6 text-red-600" />,
            iconBg: 'bg-red-100 dark:bg-red-900/30',
            button: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
        },
        warning: {
            icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
        },
        info: {
            icon: <AlertTriangle className="w-6 h-6 text-blue-600" />,
            iconBg: 'bg-blue-100 dark:bg-blue-900/30',
            button: 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/20',
        }
    };

    const style = variantStyles[variant];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700"
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${style.iconBg}`}>
                                    {style.icon}
                                </div>
                                <button 
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                            
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">{title}</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
                                {message}
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`flex-1 py-3 text-white font-bold rounded-2xl transition-all shadow-lg ${style.button}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmationDialog;
