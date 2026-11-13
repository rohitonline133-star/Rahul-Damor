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
import { GroupSettingsModal } from '../group/GroupSettingsModal';

interface ChatRoomProps {
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
  onOpenReport?: (message: Message) => void;
}

const isSafeMediaAttachment = (
  attachment: Message['attachment'],
  type: Message['type']
): boolean => {
  if (!attachment || typeof attachment.url !== 'string' ||
      typeof attachment.mimeType !== 'string' ||
      !Number.isSafeInteger(attachment.size) ||
      attachment.size < 1 || attachment.size > 18 * 1024 * 1024) {
    return false;
  }

  const allowedMimes: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm'],
    audio: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
    document: ['application/pdf', 'text/plain'],
  };
  const allowedForType = allowedMimes[type];
  const mimeType = attachment.mimeType.toLowerCase();
  if (!allowedForType || !allowedForType.includes(mimeType)) return false;

  if (attachment.url.startsWith('data:')) {
    const commaIndex = attachment.url.indexOf(',');
    if (commaIndex < 0) return false;
    const metadata = attachment.url.slice(5, commaIndex).split(';');
    const payload = attachment.url.slice(commaIndex + 1);
    return metadata[0]?.toLowerCase() === mimeType &&
      metadata.includes('base64') &&
      /^[A-Za-z0-9+/]+=*$/.test(payload);
  }

  try {
    const mediaUrl = new URL(attachment.url);
    return mediaUrl.protocol === 'https:' &&
      !mediaUrl.username && !mediaUrl.password;
  } catch {
    return false;
  }
};

