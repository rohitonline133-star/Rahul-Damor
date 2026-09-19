import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Users2,
  CircleDot,
  PhoneCall,
  Plus,
  MessageCirclePlus,
  UserPlus,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useChat, MainTab } from '../../context/ChatContext';

interface BottomNavProps {
  onOpenNewChat: () => void;
  onOpenCreateGroup: () => void;
  onOpenCreateCommunity: () => void;
  onOpenCreateStatus: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  onOpenNewChat,
  onOpenCreateGroup,
  onOpenCreateCommunity,
  onOpenCreateStatus,
}) => {
  const { activeTab, setActiveTab, conversations } = useChat();
  const [showFabMenu, setShowFabMenu] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

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
  ];

  return (
    <>
      {/* Floating Action Button & Menu */}
      <div className="absolute bottom-[72px] right-4 z-40" ref={fabRef}>
        {showFabMenu && (
          <div className="flex flex-col gap-2 items-end mb-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* New Status */}
            <button
              id="fab-action-new-status"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateStatus();
              }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-xl border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New Status</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition">
                <CircleDot className="w-4 h-4 stroke-[2.2]" />
              </div>
            </button>

            {/* New Community */}
            <button
              id="fab-action-new-community"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateCommunity();
              }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-xl border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New Community</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
                <Globe className="w-4 h-4 stroke-[2.2]" />
              </div>
            </button>

            {/* New Group */}
            <button
              id="fab-action-new-group"
              onClick={() => {
                setShowFabMenu(false);
                onOpenCreateGroup();
              }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-xl border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New Group</span>
              <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] flex items-center justify-center group-hover:scale-110 transition">
                <UserPlus className="w-4 h-4 stroke-[2.2]" />
              </div>
            </button>

            {/* New Chat */}
            <button
              id="fab-action-new-chat"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewChat();
              }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-xl border border-slate-200/80 dark:border-transparent text-xs font-bold hover:scale-105 active:scale-95 transition group"
            >
              <span>New Chat</span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition">
                <MessageCirclePlus className="w-4 h-4 stroke-[2.2]" />
              </div>
            </button>
          </div>
        )}

        {/* The Primary FAB Button: Circular/soft rounded, green/cyan accents */}
        <button
          id="btn-primary-fab"
          onClick={() => setShowFabMenu(!showFabMenu)}
          className={`w-[54px] h-[54px] rounded-[18px] shadow-lg flex items-center justify-center text-white transition-all duration-200 bg-[#00a884] hover:bg-[#008f6f] active:scale-95 shadow-[#00a884]/30 ${
            showFabMenu ? 'rotate-45 bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : ''
          }`}
          title="New action"
          aria-label="New action"
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
                  className={`p-1.5 rounded-full transition-colors ${
                    isActive
                      ? 'text-[#00a884] dark:text-[#25d366]'
                      : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}
                >
                  {tab.icon}
                </div>

                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -top-0.5 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#25d366] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[11px] font-medium leading-none transition-colors ${
                  isActive
                    ? 'text-[#00a884] dark:text-[#25d366] font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </span>

              {/* Active indicator bar / pill */}
              {isActive && (
                <span className="w-5 h-0.5 rounded-full bg-[#00a884] dark:bg-[#25d366] absolute bottom-1" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
