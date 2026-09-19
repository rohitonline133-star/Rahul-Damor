import React, { useState, useEffect, useId } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Camera,
  Check,
  Globe,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GbLogo } from '../common/GbLogo';
import { OAuthConfig } from '../../types';

interface AuthModalProps {
  onClose: () => void;
  initialMode?: 'register' | 'login';
}

// Preset country list for phone registration
const COUNTRIES = [
  { name: 'United States', code: '+1', flag: '🇺🇸', placeholder: '(555) 019-2834' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
  { name: 'India', code: '+91', flag: '🇮🇳', placeholder: '98765 43210' },
  { name: 'Canada', code: '+1', flag: '🇨🇦', placeholder: '(555) 019-9922' },
  { name: 'Germany', code: '+49', flag: '🇩🇪', placeholder: '151 23456789' },
  { name: 'France', code: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { name: 'Australia', code: '+61', flag: '🇦🇺', placeholder: '412 345 678' },
  { name: 'Japan', code: '+81', flag: '🇯🇵', placeholder: '90 1234 5678' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷', placeholder: '11 98765-4321' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬', placeholder: '802 123 4567' },
];

// Preset profile avatars
const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
];

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, initialMode = 'register' }) => {
  const {
    currentUser,
    login,
    requestOtp,
    verifyOtp,
    checkUsername,
    completeRegistration,
    sendRecoveryOtp,
    resetPasswordWithOtp,
    allUsers,
    switchAccount,
    oauthConfig,
    fetchOAuthConfig,
  } = useAuth();

  // Mode: 'login' | 'register_phone' | 'register_otp' | 'register_profile' | 'forgot' | 'terms'
  const [mode, setMode] = useState<
    'login' | 'register_phone' | 'register_otp' | 'register_profile' | 'forgot' | 'terms'
  >(initialMode === 'login' ? 'login' : 'register_phone');

  // Country Code Selection
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phoneNational, setPhoneNational] = useState('');
  const fullPhoneNumber = `${selectedCountry.code}${phoneNational.replace(/\D/g, '')}`;

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const [devOtpNotification, setDevOtpNotification] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Profile Setup State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  // Login Options
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // phone or username
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorPin, setTwoFactorPin] = useState('');

  // Password Recovery State
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI status
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthModalNotice, setOauthModalNotice] = useState<{ provider: string; message: string } | null>(null);

  // Cooldown timer for OTP
  useEffect(() => {
    let timer: any;
    if (countdown > 0 && !canResend) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0 && !canResend) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [countdown, canResend]);

  // Fetch OAuth settings on mount
  useEffect(() => {
    fetchOAuthConfig();
  }, []);

  // Live Username Validation with Debounce
  useEffect(() => {
    if (!username.trim() || mode !== 'register_profile') {
      setUsernameStatus({ checking: false });
      return;
    }

    if (username.length < 3) {
      setUsernameStatus({ checking: false, available: false, message: 'Must be at least 3 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Only letters, numbers, and underscores allowed',
      });
      return;
    }

    setUsernameStatus({ checking: true });
    const timer = setTimeout(async () => {
      const res = await checkUsername(username.trim());
      setUsernameStatus({
        checking: false,
        available: res.available,
        message: res.message || res.reason,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [username, mode]);

  // Handle OTP digit inputs
  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  // 1. Submit Phone for OTP
  const handleSendRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanNumber = phoneNational.replace(/\D/g, '');
    if (cleanNumber.length < 7) {
      setError('Please enter a valid mobile phone number.');
      return;
    }

    setIsLoading(true);
    const res = await requestOtp(fullPhoneNumber, 'register');
    setIsLoading(false);

    if (res.success) {
      setMode('register_otp');
      setCountdown(res.cooldownSeconds || 45);
      setCanResend(false);
      setOtpDigits(['', '', '', '', '', '']);
      if (res.devOtp) {
        setDevOtpNotification(res.devOtp);
      }
    } else {
      setError(res.error || 'Failed to send verification code.');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setError(null);
    setIsLoading(true);
    const res = await requestOtp(fullPhoneNumber, 'register');
    setIsLoading(false);

    if (res.success) {
      setCountdown(res.cooldownSeconds || 45);
      setCanResend(false);
      setSuccess('Verification code resent successfully!');
      if (res.devOtp) setDevOtpNotification(res.devOtp);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(res.error || 'Failed to resend code.');
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsLoading(true);
    const res = await verifyOtp(fullPhoneNumber, code, 'register');
    setIsLoading(false);

    if (res.success && res.verified) {
      if (res.verificationToken) {
        setVerificationToken(res.verificationToken);
        setMode('register_profile');
      } else if (res.token) {
        // Direct login if existing user
        onClose();
      }
    } else {
      setError(res.error || 'Invalid or expired verification code. Please try again.');
    }
  };

  // 3. Finalize Profile Registration
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    if (!username.trim() || !usernameStatus.available) {
      setError(usernameStatus.message || 'Please choose a valid and available username.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!verificationToken) {
      setError('Phone verification expired. Please verify your phone number again.');
      setMode('register_phone');
      return;
    }

    setIsLoading(true);
    const res = await completeRegistration({
      phone: fullPhoneNumber,
      verificationToken,
      fullName: fullName.trim(),
      username: username.trim(),
      password: password.trim(),
      avatar: selectedAvatar,
      bio: bio.trim(),
    });
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Registration failed.');
    }
  };

  // 4. Handle Standard / Phone Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (loginMethod === 'otp') {
      // Login with OTP
      const cleanNumber = phoneNational.replace(/\D/g, '');
      if (cleanNumber.length < 7) {
        setIsLoading(false);
        setError('Please enter a valid phone number.');
        return;
      }
      const res = await requestOtp(fullPhoneNumber, 'login');
      setIsLoading(false);
      if (res.success) {
        setMode('register_otp');
        setCountdown(res.cooldownSeconds || 45);
        setCanResend(false);
        if (res.devOtp) setDevOtpNotification(res.devOtp);
      } else {
        setError(res.error || 'Failed to request login OTP.');
      }
      return;
    }

    // Login with Password
    const res = await login(loginIdentifier.trim(), loginPassword, twoFactorPin || undefined);
    setIsLoading(false);

    if (res.success) {
      onClose();
    } else if (res.requires2FA) {
      setRequires2FA(true);
      setError('Two-factor authentication is active on this account. Please enter your 6-digit PIN.');
    } else {
      setError(res.error || 'Invalid credentials.');
    }
  };

  // 5. Handle Social Login Click (Honest Configuration Guard)
  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    const config = oauthConfig?.[provider];
    if (!config || !config.configured) {
      setOauthModalNotice({
        provider: provider === 'google' ? 'Google' : 'Facebook',
        message:
          config?.message ||
          `${provider === 'google' ? 'GOOGLE_CLIENT_ID' : 'FACEBOOK_APP_ID'} is not configured in this environment. To enable real ${provider} authentication, add your credentials in Settings.`,
      });
      return;
    }
    // If real provider is configured
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  // 6. Handle Account Recovery
  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recoveryIdentifier.trim()) {
      setError('Please enter your registered phone number or email.');
      return;
    }

    setIsLoading(true);
    const res = await sendRecoveryOtp(recoveryIdentifier.trim());
    setIsLoading(false);

    if (res.success) {
      setRecoveryStep('verify');
      setSuccess('Recovery code dispatched.');
      if (res.devOtp) setDevOtpNotification(res.devOtp);
    } else {
      setError(res.error || 'Account not found with this identifier.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    const res = await resetPasswordWithOtp(recoveryIdentifier.trim(), recoveryOtp.trim(), newPassword);
    setIsLoading(false);

    if (res.success) {
      setSuccess('Password has been securely reset! You can now log in.');
      setMode('login');
      setRecoveryStep('request');
      setRecoveryOtp('');
      setNewPassword('');
    } else {
      setError(res.error || 'Failed to reset password. Check recovery code.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col space-y-4 my-8 animate-in fade-in zoom-in-95">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <GbLogo size="sm" />
          {currentUser && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 font-medium flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Global Success Banner */}
        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div className="flex-1">{success}</div>
          </div>
        )}

        {/* Carrier SMS / OTP Service Status Banner */}
        {devOtpNotification && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-in slide-in-from-top-2">
            <div className="space-y-0.5">
              <span className="font-bold block text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                OTP service not configured
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Carrier SMS gateway credentials not set in environment. Real server-generated code:{' '}
                <strong className="font-mono text-sm tracking-widest text-emerald-600 dark:text-emerald-300">
                  {devOtpNotification}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (mode === 'register_otp') {
                  const chars = devOtpNotification.split('').slice(0, 6);
                  setOtpDigits(chars);
                } else if (mode === 'forgot') {
                  setRecoveryOtp(devOtpNotification);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] shadow transition shrink-0"
            >
              Fill OTP
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 1: REGISTRATION - PHONE INPUT */}
        {/* ======================================================== */}
        {mode === 'register_phone' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-slate-100">
                Create your account
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                GB Official will send an SMS to verify your mobile number. Carrier rates may apply.
              </p>
            </div>

            <form onSubmit={handleSendRegistrationOtp} className="space-y-4">
              {/* Country Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Country / Region
                </label>
                <div className="relative">
                  <select
                    value={selectedCountry.name}
                    onChange={(e) => {
                      const found = COUNTRIES.find((c) => c.name === e.target.value);
                      if (found) setSelectedCountry(found);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone Input with Calling Code */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Mobile Phone Number
                </label>
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                  <span className="px-3.5 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 flex items-center border-r border-slate-200 dark:border-slate-700">
                    {selectedCountry.code}
                  </span>
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={phoneNational}
                    onChange={(e) => setPhoneNational(e.target.value)}
                    placeholder={selectedCountry.placeholder}
                    className="flex-1 px-3 py-2.5 bg-transparent text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Terms and Privacy Agreement */}
              <p className="text-[11px] text-slate-500 leading-normal">
                By continuing, you confirm that you agree to the{' '}
                <button
                  type="button"
                  onClick={() => setMode('terms')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => setMode('terms')}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Privacy Policy
                </button>
                .
              </p>

              <button
                type="submit"
                disabled={isLoading || !phoneNational.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Sending verification code...
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-xs text-slate-500">Already registered? </span>
              <button
                onClick={() => setMode('login')}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Log in to GB Official
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2: 6-DIGIT OTP VERIFICATION */}
        {/* ======================================================== */}
        {mode === 'register_otp' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('register_phone')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100">
                  Verify your number
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter 6-digit code sent to <strong className="font-mono">{fullPhoneNumber}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* 6 OTP Input Boxes */}
              <div className="flex justify-between gap-1.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 text-center font-mono text-lg font-extrabold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ))}
              </div>

              {/* Countdown & Resend */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setMode('register_phone')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Change phone number
                </button>

                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Resend Code
                  </button>
                ) : (
                  <span className="text-slate-400 font-mono">Resend in {countdown}s</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpDigits.some((d) => !d)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying code...
                  </>
                ) : (
                  <>
                    Verify & Continue <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 3: PROFILE SETUP */}
        {/* ======================================================== */}
        {mode === 'register_profile' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-slate-100">
                Setup your profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provide your name and choose a unique @username for GB Official.
              </p>
            </div>

            <form onSubmit={handleCompleteRegistration} className="space-y-3.5">
              {/* Avatar Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Profile Picture
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={selectedAvatar}
                    alt="Selected avatar"
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-emerald-500 shadow-md"
                  />
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(av)}
                        className={`relative rounded-full overflow-hidden transition ${
                          selectedAvatar === av ? 'ring-2 ring-emerald-500 scale-105' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={av} alt="Avatar option" className="w-8 h-8 object-cover rounded-full" />
                        {selectedAvatar === av && (
                          <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                  <UserIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Username with Live Checker */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Username (@handle)
                  </label>
                  {usernameStatus.checking && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Checking...
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === true && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {usernameStatus.message || 'Unavailable'}
                    </span>
                  )}
                </div>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-mono font-bold text-slate-400 mr-1">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    placeholder="alex_official"
                    className="w-full bg-transparent text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Create Password
                </label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Bio (Optional) */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Bio (Optional)
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Hey there! I am using GB Official."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !fullName.trim() || !usernameStatus.available}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Completing registration...
                  </>
                ) : (
                  <>
                    Finish & Open GB Official <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 4: LOGIN */}
        {/* ======================================================== */}
        {mode === 'login' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-slate-100">
                Log in to GB Official
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Encrypted communication for verified devices
              </p>
            </div>

            {/* Login Method Switcher */}
            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('password');
                  setRequires2FA(false);
                }}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  loginMethod === 'password'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('otp');
                  setRequires2FA(false);
                }}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  loginMethod === 'otp'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Phone SMS OTP
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {loginMethod === 'password' ? (
                <>
                  {/* Identifier */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Phone, Email, or Username
                    </label>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                      <UserIcon className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type="text"
                        required
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="+1 555-0199 or @jordan_official"
                        className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setRecoveryStep('request');
                        }}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                      <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* 2FA PIN Field if required */}
                  {requires2FA && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <KeyRound className="w-4 h-4" /> Two-Step Verification PIN
                      </div>
                      <input
                        type="password"
                        maxLength={6}
                        value={twoFactorPin}
                        onChange={(e) => setTwoFactorPin(e.target.value)}
                        placeholder="Enter 6-digit security PIN"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono font-bold tracking-widest text-slate-900 dark:text-slate-100 border border-amber-300 dark:border-amber-700 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Remember Me */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Keep me signed in
                    </label>
                  </div>
                </>
              ) : (
                <>
                  {/* Phone OTP Login */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Country / Calling Code
                    </label>
                    <select
                      value={selectedCountry.name}
                      onChange={(e) => {
                        const found = COUNTRIES.find((c) => c.name === e.target.value);
                        if (found) setSelectedCountry(found);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Registered Phone Number
                    </label>
                    <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                      <span className="px-3 py-2.5 bg-slate-200/70 dark:bg-slate-700/60 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 flex items-center border-r border-slate-200 dark:border-slate-700">
                        {selectedCountry.code}
                      </span>
                      <input
                        type="tel"
                        required
                        value={phoneNational}
                        onChange={(e) => setPhoneNational(e.target.value)}
                        placeholder={selectedCountry.placeholder}
                        className="flex-1 px-3 py-2.5 bg-transparent text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    {loginMethod === 'otp' ? 'Request Login OTP' : 'Log In'} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Social Logins */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                Or continue with
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  Google
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition"
                >
                  <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Facebook
                </button>
              </div>
            </div>

            {/* Switch to Registration */}
            <div className="pt-2 text-center text-xs">
              <span className="text-slate-500">New to GB Official? </span>
              <button
                onClick={() => {
                  setMode('register_phone');
                  setError(null);
                  setSuccess(null);
                }}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Create an account
              </button>
            </div>

            {/* Quick Demo Accounts Switcher (Convenient for Reviewers) */}
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 text-center">
                Reviewer Quick Switch
              </span>
              <div className="flex gap-1.5">
                {allUsers.slice(0, 3).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={async () => {
                      await switchAccount(u.id);
                      onClose();
                    }}
                    className="flex-1 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200/60 dark:border-slate-700/60 text-left transition flex items-center gap-1.5"
                  >
                    <img src={u.avatar} alt={u.displayName} className="w-5 h-5 rounded-full object-cover shrink-0" />
                    <div className="truncate">
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {u.displayName.split(' ')[0]}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 5: ACCOUNT RECOVERY / FORGOT PASSWORD */}
        {/* ======================================================== */}
        {mode === 'forgot' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('login')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-slate-100">
                  Account Recovery
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reset your password using a verified security code
                </p>
              </div>
            </div>

            {recoveryStep === 'request' ? (
              <form onSubmit={handleSendRecovery} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Registered Phone or Email
                  </label>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                    <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      required
                      value={recoveryIdentifier}
                      onChange={(e) => setRecoveryIdentifier(e.target.value)}
                      placeholder="+1 555-0199 or user@example.com"
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !recoveryIdentifier.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Dispatching code...
                    </>
                  ) : (
                    <>
                      Send Recovery Code <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    6-Digit Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryOtp}
                    onChange={(e) => setRecoveryOtp(e.target.value)}
                    placeholder="Enter code"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-center text-sm font-bold tracking-widest text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    New Secure Password
                  </label>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-700">
                    <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !recoveryOtp || newPassword.length < 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Saving password...
                    </>
                  ) : (
                    <>
                      Confirm New Password <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* SCREEN 6: TERMS OF SERVICE & PRIVACY POLICY */}
        {/* ======================================================== */}
        {mode === 'terms' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('register_phone')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  GB Official Terms & Privacy
                </h3>
                <p className="text-[11px] text-slate-500">Security, Encryption & Data Governance</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-3 max-h-64 overflow-y-auto leading-relaxed">
              <p className="font-bold text-slate-900 dark:text-slate-100">
                1. End-to-End Cryptography & Real Sessions
              </p>
              <p>
                GB Official utilizes client and server-side cryptographic isolation. When registering with your mobile
                phone number, real one-time passwords protect your account identity from unauthorized takeovers.
              </p>
              <p className="font-bold text-slate-900 dark:text-slate-100">2. Device Security & Access Control</p>
              <p>
                Multi-device sessions are recorded with device model, platform fingerprint, IP hash, and last active
                timestamp. You can remotely revoke any active session at any time from Settings.
              </p>
              <p className="font-bold text-slate-900 dark:text-slate-100">3. Honest Third-Party Integration</p>
              <p>
                Third-party OAuth providers (Google, Facebook) are strictly communicated with through verified server
                credentials. Unconfigured credentials will never simulate fake logins.
              </p>
            </div>

            <button
              onClick={() => setMode('register_phone')}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition"
            >
              Return to Registration
            </button>
          </div>
        )}

        {/* OAuth Notice Modal */}
        {oauthModalNotice && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xl space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {oauthModalNotice.provider} OAuth Status
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {oauthModalNotice.message}
              </p>
              <button
                onClick={() => setOauthModalNotice(null)}
                className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs"
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

