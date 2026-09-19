import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GbLogo } from '../common/GbLogo';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    if (mode === 'login') {
      const res = await login(username.trim(), password);
      setIsLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Login failed');
      }
    } else if (mode === 'register') {
      const res = await register({
        username: username.trim(),
        password,
        displayName: displayName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setIsLoading(false);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Registration failed');
      }
    } else if (mode === 'forgot') {
      const res = await resetPassword(username.trim(), password);
      setIsLoading(false);
      if (res.success) {
        setSuccess('Password updated! You can now log in.');
        setMode('login');
      } else {
        setError(res.error || 'Reset failed');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <GbLogo size="sm" />
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
            {mode === 'login'
              ? 'Log in to GB Official'
              : mode === 'register'
              ? 'Create New GB Account'
              : 'Reset Password'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Encrypted, real-time communication on Android
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Full Name</label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <User className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Maya Lin"
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Email</label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <Mail className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maya@example.com"
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Phone (for SMS OTP)
                </label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <Phone className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              Username (@handle)
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
              <span className="text-xs font-mono text-slate-400 mr-1">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              {mode === 'forgot' ? 'New Password' : 'Password'}
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
              <Lock className="w-4 h-4 text-slate-400 mr-2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'login'
              ? 'Log In'
              : mode === 'register'
              ? 'Register Account'
              : 'Save New Password'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs space-y-1">
          {mode === 'login' ? (
            <>
              <p className="text-slate-500">
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('register')}
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Create one
                </button>
              </p>
              <button
                onClick={() => setMode('forgot')}
                className="text-[11px] text-slate-400 hover:underline block mx-auto"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <p className="text-slate-500">
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Log In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
