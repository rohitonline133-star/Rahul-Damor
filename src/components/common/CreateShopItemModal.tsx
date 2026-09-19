import React, { useState } from 'react';
import { X, ShoppingBag, DollarSign, Image as ImageIcon, Tag, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface CreateShopItemModalProps {
  onClose: () => void;
  onItemCreated?: (item: any) => void;
}

const CATEGORIES = ['Themes', 'Badges', 'Subscriptions', 'Chat Bubbles', 'Accessories'];

export const CreateShopItemModal: React.FC<CreateShopItemModalProps> = ({
  onClose,
  onItemCreated,
}) => {
  const { token, currentUser } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('4.99');
  const [category, setCategory] = useState('Themes');
  const [image, setImage] = useState('');
  const [stockCount, setStockCount] = useState('25');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      setError('Item title and price are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/shop/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price) || 0.99,
          category,
          image:
            image.trim() ||
            'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=80',
          stockCount: parseInt(stockCount, 10) || 10,
          tags: ['Official', category],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to list product in store');
        setLoading(false);
        return;
      }

      if (onItemCreated) onItemCreated(data.product);
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
            <ShoppingBag className="w-5 h-5" />
            <h2 className="text-sm font-extrabold tracking-wide">List New Shop Item</h2>
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
              Item Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Neon Emerald AMOLED Theme"
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Price (USD) *
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.49"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="4.99"
                  className="w-full pl-7 pr-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about features, compatibility, and visual styling..."
              className="w-full px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Preview Image URL
              </label>
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Stock Units
              </label>
              <input
                type="number"
                min="1"
                value={stockCount}
                onChange={(e) => setStockCount(e.target.value)}
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
                'Listing...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> List Item in Store
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
