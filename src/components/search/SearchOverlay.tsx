import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, Users, User as UserIcon, Globe, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SearchResults, User, Conversation, Message } from '../../types';

interface SearchOverlayProps {
  onClose: () => void;
  onSelectConversation: (convId: string) => void;
  onSelectUser: (userId: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  onClose,
  onSelectConversation,
  onSelectUser,
}) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, token]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Search className="w-5 h-5 text-emerald-500 ml-2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats, messages, users..."
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Cancel
          </button>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="text-center py-8 text-xs text-slate-400">Searching GB network...</div>
          )}

          {!loading && !results && (
            <div className="text-center py-10 text-xs text-slate-400">
              Type at least 2 letters to search users, conversations, and messages.
            </div>
          )}

          {!loading && results && (
            <>
              {/* Users Results */}
              {results.users.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Users & Contacts ({results.users.length})
                  </span>
                  <div className="space-y-1">
                    {results.users.map((user: User) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          onSelectUser(user.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatar}
                            alt={user.displayName}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {user.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations Results */}
              {results.conversations.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Conversations ({results.conversations.length})
                  </span>
                  <div className="space-y-1">
                    {results.conversations.map((conv: Conversation) => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {conv.name || 'Direct Conversation'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {conv.type} • {conv.members.length} members
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages Results */}
              {results.messages.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Messages ({results.messages.length})
                  </span>
                  <div className="space-y-1.5">
                    {results.messages.map((msg: Message) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          onSelectConversation(msg.conversationId);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition text-xs"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state if nothing matched */}
              {results.users.length === 0 &&
                results.conversations.length === 0 &&
                results.messages.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No results found for "{query}"
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
