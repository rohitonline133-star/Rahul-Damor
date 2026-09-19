import React, { useState } from 'react';
import { X, Phone, Video, ShieldAlert, UserCheck, Ban, VolumeX, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onOpenReport?: (userId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  onClose,
  onOpenReport,
}) => {
  const { allUsers, token } = useAuth();
  const { initiateCall } = useCall();
  const [isBlocked, setIsBlocked] = useState(false);

  const user = allUsers.find((u) => u.id === userId);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Top Cover / Header */}
        <div className="relative h-28 bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-start justify-end p-3">
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 pt-0 relative -mt-12 flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.displayName}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-slate-900 shadow-xl"
            />
            {user.online && (
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {user.displayName}
              </h3>
              {user.isVerified && <UserCheck className="w-4 h-4 text-cyan-500" />}
            </div>
            <span className="text-xs text-slate-400 font-mono">@{user.username}</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
            {user.bio || 'Hey there! I am using GB Official.'}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 py-2">
            <button
              onClick={() => {
                onClose();
                initiateCall(user.id, 'voice');
              }}
              className="flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:scale-105 transition"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shadow-sm">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold">Audio</span>
            </button>

            <button
              onClick={() => {
                onClose();
                initiateCall(user.id, 'video');
              }}
              className="flex flex-col items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:scale-105 transition"
            >
              <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shadow-sm">
                <Video className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold">Video</span>
            </button>
          </div>

          {/* Details list */}
          <div className="w-full text-left space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            {user.phone && (
              <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono">{user.phone}</span>
              </div>
            )}
            {user.email && (
              <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Email:</span>
                <span>{user.email}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Encryption:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                End-to-end verified
              </span>
            </div>
          </div>

          {/* Moderation actions */}
          <div className="w-full pt-2 space-y-1.5">
            <button
              onClick={() => setIsBlocked(!isBlocked)}
              className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
            >
              <Ban className="w-3.5 h-3.5" /> {isBlocked ? 'Unblock Contact' : 'Block Contact'}
            </button>

            {onOpenReport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReport(user.id);
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Report Contact
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
