import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Mic,
  Send,
  Check,
  CheckCheck,
  Clock,
  Reply,
  Edit2,
  Trash2,
  Copy,
  Forward,
  X,
  FileText,
  Image as ImageIcon,
  Play,
  Pause,
  UserCheck,
  AlertCircle,
  Square,
  MapPin,
  Radio,
  Navigation,
  ExternalLink,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useCall } from '../../context/CallContext';
import { Message } from '../../types';
import { LocationShareModal } from '../location/LocationShareModal';

interface ChatRoomProps {
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  onOpenReport?: (message: Message) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ onBack, onOpenProfile, onOpenReport }) => {
  const {
    activeConversation,
    conversations,
    messages,
    loadingMessages,
    sendMessage,
    reactToMessage,
    editMessage,
    deleteMessage,
  } = useChat();
  const { currentUser, token } = useAuth();
  const { initiateCall } = useCall();

  const [inputText, setInputText] = useState('');
  const [showGbKeyboard, setShowGbKeyboard] = useState(true);
  const [keyboardShift, setKeyboardShift] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<number | null>(null);

  // Audio playback state (voice notes)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [activeConversation?.id]);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [isRecording]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400">
        Select a conversation
      </div>
    );
  }

  const isGroup = activeConversation.type === 'group';
  const otherMember = activeConversation.memberDetails?.find((m) => m.id !== currentUser?.id);
  const title = isGroup ? activeConversation.name || 'Group Chat' : otherMember?.displayName || 'Chat';
  const avatar = isGroup
    ? activeConversation.icon || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150'
    : otherMember?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
  const isOnline = !isGroup && Boolean(otherMember?.online);
  const isVerified = !isGroup && Boolean(otherMember?.isVerified);

  const handleSend = async () => {
    if (editingMsg) {
      if (inputText.trim()) {
        await editMessage(editingMsg.id, inputText.trim());
      }
      setEditingMsg(null);
      setInputText('');
      return;
    }

    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    await sendMessage(textToSend, 'text', undefined, replyId);
  };

  const handleStartVoiceRecord = () => {
    setIsRecording(true);
  };

  const handleCancelVoiceRecord = () => {
    setIsRecording(false);
  };

  const handleSendVoiceRecord = async () => {
    setIsRecording(false);
    const duration = recordingSeconds || 3;
    await sendMessage(
      '',
      'audio',
      {
        name: `Voice note (${duration}s)`,
        size: 1024 * 32 * duration,
        mimeType: 'audio/webm',
        url: 'data:audio/webm;base64,mock',
        duration,
      },
      replyingTo?.id
    );
    setReplyingTo(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const type = isImg ? 'image' : isVid ? 'video' : 'document';

      await sendMessage(
        '',
        type,
        {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          url: dataUrl,
        },
        replyingTo?.id
      );
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopyMessage = (msg: Message) => {
    navigator.clipboard.writeText(msg.text || msg.attachment?.name || '');
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleForwardMessage = async (targetConvId: string) => {
    if (!forwardingMsg) return;
    const textToForward = forwardingMsg.text;
    const attachment = forwardingMsg.attachment;
    const type = forwardingMsg.type;

    // Send using standard API
    await fetch(`/api/conversations/${targetConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('gb_token')}`,
      },
      body: JSON.stringify({
        text: textToForward ? `[Forwarded] ${textToForward}` : '[Forwarded attachment]',
        type,
        attachment,
      }),
    });

    setForwardingMsg(null);
  };

  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'];
  const gbKeyboardRows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const insertKeyboardKey = (key: string) => setInputText((value) => value + (keyboardShift ? key.toUpperCase() : key));

  return (
    <div className="gb-custom-chat-theme flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden relative">
      {/* Top Chat Bar */}
      <header className="gb-chat-header px-3 py-2.5 flex items-center justify-between bg-[#005c4b] dark:bg-[#1f2c34] text-white shadow-md z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-1 -ml-1 rounded-full hover:bg-white/10 text-white transition"
            title="Back to chats"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            onClick={() => otherMember && onOpenProfile?.(otherMember.id)}
            className="flex items-center gap-2.5 cursor-pointer min-w-0"
          >
            <div className="relative shrink-0">
              <img
                src={avatar}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover ring-1 ring-white/20"
              />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] ring-2 ring-[#005c4b] dark:ring-[#1f2c34]" />
              )}
            </div>

            <div className="truncate">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-white truncate leading-tight">
                  {title}
                </span>
                {isVerified && <UserCheck className="w-3.5 h-3.5 text-cyan-300 shrink-0" />}
              </div>
              <span className="text-[11px] text-emerald-100/80 block truncate">
                {isGroup
                  ? `${activeConversation.members.length} members`
                  : isOnline
                  ? 'online'
                  : 'last seen recently'}
              </span>
            </div>
          </div>
        </div>

        {/* Audio / Video Calls & More Options */}
        <div className="flex items-center gap-0.5 shrink-0 relative">
          {!isGroup && otherMember && (
            <>
              <button
                onClick={() => initiateCall(otherMember.id, 'video', activeConversation.id)}
                className="p-2 rounded-full hover:bg-white/10 text-emerald-100 hover:text-white transition"
                title="Start Video Call"
                aria-label="Start Video Call"
              >
                <Video className="w-5 h-5" />
              </button>
              <button
                onClick={() => initiateCall(otherMember.id, 'voice', activeConversation.id)}
                className="p-2 rounded-full hover:bg-white/10 text-emerald-100 hover:text-white transition"
                title="Start Voice Call"
                aria-label="Start Voice Call"
              >
                <Phone className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className="p-2 rounded-full hover:bg-white/10 text-emerald-100 hover:text-white transition"
            title="More options"
            aria-label="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOptionsDropdown && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-850 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setShowOptionsDropdown(false);
                  if (otherMember) onOpenProfile?.(otherMember.id);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                View Contact Info
              </button>
              <button
                onClick={() => {
                  setShowOptionsDropdown(false);
                  scrollToBottom('smooth');
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Scroll to Latest
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {loadingMessages && (
          <div className="text-center py-6 text-xs text-slate-500">Loading messages...</div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser?.id;
          const isRead = msg.status === 'read';
          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              {/* Message Bubble */}
              <div
                className={`gb-message-bubble ${isMe ? "gb-message-out" : "gb-message-in"} max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm relative transition ${
                  isMe
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
                    : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none border border-black/5 dark:border-white/5'
                }`}
              >
                {/* Group Sender Name */}
                {isGroup && !isMe && (
                  <div className="text-xs font-bold text-[#00a884] dark:text-emerald-400 mb-1">
                    {msg.senderName}
                  </div>
                )}

                {/* Quoted Reply if any */}
                {msg.replyToMessage && (
                  <div
                    className={`mb-2 p-2 rounded-xl text-xs border-l-4 ${
                      isMe
                        ? 'bg-black/5 dark:bg-black/20 border-[#00a884] text-slate-700 dark:text-slate-200'
                        : 'bg-slate-100 dark:bg-slate-800/80 border-[#00a884] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-[11px] mb-0.5 text-[#00a884] dark:text-emerald-400">
                      {msg.replyToMessage.senderName}
                    </div>
                    <div className="truncate text-[11px]">{msg.replyToMessage.text}</div>
                  </div>
                )}

                {/* Attachment Renderer */}
                {msg.attachment && (
                  <div className="mb-2">
                    {msg.type === 'image' && (
                      <img
                        src={msg.attachment.url}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        className="rounded-xl max-h-64 w-full object-cover shadow-sm cursor-pointer hover:opacity-95 transition"
                      />
                    )}

                    {msg.type === 'video' && (
                      <video
                        src={msg.attachment.url}
                        controls
                        className="rounded-xl max-h-64 w-full object-cover"
                      />
                    )}

                    {msg.type === 'audio' && (
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5">
                        <button
                          onClick={() =>
                            setPlayingAudioId(playingAudioId === msg.id ? null : msg.id)
                          }
                          className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow"
                        >
                          {playingAudioId === msg.id ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-[#00a884] ${
                                playingAudioId === msg.id ? 'w-3/4 animate-pulse' : 'w-1/3'
                              }`}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                            Voice note ({msg.attachment.duration || 4}s)
                          </span>
                        </div>
                      </div>
                    )}

                    {msg.type === 'document' && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5">
                        <FileText className="w-7 h-7 text-[#00a884]" />
                        <div className="truncate flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {msg.attachment.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {(msg.attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Location Message Renderer */}
                {(msg.type === 'location' || (msg as any).location) && (
                  <div className="mb-2 w-64 max-w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/60 bg-white/90 dark:bg-[#1f2c34] shadow-sm text-slate-800 dark:text-slate-100">
                    <div className="relative h-24 bg-emerald-950/20 dark:bg-emerald-950/40 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1.5px,transparent_1.5px)] [background-size:12px_12px] opacity-30" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-800">
                          <MapPin className="w-4 h-4 fill-current" />
                        </div>
                        {(msg as any).location?.isLive && !(msg as any).location?.isStopped && (
                          <span className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            LIVE
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5">
                      <div className="font-bold text-xs truncate">
                        {(msg as any).location?.address || 'Pinned Location'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {((msg as any).location?.latitude || 37.7749).toFixed(4)},{' '}
                        {((msg as any).location?.longitude || -122.4194).toFixed(4)}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <a
                          href={`https://www.google.com/maps?q=${(msg as any).location?.latitude || 37.7749},${(msg as any).location?.longitude || -122.4194}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-1 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 transition"
                        >
                          <ExternalLink className="w-3 h-3" /> Maps
                        </a>

                        {isMe && (msg as any).location?.isLive && !(msg as any).location?.isStopped && (
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/location/stop', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ messageId: msg.id }),
                                });
                              } catch {}
                            }}
                            className="py-1 px-2 rounded-xl bg-red-100 dark:bg-red-950/50 hover:bg-red-200 text-red-600 dark:text-red-400 text-[11px] font-semibold transition"
                          >
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Text Content */}
                {msg.text && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed text-[13.5px]">
                    {msg.text}
                  </p>
                )}

                {/* Timestamp & Status ticks */}
                <div
                  className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
                    isMe
                      ? 'text-slate-500 dark:text-emerald-200/70'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {msg.isEdited && <span className="italic">(edited)</span>}
                  <span>{time}</span>

                  {isMe && (
                    <span>
                      {isRead ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] stroke-[2.5]" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-slate-500 dark:text-emerald-200/70" />
                      ) : msg.status === 'sending' ? (
                        <Clock className="w-3 h-3 text-slate-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-500 dark:text-emerald-200/70" />
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions Floating Badge */}
                {Boolean(msg.reactions && msg.reactions.length > 0) && (
                  <div
                    className={`absolute -bottom-2.5 ${
                      isMe ? 'right-2' : 'left-2'
                    } flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-md border border-slate-200 dark:border-slate-700 text-xs`}
                  >
                    {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((em) => (
                      <span key={em}>{em}</span>
                    ))}
                    {msg.reactions.length > 1 && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-0.5">
                        {msg.reactions.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Toolbar on Hover */}
              <div
                className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 ${
                  isMe ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Emoji Reactions Bar */}
                <div className="flex items-center gap-0.5 bg-white dark:bg-slate-850 px-1.5 py-0.5 rounded-full shadow border border-slate-200 dark:border-slate-800 text-xs">
                  {quickEmojis.slice(0, 4).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => reactToMessage(msg.id, emoji)}
                      className="hover:scale-125 transition p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Reply Button */}
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                {/* Forward Button */}
                <button
                  onClick={() => setForwardingMsg(msg)}
                  className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition"
                  title="Forward message"
                >
                  <Forward className="w-3.5 h-3.5" />
                </button>

                {/* Copy Button */}
                <button
                  onClick={() => handleCopyMessage(msg)}
                  className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {/* Edit Button (author only) */}
                {isMe && (
                  <button
                    onClick={() => {
                      setEditingMsg(msg);
                      setInputText(msg.text);
                    }}
                    className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 transition"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete Button (author or admin) */}
                {(isMe || currentUser?.role === 'admin') && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 transition"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Report Button (if received) */}
                {!isMe && onOpenReport && (
                  <button
                    onClick={() => onOpenReport(msg)}
                    className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 hover:text-amber-500 transition"
                    title="Report message"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Forward Modal Picker */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-850 rounded-2xl shadow-2xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Forward message to:
              </h3>
              <button
                onClick={() => setForwardingMsg(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {conversations.map((c) => {
                const isCurrent = c.id === activeConversation.id;
                const other = c.memberDetails?.find((m) => m.id !== currentUser?.id);
                const name = c.type === 'group' ? c.name : other?.displayName;
                return (
                  <button
                    key={c.id}
                    disabled={isCurrent}
                    onClick={() => handleForwardMessage(c.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition ${
                      isCurrent
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{name}</span>
                    <Forward className="w-3.5 h-3.5 text-[#00a884]" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
          <div className="border-l-4 border-[#00a884] pl-2 min-w-0">
            <span className="font-bold text-[#00a884] dark:text-emerald-400">
              Replying to {replyingTo.senderName}
            </span>
            <p className="text-slate-500 dark:text-slate-400 truncate text-[11px]">
              {replyingTo.text || 'Attachment'}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMsg && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
          <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Edit2 className="w-3.5 h-3.5" /> Editing Message
          </span>
          <button
            onClick={() => {
              setEditingMsg(null);
              setInputText('');
            }}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-20 left-4 bg-white dark:bg-slate-850 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-40 flex gap-2 animate-in fade-in zoom-in-95 duration-150">
          <label className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Photo/Video
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <label className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition">
            <div className="w-10 h-10 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Document
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              setShowLocationModal(true);
            }}
            className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Location
            </span>
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      {/* Bottom Message Composer Bar */}
      <footer className="gb-chat-composer p-2.5 bg-transparent shrink-0">
        {isRecording ? (
          /* Voice Recording Mode */
          <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 shadow">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>Recording voice note...</span>
              <span className="font-mono text-sm ml-2">
                00:{recordingSeconds.toString().padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelVoiceRecord}
                className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSendVoiceRecord}
                className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal Composer Input */
          <div className="flex items-center gap-2">
            {/* Input Pill Container */}
            <div className="gb-composer-pill flex-1 flex items-center bg-white dark:bg-[#2a3942] rounded-3xl px-3 py-1.5 shadow-md border border-slate-200/50 dark:border-none">
              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 text-slate-400 hover:text-[#00a884] dark:hover:text-emerald-400 transition"
                title="Insert emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                readOnly
                onFocus={() => setShowGbKeyboard(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message"
                className="flex-1 bg-transparent border-none outline-none px-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />

              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-1.5 text-slate-400 hover:text-[#00a884] dark:hover:text-emerald-400 transition"
                title="Attach file or media"
              >
                <Paperclip className="w-5 h-5 rotate-45" />
              </button>
            </div>

            {/* Send OR Voice Record Button */}
            {inputText.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                className="w-11 h-11 rounded-full bg-[#00a884] dark:bg-[#00a884] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition shrink-0"
                title="Send Message"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartVoiceRecord}
                className="w-11 h-11 rounded-full bg-[#00a884] dark:bg-[#00a884] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition shrink-0"
                title="Hold or tap to record voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* GB Official custom on-screen keyboard */}
        {showGbKeyboard && !isRecording && (
          <div className="gb-virtual-keyboard mt-2 p-2 rounded-xl border border-[#651126] shadow-2xl" aria-label="GB Official keyboard">
            <div className="flex items-center justify-between px-1 pb-2 text-[#f8dce4] text-[10px] font-bold tracking-wider">
              <span>GB OFFICIAL KEYBOARD</span>
              <button type="button" onClick={() => setShowGbKeyboard(false)} className="px-2 py-1 rounded-lg bg-[#8d1531] text-white">Hide</button>
            </div>
            <div className="flex justify-around gap-1 pb-2">
              {['▦', '☻', 'GIF', '▤', '⚙', '•••', '🎙'].map((key, i) => (
                <button key={i} type="button" onClick={() => key === '☻' ? setShowEmojiPicker(true) : undefined} className="gb-key gb-key-tool">{key}</button>
              ))}
            </div>
            {gbKeyboardRows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-1 mb-1.5">
                {row.split('').map((key) => (
                  <button key={key} type="button" onClick={() => insertKeyboardKey(key)} className="gb-key flex-1">{keyboardShift ? key.toUpperCase() : key}</button>
                ))}
              </div>
            ))}
            <div className="flex gap-1 mb-1.5">
              <button type="button" onClick={() => setKeyboardShift((v) => !v)} className="gb-key gb-key-special w-12">⇧</button>
              <button type="button" onClick={() => setInputText((v) => v.slice(0, -1))} className="gb-key gb-key-special flex-1">⌫</button>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setInputText((v) => v + ' ')} className="gb-key gb-key-special w-12">🌐</button>
              <button type="button" onClick={() => setInputText((v) => v + ' ')} className="gb-key flex-1">English (US)</button>
              <button type="button" onClick={() => setInputText((v) => v + '.') } className="gb-key w-10">.</button>
              <button type="button" onClick={handleSend} className="gb-key gb-key-special w-12">↵</button>
            </div>
          </div>
        )}

        {/* Emoji Quick Row */}
        {showEmojiPicker && (
          <div className="mt-2 p-2 bg-white dark:bg-slate-850 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 flex items-center justify-around text-lg">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="hover:scale-130 transition p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </footer>

      {/* Location Share Dialog */}
      {showLocationModal && activeConversation && (
        <LocationShareModal
          conversationId={activeConversation.id}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </div>
  );
};
