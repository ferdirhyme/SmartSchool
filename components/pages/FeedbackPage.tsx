import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Profile, UserRole, Feedback } from '../../types.ts';
import { supabase } from '../../lib/supabase.ts';
import { MessageSquare, Send, CheckCircle, Clock, Trash2 } from 'lucide-react';

interface FeedbackPageProps {
  session: Session;
  profile: Profile;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ session, profile }) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = profile.role === UserRole.Admin;

  useEffect(() => {
    fetchFeedbacks();
  }, [profile.id, isAdmin]);

  const fetchFeedbacks = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('feedback')
        .select(`
          *,
          user:profiles (
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', profile.id);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setFeedbacks((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching feedback:', err);
      setError('Failed to load feedback. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: insertError } = await supabase
        .from('feedback')
        .insert([
          {
            user_id: profile.id,
            school_id: profile.school_id || null,
            subject: subject.trim(),
            message: message.trim(),
            status: 'pending'
          }
        ])
        .select(`
          *,
          user:profiles (
            full_name,
            role
          )
        `)
        .single();

      if (insertError) throw insertError;

      setFeedbacks([data as any, ...feedbacks]);
      setSubject('');
      setMessage('');
      setSuccess('Your feedback has been submitted successfully!');
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespond = async (feedbackId: string, responseText: string, newStatus: 'reviewed' | 'resolved') => {
    try {
      const { error: updateError } = await supabase
        .from('feedback')
        .update({
          response: responseText,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', feedbackId);

      if (updateError) throw updateError;

      setFeedbacks(feedbacks.map(f => 
        f.id === feedbackId 
          ? { ...f, response: responseText, status: newStatus, updated_at: new Date().toISOString() } 
          : f
      ));
    } catch (err: any) {
      console.error('Error responding to feedback:', err);
      alert('Failed to save response: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDelete = async (feedbackId: string) => {
    setError(null);
    setSuccess(null);
    try {
      console.log('Attempting delete for:', feedbackId);
      const { error: deleteError, count } = await supabase
        .from('feedback')
        .delete({ count: 'exact' })
        .eq('id', feedbackId);

      if (deleteError) {
        console.error('Delete error details:', deleteError);
        throw deleteError;
      }
      
      console.log('Delete successful, count:', count);
      if (count === 0) {
        throw new Error('No records were deleted. This could be a permission issue (Security Policy) or the record was already removed.');
      }

      setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
      setSuccess('Feedback deleted successfully.');
    } catch (err: any) {
      console.error('Error during deletion:', err);
      const msg = err.message || 'Internal server error';
      setError('Failed to delete feedback: ' + msg);
      alert('Delete Error: ' + msg);
      throw err; // Re-throw to allow component to handle it if needed
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-brand-600" />
          {isAdmin ? 'User Feedback & Suggestions' : 'Send Feedback'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {isAdmin 
            ? 'Review and respond to suggestions and recommendations from users across the platform.' 
            : 'Have a suggestion or recommendation? Let the platform administrators know!'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl border border-green-100 dark:border-green-800">
          {success}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Submit New Feedback</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="Brief summary of your suggestion"
                required
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                placeholder="Describe your recommendation or issue in detail..."
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 focus:ring-4 focus:ring-brand-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {isAdmin ? 'All Feedback' : 'Your Previous Feedback'}
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No feedback yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isAdmin ? 'There are no suggestions from users at this time.' : 'You haven\'t submitted any feedback yet.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {feedbacks.map((feedback) => (
              <FeedbackCard 
                key={feedback.id} 
                feedback={feedback} 
                isAdmin={isAdmin}
                onRespond={handleRespond}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FeedbackCard: React.FC<{ 
  feedback: Feedback; 
  isAdmin: boolean;
  onRespond: (id: string, response: string, status: 'reviewed' | 'resolved') => void;
  onDelete: (id: string) => Promise<void>;
}> = ({ feedback, isAdmin, onRespond, onDelete }) => {
  const [isResponding, setIsResponding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [responseText, setResponseText] = useState(feedback.response || '');
  const [status, setStatus] = useState<'reviewed' | 'resolved'>(feedback.status === 'resolved' ? 'resolved' : 'reviewed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="w-3 h-3" /> Resolved</span>;
      case 'reviewed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Clock className="w-3 h-3" /> Reviewed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feedback.subject}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAdmin && feedback.user && (
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {feedback.user.full_name} ({feedback.user.role})
                </span>
              )}
              <span>{new Date(feedback.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div>{getStatusBadge(feedback.status)}</div>
        </div>
        
        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          {feedback.message}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              title="Delete Feedback"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-sm font-bold text-red-600">Delete this?</span>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDelete(feedback.id);
                  } catch (err) {
                    setShowDeleteConfirm(false);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {feedback.response && !isResponding && (
          <div className="mt-6 pl-4 border-l-4 border-brand-500">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-600 dark:text-brand-400 text-xs">A</span>
              Admin Response
            </h4>
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
              {feedback.response}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            {!isResponding ? (
              <button
                onClick={() => setIsResponding(true)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {feedback.response ? 'Edit Response' : 'Add Response'}
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Response</label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                    placeholder="Type your response here..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Status:</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'reviewed' | 'resolved')}
                      className="text-sm border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsResponding(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onRespond(feedback.id, responseText, status);
                        setIsResponding(false);
                      }}
                      className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                      Save Response
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
