import React, { useState } from 'react';
import {
  Pin,
  VolumeX,
  Check,
  CheckCheck,
  UserCheck,
  MessageSquareDashed,
  Clock,
  Camera,
  Mic,
  FileText,
  Video,
  Sparkles,
  Loader2,
  Users,
  FilterX,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { Conversation } from '../../types';

interface ChatListProps {
  onSelectConversation: (convId: string) => void;
  onOpenNewChat: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({ onSelectConversation, onOpenNewChat }) => {
  const { conversations, seedDevConversations } = useChat();
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups' | 'pinned'>('all');
  const [isSeeding, setIsSeeding] = useState(false);

  const filteredConversations = conversations.filter((c) => {
    if (filter === 'unread') return (c.unreadCount || 0) > 0;
    if (filter === 'groups') return c.type === 'group';
    if (filter === 'pinned') return c.pinnedForUserIds?.includes(currentUser?.id || '');
    return true;
  });

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    await seedDevConversations();
    setIsSeeding(false);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getConversationDetails = (conv: Conversation) => {
    if (conv.type === 'group') {
      return {
        name: conv.name || 'Group Chat',
        avatar:
          conv.icon ||
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
        online: false,
        isVerified: false,
        isMuted: false,
        isGroup: true,
      };
    }

    const otherMember = conv.memberDetails?.find((m) => m.id !== currentUser?.id);
    const myMemberRecord = conv.members.find((m) => m.userId === currentUser?.id);

    return {
      name: otherMember?.displayName || 'Chat',
      avatar:
        otherMember?.avatar ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      online: Boolean(otherMember?.online),
      isVerified: Boolean(otherMember?.isVerified),
      isMuted: Boolean(myMemberRecord?.isMuted),
      isGroup: false,
    };
  };

  const renderMessageSnippet = (conv: Conversation, isMeSender: boolean) => {
    if (!conv.lastMessage) {
      return <span className="text-slate-400 dark:text-[#8696a0] italic">No messages yet</span>;
    }

    const msg = conv.lastMessage;
    const isRead = msg.status === 'read';

    return (
      <div className="flex items-center gap-1 min-w-0">
        {/* Outgoing status ticks */}
        {isMeSender && (
          <span className="shrink-0 mr-0.5">
            {isRead ? (
              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
            ) : msg.status === 'delivered' ? (
              <CheckCheck className="w-3.5 h-3.5 text-slate-400 dark:text-[#8696a0]" />
            ) : msg.status === 'sending' ? (
              <Clock className="w-3 h-3 text-slate-400" />
            ) : (
              <Check className="w-3.5 h-3.5 text-slate-400 dark:text-[#8696a0]" />
            )}
          </span>
        )}

        {/* Media type icon prefix */}
        {msg.type === 'image' && <Camera className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
        {msg.type === 'video' && <Video className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
        {msg.type === 'audio' && <Mic className="w-3.5 h-3.5 text-[#00a884] dark:text-[#25d366] shrink-0" />}
        {msg.type === 'document' && <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />}

        <span className="truncate">
          {msg.type === 'image'
            ? 'Photo'
            : msg.type === 'video'
            ? 'Video'
            : msg.type === 'audio'
            ? `Voice note (${msg.attachment?.duration || 4}s)`
            : msg.type === 'document'
            ? msg.attachment?.name || 'Document'
            : msg.text}
        </span>
      </div>
    );
  };

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const groupsCount = conversations.filter((c) => c.type === 'group').length;
  const pinnedCount = conversations.filter((c) => c.pinnedForUserIds?.includes(currentUser?.id || '')).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111b21]">
      {/* 4. Chat Filter Chips */}
      <div className="px-3.5 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-[#222e35] shrink-0 bg-white dark:bg-[#111b21]">
        {(['all', 'unread', 'groups', 'pinned'] as const).map((key) => {
          const isActive = filter === key;
          const labels = {
            all: 'All',
            unread: unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread',
            groups: groupsCount > 0 ? `Groups (${groupsCount})` : 'Groups',
            pinned: pinnedCount > 0 ? `Pinned (${pinnedCount})` : 'Pinned',
          };
          return (
            <button
              key={key}
              id={`filter-chip-${key}`}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#00a884] text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-[#8696a0] hover:bg-slate-200 dark:hover:bg-[#2a3942]'
              }`}
            >
              {labels[key]}
            </button>
          );
        })}
      </div>

      {/* 5. Scrollable Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.map((conv) => {
          const details = getConversationDetails(conv);
          const isPinned = conv.pinnedForUserIds?.includes(currentUser?.id || '');
          const isMeSender = conv.lastMessage?.senderId === currentUser?.id;
          const unread = conv.unreadCount || 0;

          return (
            <div key={conv.id} className="relative group">
              <div
                id={`chat-item-${conv.id}`}
                onClick={() => onSelectConversation(conv.id)}
                className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] active:bg-[#eaecef] dark:active:bg-[#182229] cursor-pointer transition select-none"
              >
                {/* Profile Avatar with Online Indicator */}
                <div className="relative shrink-0">
                  <img
                    src={details.avatar}
                    alt={details.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover bg-slate-200 dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700"
                  />
                  {details.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] ring-2 ring-white dark:ring-[#111b21]" />
                  )}
                </div>

                {/* Message Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-[15px] text-[#111b21] dark:text-[#e9edef] truncate">
                        {details.name}
                      </span>
                      {details.isVerified && (
                        <span title="Verified User">
                          <UserCheck className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        </span>
                      )}
                      {details.isGroup && (
                        <span className="px-1.5 py-0.2 text-[9.5px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          Group
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[11.5px] whitespace-nowrap ${
                        unread > 0
                          ? 'text-[#00a884] dark:text-[#25d366] font-bold'
                          : 'text-[#667781] dark:text-[#8696a0]'
                      }`}
                    >
                      {formatTime(conv.lastMessageTime || conv.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[13px] text-[#667781] dark:text-[#8696a0]">
                    <div className="truncate flex-1 min-w-0">
                      {renderMessageSnippet(conv, isMeSender)}
                    </div>

                    {/* Badges & Indicators */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {details.isMuted && (
                        <VolumeX className="w-3.5 h-3.5 text-slate-400 dark:text-[#8696a0]" />
                      )}

                      {isPinned && (
                        <Pin className="w-3.5 h-3.5 text-[#00a884] dark:text-[#25d366] rotate-45" />
                      )}

                      {unread > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#25d366] text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Native hairline divider offset after avatar */}
              <div className="ml-[68px] mr-3 border-b border-slate-100 dark:border-[#222e35]" />
            </div>
          );
        })}

        {/* Empty state when genuinely no conversations in account */}
        {conversations.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#00a884] dark:text-[#25d366] flex items-center justify-center shadow-inner">
              <MessageSquareDashed className="w-8 h-8" />
            </div>
            <div className="max-w-xs space-y-1">
              <p className="font-extrabold text-base text-[#111b21] dark:text-[#e9edef]">
                No conversations yet
              </p>
              <p className="text-xs text-[#667781] dark:text-[#8696a0] leading-relaxed">
                Connect with contacts or populate realistic development sample conversations to test chat layout and real-time messaging.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1 w-full max-w-xs">
              <button
                id="btn-start-first-chat"
                onClick={onOpenNewChat}
                className="w-full py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] active:scale-[0.98] text-white text-xs font-bold transition shadow-sm"
              >
                Start New Chat
              </button>
              <button
                id="btn-seed-demo-conversations"
                disabled={isSeeding}
                onClick={handleSeedDemo}
                className="w-full py-2.5 px-4 rounded-xl border border-[#00a884]/40 hover:bg-[#00a884]/10 active:scale-[0.98] text-[#00a884] dark:text-[#25d366] text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {isSeeding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Load Demo Conversations
              </button>
            </div>
          </div>
        )}

        {/* Empty state when filter has no results */}
        {conversations.length > 0 && filteredConversations.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 my-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-[#202c33] text-slate-400 flex items-center justify-center">
              <FilterX className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#111b21] dark:text-[#e9edef]">
                No {filter} conversations
              </p>
              <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-0.5">
                None of your active chats match the &quot;{filter}&quot; filter.
              </p>
            </div>
            <button
              onClick={() => setFilter('all')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#202c33] text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-[#2a3942] transition"
            >
              Show All Chats
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
