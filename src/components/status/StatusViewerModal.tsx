import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, Send, Trash2, Heart } from 'lucide-react';
import { UserStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface StatusViewerModalProps {
  status: UserStatus;
  onClose: () => void;
}

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({ status, onClose }) => {
  const { currentUser } = useAuth();
  const { viewStatus, deleteStatus, createDirectChat, sendMessage } = useChat();
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState('');

  const isMyStatus = status.userId === currentUser?.id;

  useEffect(() => {
    viewStatus(status.id);
  }, [status.id]);

  useEffect(() => {
    const duration = 6000; // 6 seconds per story
    const step = 50;
    const increment = (step / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          onClose();
          return 100;
        }
        return prev + increment;
      });
    }, step);

    return () => clearInterval(timer);
  }, [status.id, onClose]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    const convId = await createDirectChat(status.userId);
    if (convId) {
      await sendMessage(`Replied to status: "${replyText.trim()}"`);
      setReplyText('');
      onClose();
    }
  };

  const handleDelete = async () => {
    await deleteStatus(status.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-200">
      <div className="relative w-full h-full max-w-[440px] flex flex-col justify-between overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-2 left-3 right-3 z-30 flex items-center gap-1">
          <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Top Header */}
        <div className="relative z-30 pt-6 px-4 pb-2 flex items-center justify-between text-white bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2.5">
            <img
              src={status.userAvatar}
              alt={status.userName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white/60"
            />
            <div>
              <div className="font-bold text-sm leading-tight">{status.userName}</div>
              <div className="text-[11px] text-white/70">
                {new Date(status.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMyStatus && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-full bg-black/40 hover:bg-red-500/80 transition"
                title="Delete status"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 hover:bg-white/20 transition"
              title="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex items-center justify-center p-6 select-none relative">
          {status.type === 'text' ? (
            <div
              className="w-full h-full rounded-3xl p-8 flex items-center justify-center text-center text-white text-2xl font-bold shadow-2xl"
              style={{
                background: status.backgroundColor || 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              }}
            >
              <p className="max-w-xs leading-snug break-words">{status.content}</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <img
                src={status.content}
                alt="Story"
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
              />
              {status.caption && (
                <div className="mt-4 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md text-white text-sm max-w-xs text-center font-medium">
                  {status.caption}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer: Reply or Viewers Sheet */}
        <div className="relative z-30 pb-6 px-4 pt-2 bg-gradient-to-t from-black/80 to-transparent">
          {isMyStatus ? (
            /* Viewers Bar for creator */
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowViewers(!showViewers)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-semibold transition"
              >
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>{status.viewers?.length || 0} Viewers</span>
              </button>

              {showViewers && (
                <div className="w-full mt-3 p-3 rounded-2xl bg-slate-900/95 border border-white/10 text-white max-h-40 overflow-y-auto space-y-2">
                  <div className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-1">
                    Viewed By
                  </div>
                  {status.viewers?.map((viewer) => (
                    <div key={viewer.userId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={viewer.userAvatar}
                          alt={viewer.userName}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="font-medium">{viewer.userName}</span>
                      </div>
                      <span className="text-[10px] text-white/50">
                        {new Date(viewer.viewedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                  {(!status.viewers || status.viewers.length === 0) && (
                    <div className="text-xs text-white/50 py-2 text-center">No views yet</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Reply Bar for other users */
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                placeholder={`Reply to ${status.userName.split(' ')[0]}...`}
                className="flex-1 bg-white/20 border border-white/20 rounded-full px-4 py-2.5 text-white placeholder-white/60 text-sm focus:outline-none focus:bg-white/30 transition backdrop-blur-md"
              />
              <button
                onClick={handleReply}
                className="p-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
