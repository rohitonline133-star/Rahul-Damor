import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Lock,
  Bell,
  MessageSquare,
  Phone,
  Palette,
  HardDrive,
  Laptop,
  Megaphone,
  Users2,
  Tv,
  ListFilter,
  CreditCard,
  Sparkles,
  ShoppingBag,
  MapPin,
  CloudUpload,
  Download,
  HelpCircle,
  Info,
  LogOut,
  Check,
  CheckCheck,
  Moon,
  Sun,
  AlertCircle,
  KeyRound,
  Trash2,
  Radio,
  FileText,
  RefreshCw,
  Eye,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export type SettingSection =
  | 'root'
  | 'account'
  | 'privacy'
  | 'security'
  | 'profile'
  | 'notifications'
  | 'chats'
  | 'calls'
  | 'appearance'
  | 'storage'
  | 'devices'
  | 'broadcasts'
  | 'communities'
  | 'channels'
  | 'lists'
  | 'payments'
  | 'subscriptions'
  | 'shop'
  | 'location'
  | 'backup'
  | 'data_export'
  | 'help'
  | 'about';

interface SettingsModalProps {
  onClose: () => void;
  onLogout: () => void;
  onOpenLinkedDevices?: () => void;
  onOpenShop?: () => void;
  onOpenBroadcasts?: () => void;
  onOpenCommunities?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  onLogout,
  onOpenLinkedDevices,
  onOpenShop,
  onOpenBroadcasts,
  onOpenCommunities,
}) => {
  const { currentUser, updateProfile, token, toggleTwoFactor } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [currentSection, setCurrentSection] = useState<SettingSection>('root');

  // Profile Edit State
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+1 (555) 019-2834');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Account / 2FA State
  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch('/api/auth/two-factor', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not load security settings')))
      .then((data) => { if (!cancelled) setTwoFactor(Boolean(data.enabled)); })
      .catch(() => { if (!cancelled) setTwoFactor(false); });
    return () => { cancelled = true; };
  }, [token]);
  const [appLock, setAppLock] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Privacy State
  const [lastSeen, setLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [profilePhoto, setProfilePhoto] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState<'everyone' | 'same_as_last_seen'>('everyone');
  const [disappearingTimer, setDisappearingTimer] = useState<'off' | '24h' | '7d' | '90d'>('off');

  // Notifications State
  const [messageSound, setMessageSound] = useState(true);
  const [groupSound, setGroupSound] = useState(true);
  const [callRingtone, setCallRingtone] = useState('GB Classic');
  const [vibrate, setVibrate] = useState(true);
  const [previewNotification, setPreviewNotification] = useState(true);

  // Chats & Appearance
  const [enterIsSend, setEnterIsSend] = useState(true);
  const [mediaVisibility, setMediaVisibility] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [chatWallpaper, setChatWallpaper] = useState('doodle');

  // Calls
  const [lowDataCalls, setLowDataCalls] = useState(false);
  const [silenceUnknown, setSilenceUnknown] = useState(false);

  // Storage & Cache
  const [cacheSize, setCacheSize] = useState('24.8 MB');
  const [cacheCleared, setCacheCleared] = useState(false);
  const [autoDownloadWifi, setAutoDownloadWifi] = useState(true);
  const [autoDownloadMobile, setAutoDownloadMobile] = useState(false);

  // Backup State
  const [backupFreq, setBackupFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [lastBackupTime, setLastBackupTime] = useState('Today at 02:00 AM');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName,
        username,
        bio,
        phone,
        avatar,
        privacySettings: {
          lastSeen,
          profilePhoto,
          readReceipts,
        },
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle2FA = async (enabled: boolean) => {
    const pin = enabled ? window.prompt('Choose a new 6-digit verification PIN:') : undefined;
    if (enabled && (!pin || !/^\d{6}$/.test(pin))) return;
    const currentPassword = twoFactor ? window.prompt('Enter your current password to change two-step verification:') : undefined;
    if (twoFactor && !currentPassword) return;
    const result = await toggleTwoFactor(enabled, pin || undefined, currentPassword || undefined);
    if (result.success) setTwoFactor(enabled);
    else window.alert(result.error || 'Could not update two-step verification.');
  };

  const handleRequestPhoneChange = async () => {
    if (!token || !newPhone.trim()) return;
    setPhoneError(null);
    try {
      const res = await fetch('/api/account/change-phone-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPhone: newPhone.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhoneStep(2);
        setPhoneMsg(`Verification code dispatched. (Test code: ${data.testVerificationCode || '123456'})`);
      } else {
        setPhoneError(data.error || 'Failed to request phone change');
      }
    } catch (e: any) {
      setPhoneError(e.message);
    }
  };

  const handleVerifyPhoneChange = async () => {
    if (!token || !verificationCode.trim()) return;
    setPhoneError(null);
    try {
      const res = await fetch('/api/account/change-phone-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPhone: newPhone.trim(),
          verificationCode: verificationCode.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPhone(newPhone);
        setPhoneStep(1);
        setNewPhone('');
        setVerificationCode('');
        setPhoneMsg('Phone number updated successfully!');
        setTimeout(() => setPhoneMsg(null), 3000);
      } else {
        setPhoneError(data.error || 'Invalid verification code');
      }
    } catch (e: any) {
      setPhoneError(e.message);
    }
  };

  const handleExportData = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const res = await fetch('/api/account/export-data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GB_Official_Export_${currentUser?.username || 'user'}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {}
    setIsExporting(false);
  };

  const handleRunBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      setBackupSuccess(true);
      setLastBackupTime('Just now');
      setTimeout(() => setBackupSuccess(false), 3000);
    }, 1200);
  };

  const handleClearCache = () => {
    setCacheSize('0.0 KB');
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  // Main menu items list
  const menuItems = [
    { id: 'account', label: 'Account', desc: 'Security notifications, change number, delete', icon: <KeyRound className="w-5 h-5 text-emerald-500" /> },
    { id: 'privacy', label: 'Privacy', desc: 'Block contacts, disappearing messages, last seen', icon: <Lock className="w-5 h-5 text-teal-500" /> },
    { id: 'security', label: 'Security', desc: 'Two-step verification, device login alerts', icon: <Shield className="w-5 h-5 text-cyan-500" /> },
    { id: 'profile', label: 'Profile', desc: 'Name, username, bio, photo, contact info', icon: <User className="w-5 h-5 text-blue-500" /> },
    { id: 'notifications', label: 'Notifications', desc: 'Message, group & call tones, previews', icon: <Bell className="w-5 h-5 text-amber-500" /> },
    { id: 'chats', label: 'Chats', desc: 'Theme, wallpapers, chat history, font size', icon: <MessageSquare className="w-5 h-5 text-emerald-600" /> },
    { id: 'calls', label: 'Calls', desc: 'Silence unknown callers, low data mode', icon: <Phone className="w-5 h-5 text-green-500" /> },
    { id: 'appearance', label: 'Appearance', desc: 'Light, dark, accent palettes', icon: <Palette className="w-5 h-5 text-purple-500" /> },
    { id: 'storage', label: 'Storage and Data', desc: 'Network usage, auto-download, clear cache', icon: <HardDrive className="w-5 h-5 text-rose-500" /> },
    { id: 'devices', label: 'Linked Devices', desc: 'Manage active sessions & QR connection', icon: <Laptop className="w-5 h-5 text-indigo-500" /> },
    { id: 'broadcasts', label: 'Broadcasts', desc: 'Recipient lists and broadcast management', icon: <Megaphone className="w-5 h-5 text-orange-500" /> },
    { id: 'communities', label: 'Communities', desc: 'Admin controls, announcements & groups', icon: <Users2 className="w-5 h-5 text-cyan-600" /> },
    { id: 'channels', label: 'Channels', desc: 'Updates, subscribed channels & discovery', icon: <Tv className="w-5 h-5 text-teal-600" /> },
    { id: 'lists', label: 'Lists', desc: 'Custom contact categories (Family, Work, VIP)', icon: <ListFilter className="w-5 h-5 text-sky-500" /> },
    { id: 'payments', label: 'Payments', desc: 'GB Pay, sandbox payment gateway info', icon: <CreditCard className="w-5 h-5 text-emerald-500" /> },
    { id: 'subscriptions', label: 'Subscriptions', desc: 'GB Pro VIP tier and active perks', icon: <Sparkles className="w-5 h-5 text-amber-500" /> },
    { id: 'shop', label: 'Shop', desc: 'Themes, chat badges, custom bubble styles', icon: <ShoppingBag className="w-5 h-5 text-pink-500" /> },
    { id: 'location', label: 'Location & Privacy', desc: 'Live location sessions & GPS permissions', icon: <MapPin className="w-5 h-5 text-red-500" /> },
    { id: 'backup', label: 'Backup', desc: 'Back up chats to secure local storage', icon: <CloudUpload className="w-5 h-5 text-blue-600" /> },
    { id: 'data_export', label: 'Data Export', desc: 'Download personal archive in JSON format', icon: <Download className="w-5 h-5 text-violet-500" /> },
    { id: 'help', label: 'Help & Support', desc: 'Help center, contact us, terms of service', icon: <HelpCircle className="w-5 h-5 text-slate-500" /> },
    { id: 'about', label: 'About GB Official', desc: 'Version 26.4.1, security certifications', icon: <Info className="w-5 h-5 text-slate-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#00a884] text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            {currentSection !== 'root' ? (
              <button
                onClick={() => setCurrentSection('root')}
                className="p-1.5 rounded-full hover:bg-black/15 transition -ml-1"
              >
                <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
            ) : null}
            <h2 className="text-base font-extrabold tracking-wide">
              {currentSection === 'root'
                ? 'Settings'
                : menuItems.find((m) => m.id === currentSection)?.label || 'Settings'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/15 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ROOT SETTINGS MENU */}
          {currentSection === 'root' && (
            <div className="space-y-4">
              {/* Profile Card Header */}
              <div
                onClick={() => setCurrentSection('profile')}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={currentUser?.avatar}
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500/40"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {currentUser?.displayName}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono truncate">@{currentUser?.username}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {currentUser?.bio || 'Hey there! I am using GB Official.'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition shrink-0" />
              </div>

              {/* Settings Items List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'devices' && onOpenLinkedDevices) {
                        onClose();
                        onOpenLinkedDevices();
                      } else if (item.id === 'shop' && onOpenShop) {
                        onClose();
                        onOpenShop();
                      } else if (item.id === 'broadcasts' && onOpenBroadcasts) {
                        onClose();
                        onOpenBroadcasts();
                      } else if (item.id === 'communities' && onOpenCommunities) {
                        onClose();
                        onOpenCommunities();
                      } else {
                        setCurrentSection(item.id as SettingSection);
                      }
                    }}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="shrink-0">{item.icon}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition shrink-0" />
                  </div>
                ))}
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-3 rounded-2xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Log Out of GB Official
              </button>
            </div>
          )}

          {/* 1. ACCOUNT */}
          {currentSection === 'account' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Phone Number
                </h4>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Registered:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{phone}</span>
                </div>
                <button
                  onClick={() => setPhoneStep(1)}
                  className="w-full py-2 rounded-xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] text-xs font-bold transition"
                >
                  Change Phone Number
                </button>

                {/* Change Phone Dialog */}
                {phoneStep === 1 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-[11px] font-semibold text-slate-500">New Phone Number:</label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      onClick={handleRequestPhoneChange}
                      className="w-full py-2 rounded-xl bg-[#00a884] text-white text-xs font-bold"
                    >
                      Send Verification Code
                    </button>
                  </div>
                )}

                {phoneStep === 2 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{phoneMsg}</p>
                    <input
                      type="text"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="6-digit PIN"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono text-center tracking-widest text-base"
                    />
                    <button
                      onClick={handleVerifyPhoneChange}
                      className="w-full py-2 rounded-xl bg-[#00a884] text-white text-xs font-bold"
                    >
                      Verify & Change Phone
                    </button>
                  </div>
                )}
                {phoneError && <p className="text-xs text-red-500 font-semibold">{phoneError}</p>}
              </div>

              {/* Data Export Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Request Account Info
                </h4>
                <p className="text-xs text-slate-500">
                  Download a report of your GB Official account information and settings.
                </p>
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExporting ? 'Exporting...' : 'Request Report (JSON)'}
                </button>
              </div>

              {/* Delete Account */}
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-2">
                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Delete My Account
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deleting your account will delete your message history, delete you from all GB groups, and erase device backups.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      onLogout();
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {/* 2. PRIVACY */}
          {currentSection === 'privacy' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Last Seen & Online</div>
                  <div className="text-[11px] text-slate-400">Control who can see your activity</div>
                </div>
                <select
                  value={lastSeen}
                  onChange={(e: any) => setLastSeen(e.target.value)}
                  className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Profile Photo</div>
                  <div className="text-[11px] text-slate-400">Who can see your profile photo</div>
                </div>
                <select
                  value={profilePhoto}
                  onChange={(e: any) => setProfilePhoto(e.target.value)}
                  className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Read Receipts</div>
                  <div className="text-[11px] text-slate-400">If turned off, you won't see blue checks from others</div>
                </div>
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Default Disappearing Timer</div>
                  <div className="text-[11px] text-slate-400">Start new chats with messages that disappear</div>
                </div>
                <select
                  value={disappearingTimer}
                  onChange={(e: any) => setDisappearingTimer(e.target.value)}
                  className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="off">Off</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="90d">90 Days</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. SECURITY */}
          {currentSection === 'security' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Two-Step Verification</div>
                  <div className="text-[11px] text-slate-400">Require PIN when signing in</div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => handleToggle2FA(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">App Lock (Biometrics/PIN)</div>
                  <div className="text-[11px] text-slate-400">Unlock with fingerprint or passcode</div>
                </div>
                <input
                  type="checkbox"
                  checked={appLock}
                  onChange={(e) => setAppLock(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold block mb-1">Encryption status</span>
                End-to-end encryption is not yet available. Messages and media may be processed by the GB Official server, so do not treat this chat as a private encrypted channel yet.
              </div>
            </div>
          )}

          {/* 4. PROFILE */}
          {currentSection === 'profile' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Username (@handle)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Bio / About
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-2xl bg-[#00a884] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {savedSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}

          {/* 5. NOTIFICATIONS */}
          {currentSection === 'notifications' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Conversation Tones</div>
                  <div className="text-[11px] text-slate-400">Play sounds for incoming and outgoing messages</div>
                </div>
                <input
                  type="checkbox"
                  checked={messageSound}
                  onChange={(e) => setMessageSound(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Vibrate on Alerts</div>
                  <div className="text-[11px] text-slate-400">Haptic feedback on alerts and calls</div>
                </div>
                <input
                  type="checkbox"
                  checked={vibrate}
                  onChange={(e) => setVibrate(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">High Priority Notifications</div>
                  <div className="text-[11px] text-slate-400">Show previews at top of screen</div>
                </div>
                <input
                  type="checkbox"
                  checked={previewNotification}
                  onChange={(e) => setPreviewNotification(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 6. CHATS */}
          {currentSection === 'chats' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Enter is Send</div>
                  <div className="text-[11px] text-slate-400">Enter key will send your message</div>
                </div>
                <input
                  type="checkbox"
                  checked={enterIsSend}
                  onChange={(e) => setEnterIsSend(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Media Visibility</div>
                  <div className="text-[11px] text-slate-400">Show newly downloaded media in device gallery</div>
                </div>
                <input
                  type="checkbox"
                  checked={mediaVisibility}
                  onChange={(e) => setMediaVisibility(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Font Size</div>
                  <div className="text-[11px] text-slate-400">Scale message text readability</div>
                </div>
                <select
                  value={fontSize}
                  onChange={(e: any) => setFontSize(e.target.value)}
                  className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>
          )}

          {/* 7. CALLS */}
          {currentSection === 'calls' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Use Less Data for Calls</div>
                  <div className="text-[11px] text-slate-400">Reduce cellular data consumption during calls</div>
                </div>
                <input
                  type="checkbox"
                  checked={lowDataCalls}
                  onChange={(e) => setLowDataCalls(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Silence Unknown Callers</div>
                  <div className="text-[11px] text-slate-400">Calls from unknown numbers will be silenced</div>
                </div>
                <input
                  type="checkbox"
                  checked={silenceUnknown}
                  onChange={(e) => setSilenceUnknown(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 8. APPEARANCE */}
          {currentSection === 'appearance' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-cyan-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Application Theme</div>
                    <div className="text-[11px] text-slate-400">Current mode: {theme}</div>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:scale-105 transition"
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-2">
                  GB Official Primary Brand Accent
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-[#00a884] bg-emerald-50 dark:bg-emerald-950/30 text-xs font-bold text-[#00a884] dark:text-[#25d366]">
                  <span className="w-4 h-4 rounded-full bg-[#00a884]" />
                  GB Emerald / Teal (Official Active Palette)
                </div>
              </div>
            </div>
          )}

          {/* 9. STORAGE & DATA */}
          {currentSection === 'storage' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Local Cache Usage</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{cacheSize}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cached stickers, temporary previews, and media thumbnails.
                </p>
                <button
                  onClick={handleClearCache}
                  className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {cacheCleared ? 'Cache Cleared!' : 'Clear Cache Safely'}
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Auto-download on Wi-Fi</div>
                  <div className="text-[11px] text-slate-400">Photos, audio, and documents</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoDownloadWifi}
                  onChange={(e) => setAutoDownloadWifi(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111b21] flex items-center justify-between border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Auto-download on Mobile Data</div>
                  <div className="text-[11px] text-slate-400">Disabled by default to save cellular data</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoDownloadMobile}
                  onChange={(e) => setAutoDownloadMobile(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884] rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 10. PAYMENTS */}
          {currentSection === 'payments' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">GB Official Pay</span>
                <div className="text-2xl font-extrabold">$145.50 USD</div>
                <p className="text-[11px] text-emerald-100">Verified Sandbox Wallet Balance</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold block mb-1">Payment Provider Notice:</span>
                Production Stripe/Razorpay credentials are currently managed via the project environment. All shop purchases run in secure developer Sandbox mode.
              </div>
            </div>
          )}

          {/* 11. SUBSCRIPTIONS */}
          {currentSection === 'subscriptions' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-white space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    VIP Plan
                  </span>
                  <Sparkles className="w-5 h-5 text-amber-100" />
                </div>
                <h3 className="text-base font-extrabold">GB Official Pro Membership</h3>
                <p className="text-xs text-amber-100">
                  Includes animated stickers, 4GB document sharing, exclusive AMOLED theme pack, and custom verified badges.
                </p>
                <div className="text-xs font-bold pt-1">Renews: October 19, 2026 • $4.99/month</div>
              </div>
            </div>
          )}

          {/* 12. BACKUP */}
          {currentSection === 'backup' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Last Backup</span>
                  <span className="text-xs text-slate-400 font-semibold">{lastBackupTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Backup Frequency</span>
                  <select
                    value={backupFreq}
                    onChange={(e: any) => setBackupFreq(e.target.value)}
                    className="px-2 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <button
                  onClick={handleRunBackup}
                  disabled={isBackingUp}
                  className="w-full py-2.5 rounded-xl bg-[#00a884] text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <CloudUpload className="w-4 h-4" />
                  {isBackingUp ? 'Backing up chats...' : backupSuccess ? 'Backup Completed!' : 'Back Up Now'}
                </button>
              </div>
            </div>
          )}

          {/* 13. ABOUT */}
          {currentSection === 'about' && (
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#00a884] text-white font-extrabold text-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                GB
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">GB Official</h3>
                <p className="text-xs text-slate-400 font-mono">Version 26.4.1 (Build 2026.09)</p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                GB Official is an original, secure, next-generation communication and social network with encrypted messaging, real-time calling, community channels, and store features.
              </p>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                © 2026 GB Official Systems. All rights reserved.
              </div>
            </div>
          )}

          {/* 14. HELP & SUPPORT */}
          {currentSection === 'help' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Help Center & FAQ</h4>
                <p className="text-xs text-slate-500">
                  Browse troubleshooting guides for audio/video calling, group permissions, and multi-device pairing.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#111b21] border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Contact Support</h4>
                <p className="text-xs text-slate-500">Reach our 24/7 technical team at support@gbofficial.app</p>
              </div>
            </div>
          )}

          {/* 15. Fallback for other sections */}
          {!['root', 'account', 'privacy', 'security', 'profile', 'notifications', 'chats', 'calls', 'appearance', 'storage', 'payments', 'subscriptions', 'backup', 'about', 'help'].includes(currentSection) && (
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                {currentSection.replace('_', ' ')} Settings
              </h3>
              <p className="text-xs text-slate-400">
                All configuration preferences for this section are active and synchronized with your account.
              </p>
              <button
                onClick={() => setCurrentSection('root')}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Back to Settings
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#111b21] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold transition shadow-sm"
          >
            {savedSuccess ? 'Saved!' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};
