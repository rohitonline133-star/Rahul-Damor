import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Send,
  Users,
  Check,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface BroadcastModalProps {
  onClose: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ onClose }) => {
  const { token, currentUser } = useAuth();
  const { conversations, refreshConversations } = useChat();

  const [broadcastLists, setBroadcastLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Available contacts derived from conversations
  const availableContacts = React.useMemo(() => {
    const list: { id: string; name: string; avatar?: string }[] = [];
    conversations.forEach((c) => {
      if (c.type === 'direct' && c.memberDetails) {
        c.memberDetails.forEach((m) => {
          if (m.id !== currentUser?.id && !list.some((it) => it.id === m.id)) {
            list.push({ id: m.id, name: m.displayName || m.phone || 'User', avatar: m.avatar });
          }
        });
      }
    });
    return list;
  }, [conversations, currentUser]);

  const loadBroadcastLists = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/broadcasts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastLists(data.broadcasts || []);
        if (data.broadcasts && data.broadcasts.length > 0 && !selectedListId) {
          setSelectedListId(data.broadcasts[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadBroadcastLists();
  }, [token]);

  const handleCreateList = async () => {
    if (!token || !newListTitle.trim() || selectedContactIds.length === 0) return;
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newListTitle.trim(),
          recipientIds: selectedContactIds,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastLists((prev) => [...prev, data.broadcast]);
        setSelectedListId(data.broadcast.id);
        setIsCreatingNew(false);
        setNewListTitle('');
        setSelectedContactIds([]);
      }
    } catch {
      // ignore
    }
  };

  const handleSendBroadcast = async () => {
    if (!token || !selectedListId || !messageText.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/broadcasts/${selectedListId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: messageText.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSendSuccess(`Broadcast dispatched to ${data.sentCount || 'all'} recipients.`);
        setMessageText('');
        refreshConversations();
        setTimeout(() => setSendSuccess(null), 3000);
      }
    } catch {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  const selectedList = broadcastLists.find((b) => b.id === selectedListId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                New Broadcast
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Send announcements to multiple contacts individually
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* List selection & New List button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Broadcast Lists
            </span>
            <button
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="text-xs font-bold text-[#00a884] dark:text-[#25d366] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {isCreatingNew ? 'Cancel New' : 'Create List'}
            </button>
          </div>

          {isCreatingNew ? (
            /* Create new broadcast list form */
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111b21] space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  List Title
                </label>
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="e.g. VIP Clients, Family Members, Staff"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Select Recipients ({selectedContactIds.length} chosen)
                </label>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850">
                  {availableContacts.map((contact) => {
                    const isSelected = selectedContactIds.includes(contact.id);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => {
                          setSelectedContactIds((prev) =>
                            isSelected ? prev.filter((id) => id !== contact.id) : [...prev, contact.id]
                          );
                        }}
                        className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-[10px]">
                            {contact.name[0]}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {contact.name}
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleCreateList}
                disabled={!newListTitle.trim() || selectedContactIds.length === 0}
                className="w-full py-2 rounded-xl bg-[#00a884] text-white text-xs font-bold transition disabled:opacity-50"
              >
                Save Broadcast List
              </button>
            </div>
          ) : (
            /* Broadcast list selector chips */
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {broadcastLists.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedListId(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedListId === b.id
                      ? 'bg-[#00a884] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {b.title} ({b.recipientIds?.length || 0})
                </button>
              ))}
            </div>
          )}

          {/* Message Dispatch Area */}
          {selectedList && !isCreatingNew && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 text-xs text-cyan-900 dark:text-cyan-200">
                <span className="font-bold">Dispatch target:</span> {selectedList.title} with{' '}
                {selectedList.recipientIds?.length || 0} recipients. Each contact receives this message in their private chat.
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Announcement Message
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type announcement or update to broadcast..."
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {sendSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{sendSuccess}</span>
                </div>
              )}

              <button
                onClick={handleSendBroadcast}
                disabled={isSending || !messageText.trim()}
                className="w-full py-3 rounded-2xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Transmitting Broadcast...' : 'Transmit Broadcast'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
