
import React, { useState, FormEvent, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { useSettings } from '../../contexts/SettingsContext.tsx';
import { SchoolSettings, Profile, UserRole } from '../../types.ts';
import ImageUpload from '../common/ImageUpload.tsx';
import { getCurrentLocation } from '../../lib/location.ts';
import { 
    assessmentSqlScript, 
    ghanaianOptimizationSqlScript, 
    helperFunctionsSqlScript, 
    securityCleanupSqlScript, 
    messagingSqlScript, 
    reportsAndAttendanceSqlScript, 
    notificationsSqlScript, 
    feesSqlScript, 
    feedbackSqlScript, 
    nextGenFeaturesSqlScript 
} from '../../lib/db-scripts.ts';

// --- Page Logic ---



























// --- Components for Settings Page ---
interface ScriptBlockProps {
    title: string;
    warning: React.ReactNode;
    instructions: React.ReactNode;
    script: string;
    isDestructive: boolean;
    onRun: (script: string) => void;
    isRunning: boolean;
}

const ScriptBlock: React.FC<ScriptBlockProps> = ({ title, warning, instructions, script, isDestructive, onRun, isRunning }) => {
    const [copyButtonText, setCopyButtonText] = useState('Copy Script');

    const handleCopy = () => {
        navigator.clipboard.writeText(script).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Script'), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            setCopyButtonText('Failed to copy');
        });
    };
    
    const borderColor = isDestructive ? 'border-red-200 dark:border-red-800/50' : 'border-amber-200 dark:border-amber-800/50';
    const bgColor = isDestructive ? 'bg-red-50 dark:bg-red-900/10' : 'bg-amber-50 dark:bg-amber-900/10';
    const titleColor = isDestructive ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300';
    const textColor = isDestructive ? 'text-red-700 dark:text-red-400/90' : 'text-amber-700 dark:text-amber-400/90';
    const strongColor = isDestructive ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200';
    const runButtonColor = isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700';

    return (
        <div className={`p-8 border ${borderColor} ${bgColor} rounded-2xl shadow-sm`}>
            <h2 className={`text-xl font-bold ${titleColor} mb-4`}>{title}</h2>
            <div className={`${textColor} mb-6 space-y-3 font-medium`}>
                {warning}
            </div>
            <div className="mb-6">
                <h3 className={`font-bold mb-2 ${strongColor}`}>Instructions:</h3>
                {instructions}
            </div>
            <div className="relative group">
                <textarea
                    readOnly
                    value={script}
                    className="w-full h-64 p-4 font-mono text-sm bg-gray-900 text-gray-200 rounded-xl border border-gray-800 focus:outline-none shadow-inner custom-scrollbar"
                />
                 <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleCopy}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-gray-700/80 backdrop-blur-sm rounded-lg hover:bg-gray-600 transition-colors"
                    >
                        {copyButtonText}
                    </button>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => onRun(script)}
                    disabled={isRunning}
                    className={`flex items-center justify-center px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm ${runButtonColor}`}
                >
                    {isRunning ? (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : 'Run Script'}
                </button>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{ onConfirm: () => void; onCancel: () => void; isRunning: boolean }> = ({ onConfirm, onCancel, isRunning }) => {
    const [confirmText, setConfirmText] = useState('');
    const canConfirm = confirmText === 'DELETE';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-8 border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Warning: Destructive Action</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4 font-medium">
                    You are about to run a script that will <strong className="font-bold text-red-600 dark:text-red-400">permanently delete all student assessment data</strong>. This action cannot be undone.
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
                    To proceed, please type <code className="font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">DELETE</code> into the box below.
                </p>
                <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl mb-8 dark:bg-gray-700/50 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                    placeholder="Type DELETE to confirm"
                />
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button onClick={onConfirm} disabled={!canConfirm || isRunning} className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl disabled:bg-red-400 dark:disabled:bg-red-800 disabled:cursor-not-allowed hover:bg-red-700 transition-colors shadow-sm">
                        {isRunning ? 'Running...' : 'Confirm & Delete Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const AdvancedSettings: React.FC = () => {
    const [isScriptRunning, setIsScriptRunning] = useState(false);
    const [scriptToRun, setScriptToRun] = useState<string | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    const handleRunScript = async (script: string) => {
        setIsScriptRunning(true);
        setMessage(null);
        try {
            const { data, error } = await supabase.rpc('execute_admin_sql', { sql_script: script });
            if (error) throw error;
            setMessage({ type: 'success', text: data || 'Script executed successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'An unknown error occurred.' });
        } finally {
            setIsScriptRunning(false);
            setIsConfirmModalOpen(false);
            setScriptToRun(null);
        }
    };
    
    const triggerRun = (script: string, isDestructive: boolean) => {
        if (isDestructive) {
            setScriptToRun(script);
            setIsConfirmModalOpen(true);
        } else {
            handleRunScript(script);
        }
    };

    const commonInstructions = (
        <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click the "Run Script" button below.</li>
            <li>If the script is destructive, you will be asked to confirm.</li>
            <li>Alternatively, you can manually copy the script and run it in your Supabase SQL Editor.</li>
        </ol>
    );

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {message.text}
                </div>
            )}

            {isConfirmModalOpen && (
                <ConfirmationModal 
                    onConfirm={() => { if(scriptToRun) handleRunScript(scriptToRun) }} 
                    onCancel={() => setIsConfirmModalOpen(false)}
                    isRunning={isScriptRunning}
                />
            )}

            <ScriptBlock
                title="1. Core Database & Security Patch"
                isDestructive={false}
                warning={
                     <p>
                        <strong>CRITICAL:</strong> Run this script to fix critical security vulnerabilities in the signup process and ensure credit balances update correctly. This is mandatory for all users.
                    </p>
                }
                instructions={commonInstructions}
                script={helperFunctionsSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="2. Fees & Billing Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to create the tables required for managing fee types and recording student payments.
                    </p>
                }
                instructions={commonInstructions}
                script={feesSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="3. Feedback Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to create the tables required for managing user feedback and suggestions.
                    </p>
                }
                instructions={commonInstructions}
                script={feedbackSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="3. Messaging Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the messaging system, including conversations, messages, and security rules.
                    </p>
                }
                instructions={commonInstructions}
                script={messagingSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />
            
            <ScriptBlock
                title="4. Reports & Attendance Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the tables required for student reports, assessments, and attendance tracking. This also fixes permission issues for these features.
                    </p>
                }
                instructions={commonInstructions}
                script={reportsAndAttendanceSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="5. Notifications Setup"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up the real-time notification system.
                    </p>
                }
                instructions={commonInstructions}
                script={notificationsSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="6. Final Polished Features (PTM, Expenses, Scholarships)"
                isDestructive={false}
                warning={
                     <p>
                        Run this script to set up PTM Meetings, Expense Tracking, and Scholarship Management.
                    </p>
                }
                instructions={commonInstructions}
                script={nextGenFeaturesSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="7. Reset Student Assessments Table (Destructive)"
                isDestructive={true}
                warning={
                    <>
                        <p>
                            <strong className="block">Fix for Assessment Errors:</strong>
                            If you see an error like <code className="text-sm bg-red-200 dark:bg-red-800 p-1 rounded">"no unique or exclusion constraint matching the ON CONFLICT specification"</code> when saving scores, running this script will resolve it.
                        </p>
                        <p>
                            <strong className="block">Warning: Highly Destructive Action</strong>
                            This script will <strong className="underline">permanently delete all student assessment data</strong> to recreate the table with the correct structure. Use with extreme caution.
                        </p>
                    </>
                }
                instructions={commonInstructions}
                script={assessmentSqlScript}
                onRun={(script) => triggerRun(script, true)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="8. Ghanaian School Optimization"
                isDestructive={false}
                warning={
                     <p>
                        <strong>CRITICAL:</strong> Run this script to enable GES-compliant reports, Mock Exam analytics, and automatic student positions. This also fixes the "on conflict" schema error in the Assessment page.
                    </p>
                }
                instructions={commonInstructions}
                script={ghanaianOptimizationSqlScript}
                onRun={(script) => triggerRun(script, false)}
                isRunning={isScriptRunning}
            />

            <ScriptBlock
                title="9. EMERGENCY: Security Audit & Role Cleanup"
                isDestructive={true}
                warning={
                    <div className="space-y-3">
                        <p className="font-bold underline">URGENT SECURITY TOOL:</p>
                        <p>
                            If you suspect unauthorized admin accounts have been created, run this script immediately.
                        </p>
                        <p>
                            This script will <strong>demote all accounts</strong> with the "Admin" role back to "Teacher" status, <strong>except</strong> for the two specifically whitelisted admin emails:
                        </p>
                        <ul className="list-disc ml-6 mt-2 space-y-1">
                            <li>ferditgh@gmail.com</li>
                            <li>ferdagbatey@gmail.com</li>
                        </ul>
                    </div>
                }
                instructions={commonInstructions}
                script={securityCleanupSqlScript}
                onRun={(script) => triggerRun(script, true)}
                isRunning={isScriptRunning}
            />
        </div>
    );
};


// Component for User-specific settings (Password change, etc.)
const UserSettings: React.FC = () => {
    const { theme, setTheme } = useSettings();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChangePassword = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (password.length < 8) {
            setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setIsSaving(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setMessage({ type: 'error', text: `Password update failed: ${error.message}` });
        } else {
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => setMessage(null), 5000); // Clear message after 5 seconds
        }
        setIsSaving(false);
    };
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all";

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300'}`}>
                    {message.text}
                </div>
            )}
            <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Appearance</h2>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">Theme Preference</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose how SmartSchool looks to you. Your preference is saved locally.</p>
                    </div>
                    <div className="flex items-center space-x-1 rounded-xl bg-gray-100 dark:bg-gray-900 p-1.5 border border-gray-200 dark:border-gray-800">
                        <button onClick={() => setTheme('light')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Light</button>
                        <button onClick={() => setTheme('dark')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Dark</button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleChangePassword} className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Change Password</h2>
                <div className="space-y-5 max-w-md">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClasses} pr-10`} placeholder="8+ characters" />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                        <div className="relative">
                            <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${inputClasses} pr-10`} placeholder="••••••••" />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end mt-8">
                    <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                        {isSaving ? 'Saving...' : 'Update Password'}
                    </button>
                </div>
            </form>

            <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Notification Preferences</h2>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        This feature is coming soon. You will be able to manage email and in-app notifications here.
                    </p>
                </div>
            </div>
        </div>
    );
};

