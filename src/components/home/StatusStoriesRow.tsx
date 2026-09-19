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
  const contactStatuses = statuses.filter((s) => s.userId !== currentUser?.id);

  return (
    <div className="w-full px-3.5 pt-2.5 pb-2 border-b border-slate-100 dark:border-[#202c33] bg-white dark:bg-[#111b21] shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
        {/* Add / View My Status */}
        <button
          onClick={() => {
            if (myStatus) {
              onSelectStatus(myStatus);
            } else {
              onOpenCreateStatus();
            }
          }}
          className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none select-none"
        >
          <div className="relative">
            <div
              className={`w-[52px] h-[52px] rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                myStatus
                  ? 'bg-gradient-to-tr from-[#00a884] via-[#25d366] to-[#00d084] p-[2px] shadow-sm'
                  : 'p-[1.5px] border-2 border-dashed border-[#00a884]/60 dark:border-[#00a884]/70'
              }`}
            >
              <div className="w-full h-full rounded-full p-0.5 bg-white dark:bg-[#111b21] overflow-hidden">
                <img
                  src={
                    currentUser?.avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                  }
                  alt="My Status"
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
              className="absolute -bottom-0.5 -right-0.5 w-[19px] h-[19px] rounded-full bg-[#00a884] dark:bg-[#00a884] text-white flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#111b21] group-hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Add status update"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>

          <span className="text-[11px] font-semibold text-[#111b21] dark:text-[#e9edef] truncate max-w-[58px]">
            My Status
          </span>
        </button>

        {/* Contact Statuses */}
        {contactStatuses.map((status) => {
          const isViewed = status.viewers?.some((v) => v.userId === currentUser?.id);

          return (
            <button
              key={status.id}
              onClick={() => onSelectStatus(status)}
              className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none select-none"
            >
              <div
                className={`w-[52px] h-[52px] rounded-full p-[2px] transition-all group-hover:scale-105 ${
                  isViewed
                    ? 'border-2 border-slate-300 dark:border-slate-700'
                    : 'bg-gradient-to-tr from-[#00a884] via-[#25d366] to-teal-400 shadow-sm'
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

              <span className="text-[11px] font-medium text-[#3b4a54] dark:text-[#8696a0] truncate max-w-[58px]">
                {status.userName.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
