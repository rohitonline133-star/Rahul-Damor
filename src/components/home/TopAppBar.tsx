import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Settings,
  Sun,
  Moon,
  CheckCircle2,
  ChevronDown,
  UserCheck,
  ShieldAlert,
  Play,
  LogOut,
  UserPlus,
  Camera,
  ShoppingBag,
  Laptop,
  Megaphone,
} from 'lucide-react';
import { GbLogo } from '../common/GbLogo';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface TopAppBarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenTests: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: (mode?: 'register' | 'login') => void;
  onOpenCamera?: () => void;
  onOpenShop?: () => void;
  onOpenLinkedDevices?: () => void;
  onOpenBroadcasts?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  onOpenSearch,
  onOpenSettings,
  onOpenTests,
  onOpenAdmin,
  onOpenAuth,
  onOpenCamera,
  onOpenShop,
  onOpenLinkedDevices,
  onOpenBroadcasts,
}) => {
  const { currentUser, allUsers, switchAccount, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowAccountSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full px-3.5 py-2.5 flex items-center justify-between bg-[#005c4b] dark:bg-[#1f2c34] text-white shadow-sm z-30 shrink-0 transition-colors">
      {/* Left: GB Official Logo + Title */}
      <div className="flex items-center gap-2.5">
        <GbLogo size="sm" />
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h1 className="font-extrabold text-[17px] tracking-tight text-white leading-tight font-sans">
              GB Official
            </h1>
            <span className="px-1.5 py-0.2 bg-emerald-400/25 text-emerald-200 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
              PRO
            </span>
          </div>
          {currentUser && (
            <span className="text-[10.5px] text-emerald-100/75 font-medium truncate max-w-[140px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] inline-block animate-pulse" />
              {currentUser.displayName}
            </span>
          )}
        </div>
      </div>

      {/* Right: Camera, Search, Theme Toggle, More Options */}
      <div className="flex items-center gap-0.5 relative" ref={menuRef}>
        {/* Quick Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-[19px] h-[19px] text-amber-300" />
          ) : (
            <Moon className="w-[19px] h-[19px] text-emerald-100" />
          )}
        </button>

        {/* Camera Shortcut */}
        {onOpenCamera && (
          <button
            onClick={onOpenCamera}
            className="p-2 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Camera & Status Capture"
            aria-label="Camera"
          >
            <Camera className="w-[19px] h-[19px]" />
          </button>
        )}

        {/* Search Icon */}
        <button
          onClick={onOpenSearch}
          className="p-2 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition"
          title="Search chats, contacts, messages"
          aria-label="Search"
        >
          <Search className="w-[19px] h-[19px]" />
        </button>

        {/* More Options / Settings */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition"
          title="More options"
          aria-label="More options"
        >
          <MoreVertical className="w-[19px] h-[19px]" />
        </button>

        {/* Android Native-Style Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-slate-850 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Switch user account quick submenu trigger */}
            <button
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Switch Account
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showAccountSwitcher ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showAccountSwitcher && (
              <div className="px-1 py-1 max-h-40 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-900 rounded-xl mb-1 border border-slate-100 dark:border-slate-800">
                {allUsers.map((user) => {
                  const isActive = currentUser?.id === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        switchAccount(user.id);
                        setShowMenu(false);
                        setShowAccountSwitcher(false);
                      }}
                      className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={user.avatar}
                          alt={user.displayName}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <div className="truncate text-[11px]">{user.displayName}</div>
                      </div>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Settings & Privacy</span>
            </button>

            {onOpenShop && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenShop();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <ShoppingBag className="w-4 h-4 text-[#00a884]" />
                <span>GB Official Store</span>
              </button>
            )}

            {onOpenLinkedDevices && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenLinkedDevices();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Laptop className="w-4 h-4 text-emerald-500" />
                <span>Linked Devices</span>
              </button>
            )}

            {onOpenBroadcasts && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenBroadcasts();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Megaphone className="w-4 h-4 text-cyan-500" />
                <span>New Broadcast</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenTests();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Play className="w-4 h-4 text-emerald-500" />
              <span>Run Automated Tests</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenAdmin();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition text-amber-600 dark:text-amber-400"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin & Safety Console</span>
              </button>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenAuth('register');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Account</span>
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                onOpenAuth('login');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <UserCheck className="w-4 h-4 text-cyan-500" />
              <span>Switch / Sign In</span>
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