// Component for School-wide settings (Headteacher or Admin)
export const SchoolSettingsComponent: React.FC<{ schoolId: string | null; userRole: UserRole }> = ({ schoolId, userRole }) => {
    const { settings: contextSettings, isLoading: isSettingsLoading, refetchSettings } = useSettings();
    const [formData, setFormData] = useState<Partial<SchoolSettings>>({});
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [locationMessage, setLocationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [isLocalLoading, setIsLocalLoading] = useState(false);

    useEffect(() => {
        const fetchLocalSettings = async () => {
            if (!schoolId) return;
            
            // If the schoolId matches the context, use context data
            if (contextSettings && contextSettings.id === schoolId) {
                setFormData(contextSettings);
                return;
            }

            // Otherwise, fetch specifically for this schoolId (Admin use case)
            setIsLocalLoading(true);
            try {
                const { data, error } = await supabase
                    .from('school_settings')
                    .select('*')
                    .eq('id', schoolId)
                    .maybeSingle();
                
                if (error) throw error;
                if (data) {
                    setFormData(data);
                } else {
                    // Initialize with defaults if no settings exist yet
                    setFormData({ id: schoolId });
                }
            } catch (err: any) {
                console.error("Error fetching school settings:", err);
                setMessage({ type: 'error', text: 'Failed to load school settings.' });
            } finally {
                setIsLocalLoading(false);
            }
        };

        fetchLocalSettings();
    }, [schoolId, contextSettings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumberInput = (e.target as HTMLInputElement).type === 'number';
        setFormData(prev => ({ ...prev, [name]: isNumberInput ? (value === '' ? null : parseFloat(value)) : value }));
    };
    
    const handleFetchLocation = async () => {
      if (!navigator.geolocation) {
        setLocationMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
        return;
      }

      // Check permission status if possible (not supported in all browsers like Safari)
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (status.state === 'denied') {
            setLocationMessage({ 
              type: 'error', 
              text: 'Location access is blocked in your browser settings. Please click the lock icon in the address bar and set Location to "Allow".' 
            });
            return;
          }
        } catch (e) {
          // Ignore permission query errors
        }
      }

      setIsFetchingLocation(true);
      setLocationMessage({ type: 'success', text: 'Requesting location... Please check for a permission prompt in your browser.' });

      try {
        const position = await getCurrentLocation();
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({
          ...prev,
          school_latitude: latitude,
          school_longitude: longitude,
        }));
        setLocationMessage({ type: 'success', text: `Successfully fetched location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
        // Keep success message for 10 seconds
        setTimeout(() => setLocationMessage(null), 10000);
      } catch (error: any) {
        let errorText = error.message || 'Could not get your location.';
        
        // Map common error codes to user-friendly messages if they aren't already descriptive
        if (error.code === 1) {
            errorText = 'Location access denied. Please allow location access in your browser settings (usually in the address bar).';
        } else if (error.code === 3) {
            errorText = 'Location request timed out. This can happen indoors or in areas with poor signal. Please try again or enter coordinates manually.';
        }

        setLocationMessage({ type: 'error', text: errorText });
      } finally {
        setIsFetchingLocation(false);
      }
    };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage(null);

        try {
            let currentSchoolId = schoolId;

            // If no school ID exists, create the school first
            if (!currentSchoolId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("User not authenticated");

                const { data: newSchool, error: schoolError } = await supabase
                    .from('schools')
                    .insert({ name: formData.school_name || 'New School' })
                    .select()
                    .single();
                
                if (schoolError) throw schoolError;
                currentSchoolId = newSchool.id;

                // Update user profile with new school ID
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ school_id: currentSchoolId })
                    .eq('id', user.id);
                
                if (profileError) throw profileError;

                // Also update the teachers table if they are a Headteacher
                if (userRole === UserRole.Headteacher) {
                    await supabase
                        .from('teachers')
                        .update({ school_id: currentSchoolId })
                        .eq('email', user.email);
                }
            }

            let logo_url = formData.logo_url;

            if (logoFile) {
                const filePath = `school/${currentSchoolId}/${Date.now()}_${logoFile.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, logoFile, { upsert: true });
                if (uploadError) throw new Error(`Logo upload failed: ${uploadError.message}`);

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                logo_url = urlData.publicUrl;
            }

            const { id, ...updateData } = formData;
            const payload = { 
                ...updateData, 
                logo_url, 
                id: currentSchoolId,
                paystack_public_key: formData.paystack_public_key?.trim() || null,
                paystack_secret_key: formData.paystack_secret_key?.trim() || null,
                current_term: formData.current_term || 'Term 1',
                current_year: formData.current_year || new Date().getFullYear(),
                term_start_date: formData.term_start_date || null,
                term_end_date: formData.term_end_date || null
            };
            
            const { error } = await supabase.from('school_settings').upsert(payload, { onConflict: 'id' });
            
            if (error) throw error;

            // Also update the schools table with the logo_url for redundancy
            if (logo_url) {
                await supabase.from('schools').update({ logo_url }).eq('id', currentSchoolId);
            }

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
            refetchSettings();
            // Reload page to ensure all contexts are updated with the new school ID
            setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'An error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isSettingsLoading || isLocalLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    const inputClasses = "block w-full p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 transition-all";

    return (
        <div>
            {message && (
                <div className={`p-4 rounded-xl border mb-6 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300'}`}>
                    {message.text}
                </div>
            )}
            <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Active Academic Session</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="current_term" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Current Term</label>
                                    <select name="current_term" id="current_term" value={formData.current_term || 'Term 1'} onChange={handleChange} className={inputClasses}>
                                        <option value="Term 1">Term 1</option>
                                        <option value="Term 2">Term 2</option>
                                        <option value="Term 3">Term 3</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="current_year" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Academic Year</label>
                                    <input type="number" name="current_year" id="current_year" value={formData.current_year || new Date().getFullYear()} onChange={handleChange} className={inputClasses} placeholder="e.g., 2024"/>
                                </div>
                                <div>
                                    <label htmlFor="term_start_date" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Term Start Date</label>
                                    <input type="date" name="term_start_date" id="term_start_date" value={formData.term_start_date || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="term_end_date" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Term End Date</label>
                                    <input type="date" name="term_end_date" id="term_end_date" value={formData.term_end_date || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/50 rounded-xl">
                                    <p className="text-xs text-brand-700 dark:text-brand-300 font-medium italic">
                                        Note: These dates are used across the dashboard to filter "Current Term" statistics like attendance and performance indices.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label htmlFor="school_name" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">School Name</label>
                                    <input type="text" name="school_name" id="school_name" value={formData.school_name || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="motto" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">School Motto</label>
                                    <input type="text" name="motto" id="motto" value={formData.motto || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                                    <input type="text" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Email</label>
                                    <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="address" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Address</label>
                                    <textarea name="address" id="address" value={formData.address || ''} onChange={handleChange} rows={3} className={inputClasses}/>
                                </div>
                            </div>
                        </div>
                         <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Attendance Location (GPS)</h2>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Set the school's coordinates to be used as a reference point for teacher attendance check-ins.</p>
                             <div className="mb-6 space-y-3">
                                <button 
                                    type="button" 
                                    onClick={handleFetchLocation}
                                    disabled={isFetchingLocation}
                                    className="w-full md:w-auto px-5 py-2.5 text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 disabled:opacity-50 flex items-center justify-center transition-colors dark:bg-brand-900/30 dark:border-brand-800/50 dark:text-brand-300 dark:hover:bg-brand-900/50"
                                >
                                    {isFetchingLocation ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-brand-600 dark:text-brand-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                    {isFetchingLocation ? 'Fetching...' : 'Use My Current Location'}
                                </button>
                                {locationMessage && (
                                    <div className={`p-3 rounded-xl border text-sm font-medium ${locationMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800/50 dark:text-green-300' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-300'}`}>
                                        {locationMessage.text}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                    Tip: If the button times out, you can find your coordinates on Google Maps and enter them manually below.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="school_latitude" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">School Latitude</label>
                                    <input type="number" step="any" name="school_latitude" id="school_latitude" value={formData.school_latitude ?? ''} onChange={handleChange} className={inputClasses} placeholder="e.g., 5.603717"/>
                                </div>
                                <div>
                                    <label htmlFor="school_longitude" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">School Longitude</label>
                                    <input type="number" step="any" name="school_longitude" id="school_longitude" value={formData.school_longitude ?? ''} onChange={handleChange} className={inputClasses} placeholder="e.g., -0.186964"/>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Payment Gateway (Paystack)</h2>
                            {userRole === UserRole.Admin ? (
                                <>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Enter your Paystack API keys. These will be used to enable credit top-ups for students and parents.</p>
                                    <div className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl text-blue-800 dark:text-blue-300 text-sm">
                                        <strong>Note:</strong> The <strong>Public Key</strong> is used on the client-side to initialize payments. The <strong>Secret Key</strong> is kept securely in the database but is not actively used by the client application to ensure security.
                                    </div>
                                    <div className="space-y-5">
                                        <div>
                                            <label htmlFor="currency" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Currency</label>
                                            <select name="currency" id="currency" value={formData.currency || ''} onChange={handleChange} className={inputClasses}>
                                                <option value="">-- Select Currency --</option>
                                                <option value="GHS">GHS (Ghana Cedi)</option>
                                                <option value="NGN">NGN (Nigerian Naira)</option>
                                                <option value="USD">USD (US Dollar)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="paystack_public_key" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Public Key</label>
                                            <input type="text" name="paystack_public_key" id="paystack_public_key" value={formData.paystack_public_key || ''} onChange={handleChange} className={inputClasses} placeholder="pk_test_... or pk_live_..."/>
                                        </div>
                                        <div>
                                            <label htmlFor="paystack_secret_key" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Secret Key</label>
                                            <div className="relative">
                                                <input type={showSecret ? 'text' : 'password'} name="paystack_secret_key" id="paystack_secret_key" value={formData.paystack_secret_key || ''} onChange={handleChange} className={`${inputClasses} pr-16`} placeholder="sk_test_... or sk_live_..."/>
                                                <button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute inset-y-0 right-0 px-4 flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                                                    {showSecret ? 'Hide' : 'Show'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-amber-500 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Restricted Access</h3>
                                            <div className="mt-2 text-sm text-amber-700 dark:text-amber-400/80 font-medium">
                                                <p>Payment gateway settings can only be managed by a Super Admin. Please contact the platform administrator to configure your Paystack keys.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                         <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">School Logo</h2>
                            <ImageUpload onFileChange={setLogoFile} defaultImageUrl={formData.logo_url} />
                        </div>
                        <div className="p-8 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                             <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Default School Theme</h2>
                             <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 font-medium">Set the default theme for all users. Users can override this in their own settings.</p>
                             <select name="theme" value={formData.theme || 'light'} onChange={handleChange} className={inputClasses}>
                                 <option value="light">Light Mode</option>
                                 <option value="dark">Dark Mode</option>
                             </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={isSaving} className="px-8 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Main page component that decides which settings to show based on user role
interface SettingsPageProps {
    profile: Profile;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ profile }) => {
    const [activeTab, setActiveTab] = useState('my-settings');

    if (profile.role !== UserRole.Headteacher && profile.role !== UserRole.Admin) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">My Settings</h1>
                <UserSettings />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="flex space-x-1 bg-gray-100/50 dark:bg-gray-800/50 p-1 rounded-xl w-max border border-gray-200/50 dark:border-gray-700/50">
                <button 
                    onClick={() => setActiveTab('my-settings')} 
                    className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'my-settings' 
                        ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'}`}
                >
                    My Settings
                </button>
                <button 
                    onClick={() => setActiveTab('school-settings')} 
                    className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'school-settings' 
                        ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'}`}
                >
                    School Settings
                </button>
                 {profile.role === UserRole.Admin && (
                     <button 
                        onClick={() => setActiveTab('advanced')} 
                        className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'advanced' 
                            ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50'}`}
                    >
                        Advanced DB Tools
                    </button>
                 )}
            </div>
            
            <div className="mt-6">
                {activeTab === 'my-settings' && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Settings</h1>
                        <UserSettings />
                    </div>
                )}
                {activeTab === 'school-settings' && (
                     <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">School Settings</h1>
                        <SchoolSettingsComponent schoolId={profile.school_id} userRole={profile.role} />
                    </div>
                )}
                {activeTab === 'advanced' && profile.role === UserRole.Admin && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Advanced Database Scripts</h1>
                        <AdvancedSettings />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsPage;
