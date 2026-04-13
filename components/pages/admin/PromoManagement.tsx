import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase.ts';
import { Plus, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface AdData {
    id: string;
    title: string;
    description: string;
    link_url: string;
    image_url: string;
    is_active: boolean;
    created_at: string;
}

export const PromoManagement: React.FC = () => {
    const [ads, setAds] = useState<AdData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ads')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            if (data) setAds(data);
        } catch (err) {
            console.error("Failed to fetch ads:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateAd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Check if user is admin before attempting insert
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("Not authenticated");

            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', userData.user.id)
                .single();

            if (profileData?.role !== 'Admin') {
                throw new Error("Only platform admins can publish ads. Your role is: " + profileData?.role);
            }

            const { data, error } = await supabase
                .from('ads')
                .insert([{
                    title,
                    description,
                    link_url: linkUrl,
                    image_url: imageUrl,
                    is_active: true
                }])
                .select();

            if (error) {
                if (error.code === '42P01') {
                    throw new Error("The 'ads' table does not exist. Please run the SQL script in /supabase/ads_schema.sql in your Supabase SQL Editor.");
                }
                if (error.code === '42501') {
                    throw new Error("Permission Denied (RLS). Please ensure you have run the updated SQL script in /supabase/ads_schema.sql and that your profile role is correctly set to 'Admin' in the database.");
                }
                throw error;
            }
            
            if (data) {
                setAds([data[0], ...ads]);
                setShowForm(false);
                setTitle('');
                setDescription('');
                setLinkUrl('');
                setImageUrl('');
            }
        } catch (err) {
            console.error("Ad Creation Error:", err);
            alert("Failed to create ad: " + (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAdStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('ads')
                .update({ is_active: !currentStatus })
                .eq('id', id);
            
            if (error) throw error;
            
            setAds(ads.map(ad => ad.id === id ? { ...ad, is_active: !currentStatus } : ad));
        } catch (err) {
            alert("Failed to update ad status.");
        }
    };

    const deleteAd = async (id: string) => {
        if (!confirm("Are you sure you want to delete this ad?")) return;
        
        try {
            const { error } = await supabase
                .from('ads')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            setAds(ads.filter(ad => ad.id !== id));
        } catch (err) {
            alert("Failed to delete ad.");
        }
    };

    if (isLoading) {
        return <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Custom Ads Management</h2>
                    <p className="text-sm text-gray-500">Create and manage sponsored ads shown to users.</p>
                </div>
                <button 
                    onClick={() => setShowForm(!showForm)}
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {showForm ? 'Cancel' : 'Create Ad'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreateAd} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-brand-100 dark:border-brand-900 shadow-lg animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold mb-4">New Sponsored Ad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ad Title</label>
                                <input 
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="e.g. Local Uniform Shop"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target URL</label>
                                <input 
                                    required
                                    type="url"
                                    value={linkUrl}
                                    onChange={e => setLinkUrl(e.target.value)}
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Image URL</label>
                                <input 
                                    required
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                            <textarea 
                                required
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-32 resize-none"
                                placeholder="Ad copy goes here..."
                            />
                        </div>
                    </div>
                    
                    {/* Preview */}
                    {title && imageUrl && (
                        <div className="mt-6 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Preview</p>
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden max-w-md">
                                <div className="absolute top-0 right-0 bg-gray-100 dark:bg-gray-700 text-gray-500 text-[9px] px-2 py-0.5 rounded-bl-lg font-bold uppercase tracking-wider z-10">
                                    Sponsored
                                </div>
                                <img src={imageUrl} alt="Ad Preview" className="w-16 h-16 object-cover rounded-lg shrink-0" onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100?text=Error')} />
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{title}</h4>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{description || 'Description will appear here'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSaving}
                            className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Publish Ad'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-bottom border-gray-100 dark:border-gray-700">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Ad Creative</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Target URL</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">Status</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {ads.map(ad => (
                            <tr key={ad.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <img src={ad.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                                        <div>
                                            <p className="font-bold text-sm">{ad.title}</p>
                                            <p className="text-xs text-gray-500 truncate max-w-xs">{ad.description}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm flex items-center gap-1">
                                        Link <ExternalLink className="w-3 h-3" />
                                    </a>
                                </td>
                                <td className="px-6 py-4">
                                    <button 
                                        onClick={() => toggleAdStatus(ad.id, ad.is_active)}
                                        className={`px-3 py-1 text-xs font-bold rounded-full uppercase transition-colors ${
                                            ad.is_active 
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                                        }`}
                                    >
                                        {ad.is_active ? 'Active' : 'Paused'}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => deleteAd(ad.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete Ad"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {ads.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p>No custom ads created yet.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