const ChatRoomLegacy: React.FC<ChatRoomProps> = ({ onBack, onOpenProfile, onOpenReport }) => {
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
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(() => new Set());
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<number | null>(null);

  // Real microphone recording state for voice notes
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);

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

  // Stop microphone tracks if the chat screen is unmounted.
  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
    const replyId = replyingTo?.id;

    const sent = await sendMessage(textToSend, 'text', undefined, replyId);
    if (sent) {
      setInputText('');
      setReplyingTo(null);
    } else {
      // Keep the user's draft and reply context when the server rejects or
      // the network drops the message, so a retry does not lose their text.
      window.alert('Message could not be sent. Your text is still here; check your connection and try again.');
    }
  };

  const handleStartVoiceRecord = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      window.alert('Voice recording is not supported in this browser. Please use a supported browser with microphone access.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const supportedMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (discardRecordingRef.current || chunks.length === 0) {
          discardRecordingRef.current = false;
          return;
        }

        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const supportedAudioTypes = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']);
        const normalizedAudioType = audioBlob.type.split(';')[0].trim().toLowerCase();
        if (!supportedAudioTypes.has(normalizedAudioType)) {
          window.alert('This device created an unsupported voice-note format. Please try recording again with a supported browser.');
          return;
        }
        if (audioBlob.size < 1 || audioBlob.size > 5 * 1024 * 1024 || duration > 300) {
          window.alert('Voice notes must be between 1 byte and 5 MB and no longer than 5 minutes.');
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          window.alert('The voice note could not be prepared. Please try recording again.');
        };
        reader.onloadend = async () => {
          if (reader.error || typeof reader.result !== 'string') {
            window.alert('The voice note could not be converted. Please try recording again.');
            return;
          }
          const sent = await sendMessage(
            '',
            'audio',
            {
              name: `Voice note (${duration}s)`,
              size: audioBlob.size,
              mimeType: normalizedAudioType,
              url: reader.result,
              duration,
            },
            replyingTo?.id
          );
          if (sent) {
            setReplyingTo(null);
          } else {
            window.alert('The voice note could not be sent. Check your connection and try again.');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      window.alert('Microphone permission was not granted. Allow microphone access and try again.');
    }
  };

  const handleCancelVoiceRecord = () => {
    discardRecordingRef.current = true;
    audioChunksRef.current = [];
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleSendVoiceRecord = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }
    setIsRecording(false);
    recorder.stop();
  };



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'text/plain',
    ]);
    const normalizedMimeType = file.type.trim().toLowerCase();
    if (!allowedMimeTypes.has(normalizedMimeType)) {
      window.alert('This file type is not supported. Choose a JPEG, PNG, WebP, GIF, MP4, WebM, PDF, or plain-text file. Use the in-chat recorder to send voice notes.');
      e.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > 18 * 1024 * 1024) {
      window.alert('Attachments must be between 1 byte and 18 MB. Please choose a smaller file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      window.alert('The selected file could not be read. Please choose it again.');
    };
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        window.alert('The selected file could not be prepared. Please try again.');
        return;
      }
      const dataUrl = reader.result;
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const isDocument = file.type === 'application/pdf' || file.type === 'text/plain';
      if (!isImg && !isVid && !isDocument) {
        window.alert('This file cannot be sent as an attachment. Use the in-chat recorder for voice notes.');
        e.target.value = '';
        return;
      }
      const type = isImg ? 'image' : isVid ? 'video' : 'document';

      const sent = await sendMessage(
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
      if (sent) {
        setReplyingTo(null);
      } else {
        window.alert('Attachment could not be sent. Check the file type and your connection, then try again.');
      }
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
    if (!forwardingMsg || !targetConvId) return;
    const token = localStorage.getItem('gb_token');
    if (!token) {
      window.alert('Please sign in again before forwarding a message.');
      return;
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: targetConvId,
          text: forwardingMsg.text
            ? `[Forwarded] ${forwardingMsg.text}`
            : (forwardingMsg.attachment ? '[Forwarded attachment]' : ''),
          type: forwardingMsg.type,
          attachment: forwardingMsg.attachment,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        window.alert(result.error || 'Message could not be forwarded. Check that you are a member of the destination chat.');
        return;
      }

      setForwardingMsg(null);
    } catch {
      window.alert('Message could not be forwarded. Check your connection and try again.');
    }
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
                    {(!isSafeMediaAttachment(msg.attachment, msg.type) || failedMediaIds.has(msg.id)) && (
                      <div
                        role="status"
                        className="rounded-xl p-3 bg-black/5 dark:bg-white/5 text-xs text-slate-500 dark:text-slate-400"
                      >
                        This media could not be loaded. Check your connection and try again later.
                      </div>
                    )}

                    {isSafeMediaAttachment(msg.attachment, msg.type) && !failedMediaIds.has(msg.id) && msg.type === 'image' && (
                      <img
                        src={msg.attachment.url}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                        className="rounded-xl max-h-64 w-full object-cover shadow-sm cursor-pointer hover:opacity-95 transition"
                      />
                    )}

                    {isSafeMediaAttachment(msg.attachment, msg.type) && !failedMediaIds.has(msg.id) && msg.type === 'video' && (
                      <video
                        src={msg.attachment.url}
                        controls
                        preload="metadata"
                        onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                        className="rounded-xl max-h-64 w-full object-cover"
                      />
                    )}

                    {isSafeMediaAttachment(msg.attachment, msg.type) && !failedMediaIds.has(msg.id) && msg.type === 'audio' && (
                      <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 min-w-[220px]">
                        <audio
                          controls
                          preload="metadata"
                          src={msg.attachment.url}
                          onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                          className="w-full max-w-[260px]"
                          aria-label="Voice message playback"
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Voice note ({msg.attachment.duration || 1}s)
                        </span>
                      </div>
                    )}

                    {msg.type === 'document' && (
                      <a
                        href={isSafeMediaAttachment(msg.attachment, msg.type) ? msg.attachment.url : undefined}
                        download={msg.attachment.name.replace(/[\\/\\x00-\\x1f\\x7f]/g, '_').slice(0, 120) || 'attachment'}
                        aria-disabled={!isSafeMediaAttachment(msg.attachment, msg.type)}
                        className="flex items-center gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                        onClick={(event) => {
                          if (!isSafeMediaAttachment(msg.attachment, msg.type)) {
                            event.preventDefault();
                            window.alert('This document is not available or has an unsupported format.');
                          }
                        }}
                      >
                        <FileText className="w-7 h-7 text-[#00a884]" />
                        <div className="truncate flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {msg.attachment.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {(msg.attachment.size / 1024).toFixed(1)} KB · Download
                          </div>
                        </div>
                      </a>
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
                    onClick={() => {
                      if (window.confirm('Delete this message for everyone?')) {
                        void deleteMessage(msg.id).then((deleted) => {
                          if (!deleted) {
                            window.alert('Message could not be deleted. Please check your connection and try again.');
                          }
                        });
                      }
                    }}
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
,'i')
      .test(attachment.url);
  }

  try {
    const mediaUrl = new URL(attachment.url);
    return mediaUrl.protocol === 'https:' &&
      !mediaUrl.username && !mediaUrl.password;
  } catch {
    return false;
  }
};

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
    refreshConversations,
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
  const [failedMediaIds, setFailedMediaIds] = useState<Set<string>>(() => new Set());
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordIntervalRef = useRef<number | null>(null);

  // Real microphone recording state for voice notes
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingStartedAtRef = useRef(0);

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

  // Stop microphone tracks if the chat screen is unmounted.
  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
    const replyId = replyingTo?.id;

    const sent = await sendMessage(textToSend, 'text', undefined, replyId);
    if (sent) {
      setInputText('');
      setReplyingTo(null);
    } else {
      // Keep the user's draft and reply context when the server rejects or
      // the network drops the message, so a retry does not lose their text.
      window.alert('Message could not be sent. Your text is still here; check your connection and try again.');
    }
  };

  const handleStartVoiceRecord = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      window.alert('Voice recording is not supported in this browser. Please use a supported browser with microphone access.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const supportedMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (discardRecordingRef.current || chunks.length === 0) {
          discardRecordingRef.current = false;
          return;
        }

        const audioBlob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        if (audioBlob.size > 5 * 1024 * 1024 || duration > 300) {
          window.alert('Voice notes are limited to 5 MB and 5 minutes. Please record a shorter message.');
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
          window.alert('The voice note could not be prepared. Please try recording again.');
        };
        reader.onloadend = async () => {
          if (typeof reader.result !== 'string') return;
          const sent = await sendMessage(
            '',
            'audio',
            {
              name: `Voice note (${duration}s)`,
              size: audioBlob.size,
              mimeType: audioBlob.type || 'audio/webm',
              url: reader.result,
              duration,
            },
            replyingTo?.id
          );
          if (sent) {
            setReplyingTo(null);
          } else {
            window.alert('The voice note could not be sent. Check your connection and try again.');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
    } catch {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      window.alert('Microphone permission was not granted. Allow microphone access and try again.');
    }
  };

  const handleCancelVoiceRecord = () => {
    discardRecordingRef.current = true;
    audioChunksRef.current = [];
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleSendVoiceRecord = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }
    setIsRecording(false);
    recorder.stop();
  };



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachMenu(false);
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'audio/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'text/plain',
    ]);
    const normalizedMimeType = file.type.trim().toLowerCase();
    if (!allowedMimeTypes.has(normalizedMimeType)) {
      window.alert('This file type is not supported. Choose a JPEG, PNG, WebP, GIF, MP4, WebM, audio, PDF, or plain-text file.');
      e.target.value = '';
      return;
    }
    if (file.size < 1 || file.size > 18 * 1024 * 1024) {
      window.alert('Attachments must be between 1 byte and 18 MB. Please choose a smaller file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      window.alert('The selected file could not be read. Please choose it again.');
    };
    reader.onload = async () => {
      if (typeof reader.result !== 'string') {
        window.alert('The selected file could not be prepared. Please try again.');
        return;
      }
      const dataUrl = reader.result;
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const type = isImg ? 'image' : isVid ? 'video' : 'document';

      const sent = await sendMessage(
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
      if (sent) {
        setReplyingTo(null);
      } else {
        window.alert('Attachment could not be sent. Check the file type and your connection, then try again.');
      }
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
    if (!forwardingMsg || !targetConvId) return;
    const token = localStorage.getItem('gb_token');
    if (!token) {
      window.alert('Please sign in again before forwarding a message.');
      return;
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: targetConvId,
          text: forwardingMsg.text
            ? `[Forwarded] ${forwardingMsg.text}`
            : (forwardingMsg.attachment ? '[Forwarded attachment]' : ''),
          type: forwardingMsg.type,
          attachment: forwardingMsg.attachment,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        window.alert(result.error || 'Message could not be forwarded. Check that you are a member of the destination chat.');
        return;
      }

      setForwardingMsg(null);
    } catch {
      window.alert('Message could not be forwarded. Check your connection and try again.');
    }
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
              {isGroup && (
                <button
                  onClick={() => { setShowOptionsDropdown(false); setShowGroupSettings(true); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Group info & settings
                </button>
              )}
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
                    {failedMediaIds.has(msg.id) && (
                      <div
                        role="status"
                        className="rounded-xl p-3 bg-black/5 dark:bg-white/5 text-xs text-slate-500 dark:text-slate-400"
                      >
                        This media could not be loaded. Check your connection and try again later.
                      </div>
                    )}

                    {!failedMediaIds.has(msg.id) && msg.type === 'image' && (
                      <img
                        src={msg.attachment.url}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                        className="rounded-xl max-h-64 w-full object-cover shadow-sm cursor-pointer hover:opacity-95 transition"
                      />
                    )}

                    {!failedMediaIds.has(msg.id) && msg.type === 'video' && (
                      <video
                        src={msg.attachment.url}
                        controls
                        preload="metadata"
                        onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                        className="rounded-xl max-h-64 w-full object-cover"
                      />
                    )}

                    {!failedMediaIds.has(msg.id) && msg.type === 'audio' && (
                      <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 min-w-[220px]">
                        <audio
                          controls
                          preload="metadata"
                          src={msg.attachment.url}
                          onError={() => setFailedMediaIds((previous) => new Set(previous).add(msg.id))}
                          className="w-full max-w-[260px]"
                          aria-label="Voice message playback"
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Voice note ({msg.attachment.duration || 1}s)
                        </span>
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
                    onClick={() => {
                      if (window.confirm('Delete this message for everyone?')) {
                        void deleteMessage(msg.id).then((deleted) => {
                          if (!deleted) {
                            window.alert('Message could not be deleted. Please check your connection and try again.');
                          }
                        });
                      }
                    }}
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
      {showGroupSettings && isGroup && activeConversation && currentUser && (
        <GroupSettingsModal
          conversation={activeConversation}
          currentUserId={currentUser.id}
          token={token || ''}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={async () => { await refreshConversations(); }}
        />
      )}
      {showLocationModal && activeConversation && (
        <LocationShareModal
          conversationId={activeConversation.id}
          onClose={() => setShowLocationModal(false)}
        />
      )}
    </div>
  );
};
