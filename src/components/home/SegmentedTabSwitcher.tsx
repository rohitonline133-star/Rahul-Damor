import React from 'react';
import { MessageSquare, Users2 } from 'lucide-react';

interface SegmentedTabSwitcherProps {
  activeSegment: 'chats' | 'communities';
  onSelectSegment: (segment: 'chats' | 'communities') => void;
  unreadChatsCount?: number;
}

export const SegmentedTabSwitcher: React.FC<SegmentedTabSwitcherProps> = ({
  activeSegment,
  onSelectSegment,
  unreadChatsCount = 0,
}) => {
  return (
    <div className="w-full px-3.5 pt-2 pb-1.5 bg-white dark:bg-[#111b21] shrink-0">
      <div className="w-full bg-[#f0f2f5] dark:bg-[#202c33] p-1 rounded-2xl flex items-center border border-slate-200/60 dark:border-transparent">
        {/* Chats Tab */}
        <button
          id="segmented-tab-chats"
          onClick={() => onSelectSegment('chats')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all duration-150 select-none ${
            activeSegment === 'chats'
              ? 'bg-[#00a884] text-white shadow-sm'
              : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
          }`}
        >
          <MessageSquare className="w-4 h-4 stroke-[2.2]" />
          <span>Chats</span>
          {unreadChatsCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                activeSegment === 'chats'
                  ? 'bg-white text-[#00a884]'
                  : 'bg-[#00a884] text-white'
              }`}
            >
              {unreadChatsCount}
            </span>
          )}
        </button>

        {/* Communities Tab */}
        <button
          id="segmented-tab-communities"
          onClick={() => onSelectSegment('communities')}
          className={`flex-1 py-1.5 px-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all duration-150 select-none ${
            activeSegment === 'communities'
              ? 'bg-[#00a884] text-white shadow-sm'
              : 'text-[#54656f] dark:text-[#8696a0] hover:text-[#111b21] dark:hover:text-[#e9edef]'
          }`}
        >
          <Users2 className="w-4 h-4 stroke-[2.2]" />
          <span>Communities</span>
        </button>
      </div>
    </div>
  );
};
