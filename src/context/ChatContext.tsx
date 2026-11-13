import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, UserStatus, Community, MessageType, MessageAttachment } from '../types';
import { useAuth } from './AuthContext';
import { sounds } from '../utils/sound';

export type MainTab = 'chats' | 'communities' | 'status' | 'calls' | 'profile';

interface ToastAlert {
  id: string;
  title: string;
  body: string;
  avatar?: string;
  conversationId?: string;
}

interface ChatContextType {
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeConversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  sendMessage: (text: string, type?: MessageType, attachment?: MessageAttachment, replyToId?: string) => Promise<boolean>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  editMessage: (messageId: string, text: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  pinConversation: (convId: string) => Promise<void>;
  createDirectChat: (targetUserId: string) => Promise<string | null>;
  createGroupChat: (name: string, memberIds: string[], description?: string, icon?: string) => Promise<string | null>;
  markConversationRead: (convId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  seedDevConversations: () => Promise<boolean>;
  
  // Status
  statuses: UserStatus[];
  refreshStatuses: () => Promise<void>;
  createStatus: (data: { type: 'text' | 'image' | 'video'; content: string; caption?: string; backgroundColor?: string; privacy?: 'everyone' | 'contacts' }) => Promise<boolean>;
  viewStatus: (statusId: string) => Promise<void>;
  deleteStatus: (statusId: string) => Promise<void>;

  // Communities
  communities: Community[];
  refreshCommunities: () => Promise<void>;
  createCommunity: (name: string, description: string, icon?: string) => Promise<string | null>;
  joinCommunity: (commId: string) => Promise<void>;
  postAnnouncement: (commId: string, title: string, content: string) => Promise<void>;

  // In-app Notification Banner
  toast: ToastAlert | null;
  dismissToast: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, token } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [statuses, setStatuses] = useState<UserStatus[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [toast, setToast] = useState<ToastAlert | null>(null);

  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = activeConversationId;

  const dismissToast = () => setToast(null);

  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const refreshStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/statuses');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshCommunities = useCallback(async () => {
    try {
      const res = await fetch('/api/communities');
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !token) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;
    const fetchMsgs = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${activeConversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setMessages(data.messages || []);
          markConversationRead(activeConversationId);
        }
      } catch {
        // ignore
      } finally {
        if (isSubscribed) setLoadingMessages(false);
      }
    };

