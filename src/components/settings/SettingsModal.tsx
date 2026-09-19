import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Bell,
  Palette,
  Lock,
  LogOut,
  Save,
  Check,
  Smartphone,
  Eye,
  CheckCheck,
  Moon,
  Sun,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface SettingsModalProps {
  onClose: () => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onLogout }) => {
  const { currentUser, updateProfile, token } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'notifications' | 'appearance' | 'security'>('profile');

  // Profile form state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');

  // Privacy toggles
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(currentUser?.privacySettings?.lastSeen || 'everyone');
  const [readReceipts, setReadReceipts] = useState(currentUser?.privacySettings?.readReceipts ?? true);

  // Security toggles
  const [twoFactor, setTwoFactor] = useState(false);
  const [appLock, setAppLock] = useState(false);

  // Notifications
  const [messageSound, setMessageSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await updateProfile({
      displayName,
      bio,
      phone,
      avatar,
      privacySettings: {
        profilePhoto: currentUser?.privacySettings?.profilePhoto || 'everyone',
        statusPrivacy: currentUser?.privacySettings?.statusPrivacy || 'everyone',
        lastSeen: lastSeenPrivacy as any,
        readReceipts,
      },
    });
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              GB Official Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 gap-1 overflow-x-auto no-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
          {[
            { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
            { id: 'privacy', label: 'Privacy', icon: <Shield className="w-4 h-4" /> },
            { id: 'appearance', label: 'Theme', icon: <Palette className="w-4 h-4" /> },
            { id: 'notifications', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
            { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5 text-slate-800 dark:text-slate-100 text-sm">
          {/* 1. PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={avatar || currentUser?.avatar}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-500"
                />
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Username (@handle)
                </label>
                <input
                  type="text"
                  value={currentUser?.username || ''}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-sm text-slate-400 cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">About / Bio</label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* 2. PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    Last Seen & Online
                  </div>
                  <div className="text-[11px] text-slate-400">Who can see when you were active</div>
                </div>
                <select
                  value={lastSeenPrivacy}
                  onChange={(e) => setLastSeenPrivacy(e.target.value as any)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1"
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    Read Receipts (Blue/Cyan Ticks)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    If turned off, you won't send or receive read receipts
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    Disappearing Messages
                  </div>
                  <div className="text-[11px] text-slate-400">Default timer for new chats</div>
                </div>
                <span className="text-xs text-emerald-500 font-semibold">Off</span>
              </div>
            </div>
          )}

          {/* 3. APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div className="flex items-center gap-2.5">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-cyan-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <div className="font-semibold text-xs">Application Theme</div>
                    <div className="text-[11px] text-slate-400">Current mode: {theme}</div>
                  </div>
                </div>

                <button
                  onClick={toggleTheme}
                  className="px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold hover:scale-105 transition"
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block mb-2">
                  GB Brand Accent Palette
                </span>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-4 h-4 rounded-full bg-emerald-500" />
                    Emerald / Cyan (GB Official Default)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs">Conversation Audio Tones</div>
                  <div className="text-[11px] text-slate-400">Play sounds for incoming and sent messages</div>
                </div>
                <input
                  type="checkbox"
                  checked={messageSound}
                  onChange={(e) => setMessageSound(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs">Haptic Vibration</div>
                  <div className="text-[11px] text-slate-400">Vibrate device on calls and alerts</div>
                </div>
                <input
                  type="checkbox"
                  checked={vibrate}
                  onChange={(e) => setVibrate(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 5. SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs">Two-Step Verification</div>
                  <div className="text-[11px] text-slate-400">
                    Require a 6-digit PIN when registering again
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={twoFactor}
                  onChange={(e) => setTwoFactor(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850">
                <div>
                  <div className="font-semibold text-xs">Biometric / App Lock</div>
                  <div className="text-[11px] text-slate-400">
                    Unlock with fingerprint or passcode
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={appLock}
                  onChange={(e) => setAppLock(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white font-semibold text-xs transition"
                >
                  <LogOut className="w-4 h-4" /> Log Out of GB Official
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div>
            {savedSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" /> Settings saved!
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
