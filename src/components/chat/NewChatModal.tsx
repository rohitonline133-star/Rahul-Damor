import React, { useState } from 'react';
import { X, Search, UserCheck, MessageCirclePlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewChatModalProps {
  onClose: () => void;
  onSelectConversation: (convId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  onClose,
  onSelectConversation,
}) => {
  const { allUsers, currentUser } = useAuth();
  const { createDirectChat } = useChat();
  const [search, setSearch] = useState('');

  const contacts = allUsers.filter((u) => u.id !== currentUser?.id);
  const filteredContacts = contacts.filter((u) =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartChat = async (userId: string) => {
    const convId = await createDirectChat(userId);
    if (convId) {
      onSelectConversation(convId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <MessageCirclePlus className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Select Contact
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or username..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => handleStartChat(contact.id)}
              className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition select-none group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <img
                    src={contact.avatar}
                    alt={contact.displayName}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  {contact.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {contact.displayName}
                    </span>
                    {contact.isVerified && (
                      <UserCheck className="w-3 h-3 text-cyan-500 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono truncate">
                    @{contact.username} • {contact.bio || 'Available'}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              No matching contacts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
