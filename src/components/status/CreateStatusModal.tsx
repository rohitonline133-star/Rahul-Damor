import React, { useState } from 'react';
import { X, Image as ImageIcon, Type, Sparkles, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

interface CreateStatusModalProps {
  onClose: () => void;
}

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({ onClose }) => {
  const { createStatus } = useChat();
  const [tab, setTab] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaDataUrl, setMediaDataUrl] = useState<string | null>(null);
  const [bgGradient, setBgGradient] = useState(
    'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
  );
  const [privacy, setPrivacy] = useState<'everyone' | 'contacts'>('everyone');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gradients = [
    'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
    'linear-gradient(135deg, #0891b2 0%, #0284c7 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
    'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMediaDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    if (tab === 'text' && !textContent.trim()) return;
    if (tab === 'media' && !mediaDataUrl) return;

    setIsSubmitting(true);
    await createStatus({
      type: tab === 'text' ? 'text' : 'image',
      content: tab === 'text' ? textContent.trim() : mediaDataUrl!,
      caption: tab === 'media' ? caption.trim() : undefined,
      backgroundColor: tab === 'text' ? bgGradient : undefined,
      privacy,
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Create GB Status
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="px-5 pt-3 flex gap-2">
          <button
            onClick={() => setTab('text')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              tab === 'text'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Type className="w-4 h-4" /> Text Status
          </button>
          <button
            onClick={() => setTab('media')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              tab === 'media'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <ImageIcon className="w-4 h-4" /> Photo Status
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 flex flex-col">
          {tab === 'text' ? (
            <div className="flex flex-col gap-3 flex-1">
              <div
                className="w-full h-48 rounded-2xl p-4 flex items-center justify-center text-center text-white text-lg font-bold shadow-inner relative"
                style={{ background: bgGradient }}
              >
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type a status update..."
                  className="w-full h-full bg-transparent text-white placeholder-white/70 text-center font-bold text-lg resize-none focus:outline-none flex items-center justify-center"
                  maxLength={250}
                />
              </div>

              {/* Gradient selector */}
              <div className="flex items-center gap-2 py-1">
                <span className="text-xs text-slate-500 font-medium">Color:</span>
                {gradients.map((grad, i) => (
                  <button
                    key={i}
                    onClick={() => setBgGradient(grad)}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      bgGradient === grad ? 'scale-110 ring-2 ring-emerald-500 ring-offset-2' : ''
                    }`}
                    style={{ background: grad }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 flex-1">
              {mediaDataUrl ? (
                <div className="relative rounded-2xl overflow-hidden max-h-52 bg-slate-900 flex items-center justify-center">
                  <img src={mediaDataUrl} alt="Preview" className="max-h-52 object-contain" />
                  <button
                    onClick={() => setMediaDataUrl(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="w-full h-44 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer transition p-4">
                  <ImageIcon className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to select photo or video
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP up to 25MB</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}

              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Privacy settings */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Status Privacy:</span>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value as any)}
              className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
            >
              <option value="everyone">My Contacts & Everyone</option>
              <option value="contacts">My Contacts Only</option>
            </select>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isSubmitting || (tab === 'text' && !textContent.trim()) || (tab === 'media' && !mediaDataUrl)}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition"
            >
              <Send className="w-3.5 h-3.5" /> Share to Status (24h)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
