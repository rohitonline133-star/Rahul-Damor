import React, { useState } from 'react';
import { X, Tv, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreateChannelModalProps {
  onClose: () => void;
  onChannelCreated?: (channel: any) => void;
}

const CATEGORIES = [
  'General',
  'Technology',
  'News & Updates',
  'Entertainment',
  'Gaming',
  'Education',
  'Business',
];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  onClose,
  onChannelCreated,
}) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [icon, setIcon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError('Please provide both channel name and handle.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().replace(/^@/, ''),
          description: description.trim(),
          category,
          icon: icon.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create channel');
        setLoading(false);
        return;
      }

      if (onChannelCreated) {
        onChannelCreated(data.channel);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5" />
            <h2 className="text-sm font-extrabold tracking-wide">Create GB Official Channel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-black/20 hover:bg-black/30 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Channel Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GB Official News & Releases"
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Unique Handle / Username *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs text-slate-400 font-mono">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="gbofficial_updates"
                className="w-full pl-7 pr-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Subscribers can discover and join via this handle.
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share what updates your subscribers will receive..."
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Icon Image URL
              </label>
              <input
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
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
                'Creating...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Create Channel
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