    fetchMsgs();
    return () => {
      isSubscribed = false;
    };
  }, [activeConversationId, token]);

  // Initial load
  useEffect(() => {
    if (currentUser) {
      refreshConversations();
      refreshStatuses();
      refreshCommunities();
    }
  }, [currentUser, refreshConversations, refreshStatuses, refreshCommunities]);

  // Real-time SSE Connection
  useEffect(() => {
    if (!currentUser || !token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let isDisposed = false;

    const connectSSE = async () => {
      try {
        const ticketResponse = await fetch('/api/events/ticket', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ticketResponse.ok) throw new Error('Could not authenticate event stream');
        const ticketData = await ticketResponse.json();
        if (isDisposed) return;
        eventSource = new EventSource(`/api/events?ticket=${encodeURIComponent(ticketData.ticket)}`);

      eventSource.addEventListener('new_message', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const msg: Message = payload.message;
          const convId: string = payload.conversationId;

          if (activeConvRef.current === convId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Mark read if it's currently open
            if (msg.senderId !== currentUser.id) {
              markConversationRead(convId);
              sounds.playReceived();
            }
          } else {
            // Not in active chat: show toast notification
            if (msg.senderId !== currentUser.id) {
              sounds.playReceived();
              setToast({
                id: msg.id,
                title: msg.senderName,
                body: msg.text || 'Media attachment',
                avatar: msg.senderAvatar,
                conversationId: convId,
              });
            }
          }

          refreshConversations();
        } catch {
          // parse err
        }
      });

      eventSource.addEventListener('message_reaction', (e) => {
        try {
          const payload = JSON.parse(e.data);
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m))
          );
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('message_edited', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const editedMsg = payload.message;
          setMessages((prev) => prev.map((m) => (m.id === editedMsg.id ? editedMsg : m)));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('message_deleted', (e) => {
        try {
          const payload = JSON.parse(e.data);
          setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
          refreshConversations();
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('messages_read', (e) => {
        try {
          const payload = JSON.parse(e.data);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.conversationId === payload.conversationId && m.senderId === currentUser.id) {
                return { ...m, status: 'read' };
              }
              return m;
            })
          );
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('new_status', (e) => {
        try {
          const newStatus = JSON.parse(e.data);
          setStatuses((prev) => [newStatus, ...prev.filter((s) => s.id !== newStatus.id)]);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('user_status', (e) => {
        try {
          const { userId, online, lastSeen } = JSON.parse(e.data);
          setConversations((prev) =>
            prev.map((c) => ({
              ...c,
              memberDetails: c.memberDetails?.map((m) =>
                m.id === userId ? { ...m, online, lastSeen } : m
              ),
            }))
          );
        } catch {
          // ignore
        }
      });

        eventSource.onerror = () => {
          eventSource?.close();
          if (!isDisposed) reconnectTimeout = window.setTimeout(() => { void connectSSE(); }, 3000);
        };
      } catch {
        if (!isDisposed) reconnectTimeout = window.setTimeout(() => { void connectSSE(); }, 3000);
      }
    };

    void connectSSE();

    return () => {
      isDisposed = true;
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [currentUser, token, refreshConversations]);

  const sendMessage = async (
    text: string,
    type: MessageType = 'text',
    attachment?: MessageAttachment,
    replyToId?: string
  ): Promise<boolean> => {
    if (!token || !activeConversationId || (!text && !attachment)) return false;

    sounds.playSent();
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: activeConversationId,
          text,
          type,
          attachment,
          replyToId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        refreshConversations();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch {
      // ignore
    }
  };

  const editMessage = async (messageId: string, text: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/messages/${messageId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } catch {
      // ignore
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        refreshConversations();
      }
    } catch {
      // ignore
    }
  };

  const pinConversation = async (convId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/conversations/${convId}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshConversations();
      }
    } catch {
      // ignore
    }
  };

  const createDirectChat = async (targetUserId: string): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'direct', targetUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshConversations();
        setActiveConversationId(data.conversation.id);
        setActiveTab('chats');
        return data.conversation.id;
      }
      return null;
    } catch {
      return null;
    }
  };

  const createGroupChat = async (
    name: string,
    memberIds: string[],
    description?: string,
    icon?: string
  ): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'group',
          name,
          memberIds,
          description,
          icon,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshConversations();
        setActiveConversationId(data.conversation.id);
        setActiveTab('chats');
        return data.conversation.id;
      }
      return null;
    } catch {
      return null;
    }
  };

  const markConversationRead = async (convId: string) => {
    if (!token) return;
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: convId }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch {
      // ignore
    }
  };

  const createStatus = async (data: {
    type: 'text' | 'image' | 'video';
    content: string;
    caption?: string;
    backgroundColor?: string;
    privacy?: 'everyone' | 'contacts';
  }): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshStatuses();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const viewStatus = async (statusId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/statuses/${statusId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  };

  const deleteStatus = async (statusId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/statuses/${statusId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStatuses((prev) => prev.filter((s) => s.id !== statusId));
      }
    } catch {
      // ignore
    }
  };

  const createCommunity = async (
    name: string,
    description: string,
    icon?: string
  ): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description, icon }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshCommunities();
        return data.community.id;
      }
      return null;
    } catch {
      return null;
    }
  };

  const joinCommunity = async (commId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/communities/${commId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshCommunities();
    } catch {
      // ignore
    }
  };

  const postAnnouncement = async (commId: string, title: string, content: string) => {
    if (!token) return;
    try {
      await fetch(`/api/communities/${commId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content }),
      });
      await refreshCommunities();
    } catch {
      // ignore
    }
  };

  const seedDevConversations = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/dev/seed-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: currentUser?.id }),
      });
      if (res.ok) {
        await refreshConversations();
        setToast({
          id: 'toast_seed_' + Date.now(),
          title: 'Demo Conversations Seeded',
          body: 'Loaded development sample conversations (Alex, Sarah, GB Core Team, Kunal, Jordan).',
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  return (
    <ChatContext.Provider
      value={{
        activeTab,
        setActiveTab,
        conversations,
        activeConversationId,
        setActiveConversationId,
        activeConversation,
        messages,
        loadingMessages,
        sendMessage,
        reactToMessage,
        editMessage,
        deleteMessage,
        pinConversation,
        createDirectChat,
        createGroupChat,
        markConversationRead,
        refreshConversations,
        seedDevConversations,
        statuses,
        refreshStatuses,
        createStatus,
        viewStatus,
        deleteStatus,
        communities,
        refreshCommunities,
        createCommunity,
        joinCommunity,
        postAnnouncement,
        toast,
        dismissToast,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
