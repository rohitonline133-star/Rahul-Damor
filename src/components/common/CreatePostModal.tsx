import React, { useState } from 'react';
import { X, Send, Image as ImageIcon, Tag, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreatePostModalProps {
  onClose: () => void;
  onPostCreated?: (post: any) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  onClose,
  onPostCreated,
}) => {
  const { token, currentUser } = useAuth();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [tags, setTags] = useState('GBOfficial, Updates');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl.trim()) {
      setError('Post text or an image URL is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType: mediaUrl.trim() ? 'image' : undefined,
          tags: parsedTags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to publish post');
        setLoading(false);
        return;
      }

      if (onPostCreated) onPostCreated(data.post);
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
            <Send className="w-5 h-5" />
            <h2 className="text-sm font-extrabold tracking-wide">New Post</h2>
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

          <div className="flex items-center gap-2.5">
            <img
              src={currentUser?.avatar}
              alt="Avatar"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                {currentUser?.displayName}
              </span>
              <span className="text-[10px] text-slate-400">Public GB Official Feed</span>
            </div>
          </div>

          <div>
            <textarea
              rows={4}
              required={!mediaUrl}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening in your network today? #updates"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Image / Media URL (Optional)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">
                <ImageIcon className="w-4 h-4" />
              </span>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full pl-10 pr-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Hashtags (comma separated)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">
                <Tag className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="news, android, tech"
                className="w-full pl-10 pr-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                'Publishing...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Publish Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
