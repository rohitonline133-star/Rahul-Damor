import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingBag,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  Sparkles,
  Package,
  Plus,
  Minus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ShopModalProps {
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ onClose }) => {
  const { token, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'cart' | 'orders' | 'subscriptions'>('products');

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart
  const [cart, setCart] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
  const [loadingCart, setLoadingCart] = useState(false);

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  // Checkout states
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'wallet'>('card');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<any | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: currentUser?.displayName || '',
    address: '',
    city: '',
    postalCode: '',
    country: 'India',
  });

  // Load products
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/shop/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load cart
  const loadCart = async () => {
    if (!token) return;
    setLoadingCart(true);
    try {
      const res = await fetch('/api/shop/cart', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          title: item.product?.name || item.product?.title || 'Product',
          price: Number(item.product?.price || 0),
          image: item.product?.image || '',
        })) : [];
        setCart({ items, total: Number(data.subtotal || 0) });
      }
    } catch {
      // ignore
    } finally {
      setLoadingCart(false);
    }
  };

  // Load orders
  const loadOrders = async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/shop/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load subscriptions
  const loadSubscriptions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscription && data.subscription.plan !== 'free' ? [data.subscription] : []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadProducts();
    if (token) {
      loadCart();
      loadOrders();
      loadSubscriptions();
    }
  }, [token]);

  // Add to cart
  const handleAddToCart = async (product: any) => {
    if (!token) return;
    try {
      const res = await fetch('/api/shop/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'add',
          productId: product.id,
          quantity: 1,
        }),
      });
      if (res.ok) {
        await loadCart();
      } else {
        const data = await res.json().catch(() => ({}));
        setCheckoutError(data.error || 'Could not update your cart.');
      }
    } catch {
      // ignore
    }
  };

  // Update item quantity
  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    if (!token) return;
    if (quantity < 1) {
      await handleRemoveFromCart(productId);
      return;
    }
    try {
      const res = await fetch('/api/shop/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update quantity.');
      }
      await loadCart();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Could not update quantity.');
    }
  };

  // Remove from cart
  const handleRemoveFromCart = async (productId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/shop/cart/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not remove item.');
      }
      await loadCart();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Could not remove item.');
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (!token || cart.items.length === 0) return;
    setIsCheckingOut(true);
    setCheckoutError(null);
    setCheckoutSuccess(null);

    try {
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          shippingAddress,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (res.ok && data.order) {
        setCheckoutSuccess(data.order);
        await loadOrders();
        setCheckoutError(data.gatewayNotice || 'Order created. Payment is still pending; no payment has been collected.');
      } else {
        setCheckoutError(data.error || 'Checkout could not be processed');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const cartItemCount = cart.items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  GB Official Store
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official themes, badges, stickers, and digital services
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

        {/* Tab navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800/80 px-4 gap-1 overflow-x-auto no-scrollbar bg-slate-50/30 dark:bg-slate-900/20">
          {[
            { id: 'products', label: 'Catalog', icon: <Package className="w-4 h-4" /> },
            {
              id: 'cart',
              label: `Cart (${cartItemCount})`,
              icon: <ShoppingCart className="w-4 h-4" />,
            },
            { id: 'orders', label: 'My Orders', icon: <Tag className="w-4 h-4" /> },
            { id: 'subscriptions', label: 'VIP Pass', icon: <Sparkles className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#00a884] text-[#00a884] dark:text-[#25d366]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Catalog */}
        {activeTab === 'products' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {['all', 'themes', 'badges', 'stickers', 'storage', 'merch'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-semibold capitalize transition ${
                    selectedCategory === cat
                      ? 'bg-[#00a884] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredProducts.map((p) => {
                const inCart = cart.items.some((it) => it.productId === p.id);
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#111b21] flex flex-col justify-between hover:border-emerald-500/50 transition group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                          {p.category === 'badges' ? '✓' : p.category === 'themes' ? '🎨' : '📦'}
                        </div>
                        <span className="font-mono font-bold text-sm text-[#00a884] dark:text-[#25d366]">
                          ${p.price.toFixed(2)}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                        {p.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {p.category}
                      </span>
                      <button
                        onClick={() => handleAddToCart(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm ${
                          inCart
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'bg-[#00a884] hover:bg-[#008f6f] text-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        {inCart ? 'Add Another' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Cart & Checkout */}
        {activeTab === 'cart' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {checkoutSuccess ? (
              <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
                  Order Created — Payment Pending
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-sm mx-auto">
                  Order ID #{checkoutSuccess.id}. This order is awaiting verified payment. No payment has been collected and paid features have not been unlocked.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                  >
                    View Order Details
                  </button>
                  <button
                    onClick={() => {
                      setCheckoutSuccess(null);
                      setActiveTab('products');
                    }}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold transition"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : cart.items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-10 h-10 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Your cart is empty
                </div>
                <p className="text-xs max-w-xs mx-auto">
                  Browse the catalog for GB Official themes, verification badges, and custom stickers.
                </p>
                <button
                  onClick={() => setActiveTab('products')}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#00a884] text-white text-xs font-bold"
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#111b21] overflow-hidden">
                  {cart.items.map((item) => (
                    <div
                      key={item.productId}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h5>
                        <div className="text-[11px] text-slate-500">
                          ${item.price.toFixed(2)} each
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-1 py-0.5">
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item.productId, (item.quantity || 1) - 1)
                            }
                            className="p-1 hover:text-red-500 text-slate-500"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold font-mono">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item.productId, (item.quantity || 1) + 1)
                            }
                            className="p-1 hover:text-emerald-500 text-slate-500"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="w-16 text-right font-mono font-bold text-xs text-slate-900 dark:text-white">
                          ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                        </span>

                        <button
                          onClick={() => handleRemoveFromCart(item.productId)}
                          className="p-1 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Total */}
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Grand Total
                  </span>
                  <span className="font-mono text-base font-bold text-[#00a884] dark:text-[#25d366]">
                    ${cart.total.toFixed(2)}
                  </span>
                </div>

                {/* Shipping details required by the order API */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111b21] space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Shipping details</h4>
                  {([
                    ['fullName', 'Full name'],
                    ['address', 'Address'],
                    ['city', 'City'],
                    ['postalCode', 'Postal code'],
                    ['country', 'Country'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="block text-[11px] text-slate-500">
                      {label}
                      <input
                        value={shippingAddress[field]}
                        onChange={(event) => setShippingAddress((current) => ({ ...current, [field]: event.target.value }))}
                        maxLength={200}
                        required
                        autoComplete={field === 'fullName' ? 'name' : field === 'address' ? 'street-address' : field === 'city' ? 'address-level2' : field === 'postalCode' ? 'postal-code' : 'country-name'}
                        className="mt-1 w-full rounded-xl px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </label>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                  Live card, UPI and wallet payments are not configured. You can create an order in pending-payment status; this will not charge you or unlock paid services.
                </div>

                {checkoutError && (
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Submit Checkout Button */}
                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut || !shippingAddress.fullName.trim() || !shippingAddress.address.trim() || !shippingAddress.city.trim() || !shippingAddress.postalCode.trim() || !shippingAddress.country.trim()}
                  className="w-full py-3 rounded-2xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {isCheckingOut ? 'Creating Order...' : `Create Pending Order — ${cart.total.toFixed(2)}`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Order History */}
        {activeTab === 'orders' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Tag className="w-9 h-9 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-600" />
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  No orders yet
                </div>
                <p className="text-[11px]">Your completed purchases will appear here.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111b21] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        #{order.id}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()} at{' '}
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold capitalize">
                      {order.status || 'Completed'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {order.items?.map((it: any) => `${it.title} (x${it.quantity})`).join(', ')}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Paid via {order.paymentMethod || 'Card'}</span>
                    <span className="font-mono text-[#00a884] dark:text-[#25d366]">
                      ${(order.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Subscriptions */}
        {activeTab === 'subscriptions' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                  GB Official VIP Club
                </span>
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold">Exclusive Premium Access</h3>
                <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                  Unlimited cloud backups, blue verification badge, 4K media sharing, and custom audio callers.
                </p>
              </div>
              <div className="pt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono">$4.99</span>
                <span className="text-xs text-emerald-200">/ month</span>
              </div>
              <div className="w-full py-2.5 rounded-xl bg-white/15 border border-white/20 text-white/90 text-xs text-center font-semibold">
                Paid plans will become available after a verified payment provider is configured. No free activation or simulated charge is available.
              </div>
            </div>

            {/* Active Subscriptions */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Current Subscriptions
              </h5>
              {subscriptions.length === 0 ? (
                <div className="text-xs text-slate-400 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                  No active recurring subscriptions.
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {sub.plan || 'VIP Membership'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Renews automatically on {new Date(sub.renewsAt || Date.now() + 30 * 86400000).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            GB Official Real Digital Commerce
          </span>
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
