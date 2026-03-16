import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase.ts';
import { Profile, Conversation, Message, UserRole } from '../../types.ts';
import { 
    Search, 
    Send, 
    MoreVertical, 
    ArrowLeft, 
    User, 
    MessageSquare, 
    Plus,
    Clock,
    Check,
    CheckCheck,
    Users,
    ArrowRight
} from 'lucide-react';

interface MessagesPageProps {
    session: Session;
    profile: Profile;
    initialConversationId?: string;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ session, profile, initialConversationId }) => {
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewChatList, setShowNewChatList] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchInitialData = useCallback(async () => {
        if (!profile.school_id) {
            setError("Your profile is not linked to a school. Please contact your administrator.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // 1. Fetch all potential chat participants (not self, same school)
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('*')
                .eq('school_id', profile.school_id)
                .neq('id', profile.id);
            if (usersError) throw usersError;
            setAllUsers(usersData || []);
            const usersMap = new Map((usersData || []).map(u => [u.id, u]));

            // 2. Fetch all conversations for the current user
            const { data: conversationsData, error: conversationsError } = await supabase
                .from('conversations')
                .select('*, messages(*)')
                .contains('participant_ids', [profile.id])
                .order('created_at', { foreignTable: 'messages', ascending: false })
                .limit(1, { foreignTable: 'messages' });

            if (conversationsError) {
                if (conversationsError.message && conversationsError.message.includes('relation "public.conversations" does not exist')) {
                    throw new Error('Messaging Setup Missing: Please go to Settings > Advanced and run the "4. Messaging Setup" script.');
                }
                throw conversationsError;
            }

            // 3. Enrich conversations with participant details and last message
            const enrichedConversations: Conversation[] = (conversationsData || [])
                .map(convo => {
                    const participants = convo.participant_ids
                        .map((id: string) => id === profile.id ? profile : usersMap.get(id))
                        .filter(Boolean) as Profile[];
                    
                    const otherParticipantId = convo.participant_ids.find((id: string) => id !== profile.id);
                    const other_participant = usersMap.get(otherParticipantId || '') || profile; // Fallback to self if 1-on-1 with self (rare)
                    
                    return {
                        ...convo,
                        participants,
                        other_participant,
                        last_message: convo.messages[0] || null,
                        unread_count: 0 // Placeholder for future implementation
                    };
                })
                .sort((a, b) => {
                    const timeA = a.last_message?.created_at || a.created_at;
                    const timeB = b.last_message?.created_at || b.created_at;
                    return new Date(timeB).getTime() - new Date(timeA).getTime();
                });

            setConversations(enrichedConversations);
        } catch (err: unknown) {
            console.error("Error fetching messages data:", err);
            let message = "Failed to load conversation data.";
            if (err && typeof err === 'object' && 'message' in err) {
                message = String((err as { message: string }).message);
            }
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [profile.id]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

     // Effect to handle initial conversation selection from props
    useEffect(() => {
        if (initialConversationId && conversations.length > 0) {
            const convoToSelect = conversations.find(c => c.id === initialConversationId);
            if (convoToSelect) {
                setSelectedConversation(convoToSelect);
            }
        }
    }, [initialConversationId, conversations]);

    // Fetch messages for the selected conversation
    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedConversation) {
                setMessages([]);
                return;
            };

            const { data, error: messagesError } = await supabase
                .from('messages')
                .select('*, sender:profiles(id, full_name, role, avatar_url)')
                .eq('conversation_id', selectedConversation.id)
                .order('created_at', { ascending: true });

            if (messagesError) {
                console.error("Error fetching messages:", messagesError);
                let message = "Failed to fetch messages.";
                if (messagesError && typeof messagesError === 'object' && 'message' in messagesError) {
                    message = String((messagesError as { message: string }).message);
                }
                setError(message);
            } else {
                setMessages(data as any[] || []);
            }
        };
        fetchMessages();
    }, [selectedConversation]);
    
    // Real-time subscription for new messages
    useEffect(() => {
        if (!selectedConversation) return;

        const channel = supabase.channel(`messages_${selectedConversation.id}`)
            .on<Message>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` },
                async (payload) => {
                    const { data: senderProfile, error: senderError } = await supabase.from('profiles').select('id, full_name, role, avatar_url').eq('id', payload.new.sender_id).single();
                    if (senderError) {
                        console.error("Error fetching sender profile:", senderError);
                        let message = "Failed to load new message details.";
                        if (senderError && typeof senderError === 'object' && 'message' in senderError) {
                           message = String((senderError as { message: string }).message);
                        }
                        setError(message);
                    }
                    else {
                        const newMessageWithSender = { ...payload.new, sender: senderProfile } as Message;
                        setMessages(currentMessages => [...currentMessages, newMessageWithSender]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedConversation]);


    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isCreatingGroupLoading, setIsCreatingGroupLoading] = useState(false);
    const [selectedGroupUsers, setSelectedGroupUsers] = useState<Profile[]>([]);
    const [groupName, setGroupName] = useState("");

    // Clear message notifications when a conversation is selected
    useEffect(() => {
        if (selectedConversation) {
            const clearMessageNotifications = async () => {
                await supabase
                    .from('notifications')
                    .delete()
                    .eq('user_id', profile.id)
                    .eq('type', 'message');
            };
            clearMessageNotifications();
        }
    }, [selectedConversation, profile.id]);

    const handleSelectConversation = (conversation: Conversation) => {
        setError(null);
        setSelectedConversation(conversation);
    };

    const handleStartNewConversation = async (otherUser: Profile) => {
        setError(null);
        setShowNewChatList(false);
        // Check if a conversation already exists
        const existingConvo = conversations.find(c => !c.is_group && c.participant_ids.includes(otherUser.id) && c.participant_ids.length === 2);
        if (existingConvo) {
            setSelectedConversation(existingConvo);
            return;
        }

        // Create a new conversation
        const participant_ids = [profile.id, otherUser.id];
        const { data, error: createError } = await supabase
            .from('conversations')
            .insert({ participant_ids, is_group: false })
            .select()
            .single();

        if (createError) {
            console.error("Error creating conversation:", createError);
            let message = "Failed to start a new conversation.";
            if (createError && typeof createError === 'object' && 'message' in createError) {
                message = String((createError as { message: string }).message);
            }
            setError(message);
            return;
        }

        const newConvo: Conversation = {
            ...data,
            other_participant: otherUser,
            participants: [profile, otherUser],
            unread_count: 0
        };
        setConversations(prev => [newConvo, ...prev]);
        setSelectedConversation(newConvo);
    };

    const handleStartGroupConversation = async () => {
        if (selectedGroupUsers.length === 0) return;
        
        setError(null);
        setIsCreatingGroupLoading(true);
        
        try {
            const participant_ids = [profile.id, ...selectedGroupUsers.map(u => u.id)];
            const { data, error: createError } = await supabase
                .from('conversations')
                .insert({ 
                    participant_ids, 
                    is_group: true, 
                    group_name: groupName.trim() || 'New Group' 
                })
                .select()
                .single();

            if (createError) throw createError;

            const newConvo: Conversation = {
                ...data,
                other_participant: selectedGroupUsers[0], // Fallback
                participants: [profile, ...selectedGroupUsers],
                unread_count: 0
            };
            
            setConversations(prev => [newConvo, ...prev]);
            setSelectedConversation(newConvo);
            setShowNewChatList(false);
            setSelectedGroupUsers([]);
            setGroupName("");
            setIsCreatingGroup(false);
        } catch (err: any) {
            console.error("Error creating group:", err);
            setError(err.message || "Failed to create group chat.");
        } finally {
            setIsCreatingGroupLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;
        setError(null);
        setIsSending(true);
        const { error: sendError } = await supabase.from('messages').insert({
            conversation_id: selectedConversation.id,
            sender_id: profile.id,
            content: newMessage.trim(),
        });
        if (sendError) {
            console.error("Error sending message:", sendError);
            let message = "Failed to send message.";
            if (sendError && typeof sendError === 'object' && 'message' in sendError) {
                message = String((sendError as { message: string }).message);
            }
            setError(message);
        } else {
            // Create a notification for the recipients
            const recipientIds = selectedConversation.participant_ids.filter(id => id !== profile.id);
            
            if (recipientIds.length > 0) {
                const notifications = recipientIds.map(id => ({
                    user_id: id,
                    title: selectedConversation.is_group 
                        ? `New message in ${selectedConversation.group_name}`
                        : `New message from ${profile.full_name}`,
                    message: newMessage.trim().substring(0, 50) + (newMessage.trim().length > 50 ? '...' : ''),
                    type: 'message',
                    link: `#`
                }));
                
                await supabase.from('notifications').insert(notifications);
            }
            setNewMessage('');
        }
        setIsSending(false);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const filteredConversations = conversations.filter(c => {
        const searchTarget = c.is_group 
            ? (c.group_name || 'Group Chat') 
            : c.other_participant.full_name;
        return searchTarget.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const filteredUsers = allUsers.filter(u => 
        u.full_name.toLowerCase().includes(userSearchTerm.toLowerCase()) &&
        !conversations.some(c => c.participant_ids.includes(u.id))
    );

    const formatMessageTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const oneDay = 24 * 60 * 60 * 1000;

        if (diff < oneDay && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < oneDay * 2) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border dark:border-gray-800 relative">
            {error && (
                <div className="absolute top-4 right-4 z-50 p-4 max-w-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 transition-colors">
                        <Plus className="w-4 h-4 rotate-45" />
                    </button>
                </div>
            )}

            {/* Left Pane: Conversations List */}
            <div className={`w-full md:w-80 lg:w-96 border-r dark:border-gray-800 flex flex-col bg-gray-50/50 dark:bg-gray-900/50 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Chats</h2>
                        <button 
                            onClick={() => setShowNewChatList(true)}
                            className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-600/20 transition-all active:scale-90"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search conversations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500 shadow-sm transition-all"
                        />
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto px-2 pb-4 space-y-1">
                    {isLoading ? (
                        <div className="p-8 text-center space-y-3">
                            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">Loading chats...</p>
                        </div>
                    ) : filteredConversations.length > 0 ? (
                        filteredConversations.map(convo => {
                            const displayName = convo.is_group ? (convo.group_name || 'Group Chat') : convo.other_participant.full_name;
                            const isSelected = selectedConversation?.id === convo.id;
                            
                            return (
                                <button
                                    key={convo.id}
                                    onClick={() => handleSelectConversation(convo)}
                                    className={`w-full text-left p-4 rounded-2xl flex items-center gap-4 transition-all group ${isSelected ? 'bg-white dark:bg-gray-800 shadow-md scale-[1.02] z-10' : 'hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                                >
                                    <div className="relative flex-shrink-0">
                                        {convo.is_group ? (
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                                                <Users className="w-6 h-6" />
                                            </div>
                                        ) : convo.other_participant.avatar_url ? (
                                            <img 
                                                src={convo.other_participant.avatar_url} 
                                                alt={displayName}
                                                className="w-12 h-12 rounded-2xl object-cover shadow-md"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                                                {getInitials(displayName)}
                                            </div>
                                        )}
                                        {!convo.is_group && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {convo.last_message ? formatMessageTime(convo.last_message.created_at) : ''}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className={`text-xs truncate ${isSelected ? 'text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                                                {convo.last_message?.content || 'Start a conversation'}
                                            </p>
                                            {convo.unread_count > 0 && (
                                                <span className="w-5 h-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-brand-600/20">
                                                    {convo.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">No conversations found</p>
                            <button 
                                onClick={() => setShowNewChatList(true)}
                                className="mt-4 text-sm font-bold text-brand-600 hover:underline"
                            >
                                Start your first chat
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane: Chat Window */}
            <div className={`flex-grow flex flex-col bg-white dark:bg-gray-900 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 md:p-6 border-b dark:border-gray-800 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelectedConversation(null)}
                                    className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                {selectedConversation.is_group ? (
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center font-bold text-brand-700 dark:text-brand-400 shadow-inner">
                                        <Users className="w-6 h-6" />
                                    </div>
                                ) : selectedConversation.other_participant.avatar_url ? (
                                    <img 
                                        src={selectedConversation.other_participant.avatar_url} 
                                        alt={selectedConversation.other_participant.full_name}
                                        className="w-10 h-10 md:w-12 md:h-12 rounded-2xl object-cover shadow-md"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center font-bold text-brand-700 dark:text-brand-400 shadow-inner">
                                        {getInitials(selectedConversation.other_participant.full_name)}
                                    </div>
                                )}
                                <div>
                                    <h2 className="font-black text-gray-900 dark:text-white leading-tight">
                                        {selectedConversation.is_group 
                                            ? (selectedConversation.group_name || 'Group Chat') 
                                            : selectedConversation.other_participant.full_name}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        {!selectedConversation.is_group && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                            {selectedConversation.is_group 
                                                ? `${selectedConversation.participant_ids.length} participants` 
                                                : selectedConversation.other_participant.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-grow p-4 md:p-8 overflow-y-auto space-y-6 bg-gray-50/30 dark:bg-gray-900/30">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === profile.id;
                                const showAvatar = idx === 0 || messages[idx-1].sender_id !== msg.sender_id;
                                const sender = msg.sender 
                                    || selectedConversation.participants?.find(p => p.id === msg.sender_id) 
                                    || (isMe ? profile : selectedConversation.other_participant);
                                
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 group`}>
                                        {!isMe && (
                                            <div className={`flex-shrink-0 mb-1 ${!showAvatar ? 'opacity-0' : ''}`}>
                                                {sender.avatar_url ? (
                                                    <img 
                                                        src={sender.avatar_url} 
                                                        alt={sender.full_name}
                                                        className="w-8 h-8 rounded-xl object-cover shadow-sm"
                                                        referrerPolicy="no-referrer"
                                                        title={sender.full_name}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-white" title={sender.full_name}>
                                                        {getInitials(sender.full_name)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className={`max-w-[85%] md:max-w-[70%] space-y-1`}>
                                            {!isMe && showAvatar && selectedConversation.is_group && (
                                                <span className="text-[10px] font-bold text-gray-500 ml-1">{sender.full_name}</span>
                                            )}
                                            <div className={`px-4 py-3 rounded-2xl shadow-sm relative ${isMe ? 'bg-brand-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none border dark:border-gray-700'}`}>
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                            <div className={`flex items-center gap-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && <CheckCheck className="w-3 h-3 text-brand-400" />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 md:p-6 bg-white dark:bg-gray-900 border-t dark:border-gray-800">
                            <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-5xl mx-auto">
                                <div className="flex-grow relative">
                                    <textarea
                                        rows={1}
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e as any);
                                            }
                                        }}
                                        placeholder="Type a message..."
                                        className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 resize-none max-h-32 transition-all scrollbar-hide dark:text-white dark:placeholder-gray-400"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={isSending || !newMessage.trim()} 
                                        className="absolute right-2 bottom-2 p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-90"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center p-12 text-center bg-gray-50/30 dark:bg-gray-900/30">
                        <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center mb-8 animate-bounce duration-[3000ms]">
                            <MessageSquare className="w-12 h-12 text-brand-600" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Your Messages</h3>
                        <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
                            Select a conversation from the left to start chatting with your colleagues and parents.
                        </p>
                        <button 
                            onClick={() => setShowNewChatList(true)}
                            className="mt-8 px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xl shadow-brand-600/20 transition-all active:scale-95"
                        >
                            Start New Chat
                        </button>
                    </div>
                )}
            </div>

            {/* New Chat Modal/Overlay */}
            {showNewChatList && (
                <div className="absolute inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-in fade-in slide-in-from-bottom-8">
                    <div className="p-6 border-b dark:border-gray-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => {
                                    setShowNewChatList(false);
                                    setIsCreatingGroup(false);
                                    setSelectedGroupUsers([]);
                                    setGroupName("");
                                }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 dark:text-white" />
                            </button>
                            <h2 className="text-xl font-black tracking-tight dark:text-white">
                                {isCreatingGroup ? 'New Group Chat' : 'New Message'}
                            </h2>
                        </div>
                        <button
                            onClick={() => {
                                setIsCreatingGroup(!isCreatingGroup);
                                setSelectedGroupUsers([]);
                                setGroupName("");
                            }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isCreatingGroup ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50'}`}
                        >
                            {isCreatingGroup ? 'Cancel Group' : 'Create Group'}
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        {isCreatingGroup && (
                            <div className="relative">
                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Group Name (optional)"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl text-base focus:ring-2 focus:ring-brand-500 shadow-inner transition-all"
                                />
                            </div>
                        )}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search people by name or role..."
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-800 border-none rounded-2xl text-base focus:ring-2 focus:ring-brand-500 shadow-inner transition-all"
                                autoFocus={!isCreatingGroup}
                            />
                        </div>
                        
                        {isCreatingGroup && selectedGroupUsers.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {selectedGroupUsers.map(u => (
                                    <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm font-medium">
                                        <span>{u.full_name}</span>
                                        <button 
                                            onClick={() => setSelectedGroupUsers(prev => prev.filter(user => user.id !== u.id))}
                                            className="p-0.5 hover:bg-brand-200 dark:hover:bg-brand-800 rounded-full transition-colors"
                                        >
                                            <Plus className="w-3 h-3 rotate-45" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-grow overflow-y-auto px-4 pb-8 space-y-8">
                        {/* Teachers Section */}
                        <div>
                            <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Teachers & Staff</h3>
                            <div className="space-y-1">
                                {filteredUsers.filter(u => u.role === UserRole.Teacher || u.role === UserRole.Headteacher).length > 0 ? (
                                    filteredUsers.filter(u => u.role === UserRole.Teacher || u.role === UserRole.Headteacher).map(user => {
                                        const isSelected = selectedGroupUsers.some(u => u.id === user.id);
                                        return (
                                            <button 
                                                key={user.id}
                                                onClick={() => {
                                                    if (isCreatingGroup) {
                                                        if (isSelected) {
                                                            setSelectedGroupUsers(prev => prev.filter(u => u.id !== user.id));
                                                        } else {
                                                            setSelectedGroupUsers(prev => [...prev, user]);
                                                        }
                                                    } else {
                                                        handleStartNewConversation(user);
                                                    }
                                                }} 
                                                className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all group ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {user.avatar_url ? (
                                                        <img 
                                                            src={user.avatar_url} 
                                                            alt={user.full_name}
                                                            className="w-12 h-12 rounded-2xl object-cover shadow-md"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all ${isSelected ? 'bg-brand-600 text-white' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 group-hover:bg-brand-600 group-hover:text-white'}`}>
                                                            {getInitials(user.full_name)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{user.full_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                                                    </div>
                                                </div>
                                                {isCreatingGroup && (
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                        {isSelected && <CheckCheck className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <p className="px-4 text-sm text-gray-500 italic">No staff found matching your search.</p>
                                )}
                            </div>
                        </div>

                        {/* Others Section */}
                        <div>
                            <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Others</h3>
                            <div className="space-y-1">
                                {filteredUsers.filter(u => u.role !== UserRole.Teacher && u.role !== UserRole.Headteacher).length > 0 ? (
                                    filteredUsers.filter(u => u.role !== UserRole.Teacher && u.role !== UserRole.Headteacher).map(user => {
                                        const isSelected = selectedGroupUsers.some(u => u.id === user.id);
                                        return (
                                            <button 
                                                key={user.id}
                                                onClick={() => {
                                                    if (isCreatingGroup) {
                                                        if (isSelected) {
                                                            setSelectedGroupUsers(prev => prev.filter(u => u.id !== user.id));
                                                        } else {
                                                            setSelectedGroupUsers(prev => [...prev, user]);
                                                        }
                                                    } else {
                                                        handleStartNewConversation(user);
                                                    }
                                                }} 
                                                className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all group ${isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {user.avatar_url ? (
                                                        <img 
                                                            src={user.avatar_url} 
                                                            alt={user.full_name}
                                                            className="w-12 h-12 rounded-2xl object-cover shadow-md"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all ${isSelected ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-brand-600 group-hover:text-white'}`}>
                                                            {getInitials(user.full_name)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{user.full_name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                                                    </div>
                                                </div>
                                                {isCreatingGroup && (
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                        {isSelected && <CheckCheck className="w-3 h-3 text-white" />}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <p className="px-4 text-sm text-gray-500 italic">No other users found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {isCreatingGroup && selectedGroupUsers.length > 0 && (
                        <div className="p-6 border-t dark:border-gray-800 bg-white dark:bg-gray-900">
                            <button
                                onClick={handleStartGroupConversation}
                                disabled={isCreatingGroupLoading}
                                className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-xl shadow-brand-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{isCreatingGroupLoading ? 'Creating...' : `Create Group with ${selectedGroupUsers.length} ${selectedGroupUsers.length === 1 ? 'person' : 'people'}`}</span>
                                {!isCreatingGroupLoading && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MessagesPage;
