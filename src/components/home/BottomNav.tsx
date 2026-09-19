import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Users2,
  CircleDot,
  PhoneCall,
  User,
  Plus,
  MessageCirclePlus,
  UserPlus,
  Globe,
  Tv,
  FileText,
  BarChart2,
  Image as ImageIcon,
  Video,
  ShoppingBag,
  Megaphone,
} from 'lucide-react';
import { useChat, MainTab } from '../../context/ChatContext';

interface BottomNavProps {
  onOpenNewChat: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateCommunity: () => void;
  onOpenCreateChannel?: () => void;
  onOpenCreateStatus: () => void;
  onOpenCreatePost?: () => void;
  onOpenCreatePoll?: () => void;
  onUploadPhoto?: (file: File) => void;
  onUploadVideo?: (file: File) => void;
  onOpenCreateShopItem?: () => void;
  onOpenBroadcast?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  onOpenNewChat,
  onOpenCreateGroup,
  onOpenCreateCommunity,
  onOpenCreateChannel,
  onOpenCreateStatus,
  onOpenCreatePost,
  onOpenCreatePoll,
  onUploadPhoto,
  onUploadVideo,
  onOpenCreateShopItem,
  onOpenBroadcast,
}) => {
  const { activeTab, setActiveTab, conversations } = useChat();
  const [showFabMenu, setShowFabMenu] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setShowFabMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs: { id: MainTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'chats',
      label: 'Chats',
      icon: <MessageSquare className="w-5 h-5 stroke-[2.2]" />,
      badge: totalUnread,
    },
    {
      id: 'communities',
      label: 'Communities',
      icon: <Users2 className="w-5 h-5 stroke-[2.2]" />,
    },
    {
      id: 'status',
      label: 'Status',
      icon: <CircleDot className="w-5 h-5 stroke-[2.2]" />,
    },
    {
      id: 'calls',
      label: 'Calls',
      icon: <PhoneCall className="w-5 h-5 stroke-[2.2]" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5 stroke-[2.2]" />,
    },
  ];

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onUploadPhoto) onUploadPhoto(file);
      else onOpenCreateStatus();
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onUploadVideo) onUploadVideo(file);
      else onOpenCreateStatus();
    }
  };

  return (
    <>
      <input
        type="file"
        ref={photoInputRef}
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelect}
      />

      {/* Floating Action Button & Menu */}
      <div className="absolute bottom-[72px] right-4 z-40" ref={fabRef}>
        {showFabMenu && (
          <div className="flex flex-col gap-1.5 items-end mb-3 max-h-[70vh] overflow-y-auto p-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Create Shop Item */}
            {onOpenCreateShopItem && (
              <button
                id="fab-action-new-shop-item"
                onClick={() => {
                  setShowFabMenu(false);
                  onOpenCreateShopItem();
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
              >
                <span>Create shop item</span>
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition">
                  <ShoppingBag className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
              </button>
            )}

            {/* Upload Video */}
            <button
              id="fab-action-upload-video"
              onClick={() => {
                setShowFabMenu(false);
                videoInputRef.current?.click();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>Upload video</span>
              <div className="w-7 h-7 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center group-hover:scale-110 transition">
                <Video className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>

            {/* Upload Photo */}
            <button
              id="fab-action-upload-photo"
              onClick={() => {
                setShowFabMenu(false);
                photoInputRef.current?.click();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>Upload photo</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
                <ImageIcon className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>

            {/* Poll */}
            {onOpenCreatePoll && (
              <button
                id="fab-action-create-poll"
                onClick={() => {
                  setShowFabMenu(false);
                  onOpenCreatePoll();
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
              >
                <span>Poll</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                  <BarChart2 className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
              </button>
            )}

            {/* New Post */}
            {onOpenCreatePost && (
              <button
                id="fab-action-new-post"
                onClick={() => {
                  setShowFabMenu(false);
                  onOpenCreatePost();
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
              >
                <span>New post</span>
                <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
                  <FileText className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
              </button>
            )}

            {/* New Status */}
            <button
              id="fab-action-new-status"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateStatus();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New status</span>
              <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition">
                <CircleDot className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>

            {/* New Channel */}
            {onOpenCreateChannel && (
              <button
                id="fab-action-new-channel"
                onClick={() => {
                  setShowFabMenu(false);
                  onOpenCreateChannel();
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
              >
                <span>New channel</span>
                <div className="w-7 h-7 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Tv className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
              </button>
            )}

            {/* New Community */}
            <button
              id="fab-action-new-community"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateCommunity();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New community</span>
              <div className="w-7 h-7 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
                <Globe className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>

            {/* New Group */}
            <button
              id="fab-action-new-group"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateGroup();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New group</span>
              <div className="w-7 h-7 rounded-xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] flex items-center justify-center group-hover:scale-110 transition">
                <UserPlus className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>

            {/* New Broadcast */}
            {onOpenBroadcast && (
              <button
                id="fab-action-new-broadcast"
                onClick={() => {
                  setShowFabMenu(false);
                  onOpenBroadcast();
                }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
              >
                <span>New broadcast</span>
                <div className="w-7 h-7 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Megaphone className="w-3.5 h-3.5 stroke-[2.2]" />
                </div>
              </button>
            )}

            {/* New Message / Chat */}
            <button
              id="fab-action-new-chat"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewChat();
              }}
              className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-lg border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New message</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
                <MessageCirclePlus className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
            </button>
          </div>
        )}

        {/* The Primary FAB Button */}
        <button
          id="btn-primary-fab"
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-[54px] h-[54px] rounded-[18px] shadow-lg flex items-center justify-center text-white transition-all duration-200 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 shadow-[#00a884]/30 ${
            showFabMenu ? 'rotate-45 bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : ''
          }`}
          title="Create Menu"
          aria-label="Create Menu"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* Modern Android Bottom Navigation Bar */}
      <nav className="w-full h-15 bg-white dark:bg-[#111b21] border-t border-slate-100 dark:border-[#202c33] flex items-center justify-around px-1 z-30 shrink-0 select-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 focus:outline-none transition group relative"
            >
              <div className="relative">
                <div
                  className={`w-14 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-[#00a884]/15 dark:bg-[#00a884]/25 text-[#00a884] dark:text-[#25d366] font-bold'
                      : 'text-slate-500 dark:text-[#8696a0] group-hover:text-slate-800 dark:group-hover:text-[#d1d7db]'
                  }`}
                >
                  {tab.icon}
                </div>

                {/* Badge indicator */}
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#25d366] text-black font-extrabold text-[10px] flex items-center justify-center shadow-md animate-pulse">
                    {tab.badge! > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] transition-colors leading-tight ${
                  isActive
                    ? 'font-bold text-[#111b21] dark:text-[#e9edef]'
                    : 'font-medium text-slate-500 dark:text-[#8696a0]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
