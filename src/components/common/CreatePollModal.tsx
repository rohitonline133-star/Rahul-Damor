import React, { useState } from 'react';
import { X, BarChart2, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface CreatePollModalProps {
  onClose: () => void;
  conversationId?: string | null;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  onClose,
  conversationId,
}) => {
  const { token, currentUser } = useAuth();
  const { sendMessage, conversations, activeConversationId } = useChat();

  const targetConvId = conversationId || activeConversationId || conversations[0]?.id;

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError('Please provide a poll question.');
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      setError('At least 2 non-empty options are required.');
      return;
    }

    setLoading(true);
    setError('');

    const pollPayload = {
      question: question.trim(),
      options: validOptions.map((text, idx) => ({
        id: 'opt_' + idx + '_' + Date.now(),
        text,
        votes: [],
      })),
      allowMultiple,
      totalVotes: 0,
      createdAt: Date.now(),
    };

    try {
      if (targetConvId) {
        // Send as a chat message with attachment
        await sendMessage(`📊 Poll: ${question.trim()}`, 'poll', {
          type: 'poll',
          url: '',
          name: question.trim(),
          poll: pollPayload,
        } as any);
      } else {
        // Post globally
        await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            content: `📊 Poll: ${question.trim()}`,
            poll: {
              question: question.trim(),
              options: validOptions,
            },
          }),
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch poll');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            <h2 className="text-sm font-extrabold tracking-wide">Create Poll</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-black/20 hover:bg-black/30 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Question *
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Options (Min 2, Max 6)
            </label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-4 text-center">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  required
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center gap-1.5 text-xs font-bold text-[#00a884] dark:text-[#25d366] hover:underline pt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add option
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Allow multiple answers
              </span>
              <span className="text-[10px] text-slate-400">
                Voters can select more than one choice
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-2xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                'Posting...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Send Poll
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
