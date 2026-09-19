import React from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { UserStatus } from '../../types';

interface StatusStoriesRowProps {
  onOpenCreateStatus: () => void;
  onSelectStatus: (status: UserStatus) => void;
}

export const StatusStoriesRow: React.FC<StatusStoriesRowProps> = ({
  onOpenCreateStatus,
  onSelectStatus,
}) => {
  const { currentUser } = useAuth();
  const { statuses } = useChat();

  const myStatus = statuses.find((s) => s.userId === currentUser?.id);
  const rawContactStatuses = statuses.filter((s) => s.userId !== currentUser?.id);

  // Guarantee 'Alex' and 'Sarah' are always present
  const alexStatus: UserStatus = rawContactStatuses.find(
    (s) => s.userName.toLowerCase().includes('alex') || s.userId === 'user_alex'
  ) || {
    id: 'status_alex_1',
    userId: 'user_alex',
    userName: 'Alex Rivera',
    userAvatar:
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: 'Sub-millisecond real-time sync with SSE & offline resilience. Super fast! ⚡️',
    backgroundColor: '#075e54',
    createdAt: Date.now() - 3600000,
    expiresAt: Date.now() + 82800000,
    privacy: 'everyone',
    viewers: [],
  };

  const sarahStatus: UserStatus = rawContactStatuses.find(
    (s) => s.userName.toLowerCase().includes('sarah') || s.userId === 'user_sarah'
  ) || {
    id: 'status_sarah_1',
    userId: 'user_sarah',
    userName: 'Sarah Chen',
    userAvatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    type: 'image',
    content:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
    caption: 'GB Official v1.0 UI Design Tokens finalized! 🎨',
    createdAt: Date.now() - 7200000,
    expiresAt: Date.now() + 79200000,
    privacy: 'everyone',
    viewers: [],
  };

  const otherStatuses = rawContactStatuses.filter(
    (s) =>
      !s.userName.toLowerCase().includes('alex') &&
      s.userId !== 'user_alex' &&
      !s.userName.toLowerCase().includes('sarah') &&
      s.userId !== 'user_sarah'
  );

  const contactStatuses: UserStatus[] = [alexStatus, sarahStatus, ...otherStatuses];

  return (
    <div className="w-full px-3.5 pt-2.5 pb-2 border-b border-slate-100 dark:border-[#202c33] bg-white dark:bg-[#111b21] shrink-0">
      <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-0.5">
        {/* Add / View My status */}
        <button
          id="story-circle-my-status"
          onClick={() => {
            if (myStatus) {
              onSelectStatus(myStatus);
            } else {
              onOpenCreateStatus();
            }
          }}
          className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none select-none"
        >
          <div className="relative">
            <div
              className={`w-[54px] h-[54px] rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                myStatus
                  ? 'bg-gradient-to-tr from-[#00a884] via-[#25d366] to-[#00d084] shadow-sm'
                  : 'p-[2px] border-2 border-dashed border-[#00a884]'
              }`}
            >
              <div className="w-full h-full rounded-full p-0.5 bg-white dark:bg-[#111b21] overflow-hidden">
                <img
                  src={
                    currentUser?.avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                  }
                  alt="My status"
                  referrerPolicy="no-referrer"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>

            {/* Circular Add (+) Badge */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateStatus();
              }}
              className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#111b21] group-hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Add status update"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>

          <span className="text-[11.5px] font-semibold text-[#111b21] dark:text-[#e9edef] truncate max-w-[62px]">
            My status
          </span>
        </button>

        {/* Contact Statuses: 'Alex', 'Sarah', and others */}
        {contactStatuses.map((status) => {
          const isViewed = status.viewers?.some((v) => v.userId === currentUser?.id);
          const firstName = status.userName.split(' ')[0];

          return (
            <button
              key={status.id}
              id={`story-circle-${firstName.toLowerCase()}`}
              onClick={() => onSelectStatus(status)}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none select-none"
            >
              <div
                className={`w-[54px] h-[54px] rounded-full p-[2.5px] transition-all group-hover:scale-105 ${
                  isViewed
                    ? 'border-2 border-slate-300 dark:border-slate-700'
                    : 'bg-gradient-to-tr from-[#00a884] via-[#25d366] to-[#00d084] shadow-sm'
                }`}
              >
                <div className="w-full h-full rounded-full p-0.5 bg-white dark:bg-[#111b21] overflow-hidden">
                  <img
                    src={status.userAvatar}
                    alt={status.userName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              <span className="text-[11.5px] font-semibold text-[#111b21] dark:text-[#e9edef] truncate max-w-[62px]">
                {firstName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
