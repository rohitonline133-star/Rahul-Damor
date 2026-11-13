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
  deleteMessage: (messageId: string) => Promise<boolean>;
  pinConversation: (convId: string) => Promise<void>;
  createDirectChat: (targetUserId: string) => Promise<string | null>;
  createGroupChat: (name: string, memberIds: string[], description?: string, icon?: string, communityId?: string) => Promise<string | null>;
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
    if (!token) {
      setStatuses([]);
      return;
    }
    try {
      const res = await fetch('/api/statuses', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.statuses || []);
      } else if (res.status === 401) {
        setStatuses([]);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const refreshCommunities = useCallback(async () => {
    if (!token) {
      setCommunities([]);
      return;
    }
    try {
      const res = await fetch('/api/communities', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities || []);
      } else if (res.status === 401) {
        setCommunities([]);
      }
    } catch {
      // ignore
    }
  }, [token]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !token) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;
    const conversationId = activeConversationId;
    const fetchMsgs = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (isSubscribed && activeConvRef.current === conversationId) {
            const fetchedMessages = Array.isArray(data?.messages)
              ? data.messages.filter((message: unknown) =>
                  !!message && typeof message === 'object' &&
                  typeof (message as Message).id === 'string' &&
                  (message as Message).conversationId === conversationId
                )
              : [];
            // Preserve messages delivered by SSE while this history request was in flight.
            // Merge by ID so a late history response cannot erase a newer real-time message.
            setMessages((previous) => {
              const merged = new Map<string, Message>();
              for (const message of fetchedMessages) merged.set(message.id, message);
              for (const message of previous) {
                if (message.conversationId === conversationId && !merged.has(message.id)) {
                  merged.set(message.id, message);
                }
              }
              return Array.from(merged.values()).sort((a, b) => {
                const aTime = Number.isFinite(a.createdAt) ? a.createdAt : 0;
                const bTime = Number.isFinite(b.createdAt) ? b.createdAt : 0;
                return aTime - bTime;
              });
            });
            markConversationRead(conversationId);
          }
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
          const msg = payload?.message as Message | undefined;
          const convId = payload?.conversationId;

          if (!msg || typeof msg.id !== 'string' ||
              typeof convId !== 'string' || msg.conversationId !== convId) return;

          if (activeConvRef.current === convId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg].sort((a, b) => {
                const aTime = Number.isFinite(a.createdAt) ? a.createdAt : 0;
                const bTime = Number.isFinite(b.createdAt) ? b.createdAt : 0;
                return aTime - bTime;
              });
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
                body: msg.text || (
                  msg.type === 'audio' ? 'Voice note' :
                  msg.type === 'video' ? 'Video' :
                  msg.type === 'image' ? 'Photo' :
                  msg.type === 'document' ? 'Document' :
                  msg.type === 'location' ? 'Location' :
                  msg.type === 'poll' ? 'Poll' : 'Media attachment'
                ),
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
          if (typeof payload?.messageId !== 'string' ||
              typeof payload?.conversationId !== 'string' ||
              !Array.isArray(payload?.reactions) ||
              activeConvRef.current !== payload.conversationId) return;
          setMessages((prev) =>
            prev.map((message) => message.id === payload.messageId &&
              message.conversationId === payload.conversationId
              ? { ...message, reactions: payload.reactions }
              : message)
          );
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('message_edited', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const editedMsg = payload?.message as Message | undefined;
          if (!editedMsg || typeof editedMsg.id !== 'string' ||
              typeof editedMsg.conversationId !== 'string' ||
              activeConvRef.current !== editedMsg.conversationId) return;
          setMessages((prev) => prev.map((message) =>
            message.id === editedMsg.id &&
            message.conversationId === editedMsg.conversationId ? editedMsg : message
          ));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('message_deleted', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (typeof payload?.messageId !== 'string' ||
              typeof payload?.conversationId !== 'string' ||
              activeConvRef.current !== payload.conversationId) return;
          setMessages((prev) => prev.filter((message) =>
            !(message.id === payload.messageId &&
              message.conversationId === payload.conversationId)
          ));
          refreshConversations();
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('messages_read', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (typeof payload?.conversationId !== 'string' ||
              typeof payload?.userId !== 'string' ||
              !Number.isSafeInteger(payload.readAt) || payload.readAt < 0) return;

          // A read receipt is broadcast to every member device. Clear this user's
          // unread badge even when the conversation is not open on this device.
          if (payload.userId === currentUser.id) {
            setConversations((prev) =>
              prev.map((conversation) =>
                conversation.id === payload.conversationId
                  ? { ...conversation, unreadCount: 0 }
                  : conversation
              )
            );
          }

          if (activeConvRef.current !== payload.conversationId) return;
          const fullyReadIds = new Set(
            Array.isArray(payload.fullyReadMessageIds)
              ? payload.fullyReadMessageIds.filter((id: unknown): id is string => typeof id === 'string')
              : []
          );
          setMessages((prev) =>
            prev.map((m) => {
              if (m.conversationId !== payload.conversationId || m.senderId !== currentUser.id) {
                return m;
              }
              const readBy = Array.isArray(m.readBy) ? m.readBy : [];
              const alreadyRecorded = readBy.some((receipt) => receipt?.userId === payload.userId);
              const nextReadBy = alreadyRecorded
                ? readBy
                : [...readBy, { userId: payload.userId, readAt: payload.readAt }];
              return {
                ...m,
                readBy: nextReadBy,
                status: fullyReadIds.has(m.id) ? 'read' : 'delivered',
              };
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

    // Capture the target before awaiting the network: the user may switch chats
    // while this request is in flight.
    const targetConversationId = activeConversationId;
    sounds.playSent();
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: targetConversationId,
          text,
          type,
          attachment,
          replyToId,
        }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      const sentMessage = data?.message;
      if (!sentMessage || typeof sentMessage.id !== 'string' ||
          sentMessage.conversationId !== targetConversationId) {
        return false;
      }

      // Never append a late response from another chat into the currently
      // visible conversation. SSE/fetch for the target chat can load it later.
      if (activeConvRef.current === targetConversationId) {
        setMessages((prev) => {
          if (prev.some((message) => message.id === sentMessage.id)) return prev;
          return [...prev, sentMessage].sort((a, b) => {
            const aTime = Number.isFinite(a.createdAt) ? a.createdAt : 0;
            const bTime = Number.isFinite(b.createdAt) ? b.createdAt : 0;
            return aTime - bTime;
          });
        });
      }
      refreshConversations();
      return true;
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

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!token || !messageId) return false;
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      refreshConversations();
      return true;
    } catch {
      return false;
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
    icon?: string,
    communityId?: string
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
          ...(communityId ? { communityId } : {}),
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
    if (!token || typeof convId !== 'string' || !convId.trim() || convId.length > 128) return;
    try {
      const res = await fetch('/api/messages/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: convId }),
      });
      if (!res.ok) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch {
      // Keep the unread count until the server confirms the read receipt.
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
