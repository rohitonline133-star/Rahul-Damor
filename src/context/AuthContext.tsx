import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserPrivacySettings,
  AuthSession,
  SecurityLog,
  OAuthConfig,
  PhoneOtpResponse,
  PhoneVerifyResponse,
} from '../types';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  currentSession: AuthSession | null;
  isLoading: boolean;
  login: (
    emailOrUsername: string,
    password: string,
    twoFactorPin?: string
  ) => Promise<{ success: boolean; requires2FA?: boolean; error?: string }>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  requestOtp: (phone: string, purpose?: string) => Promise<PhoneOtpResponse & { error?: string }>;
  verifyOtp: (phone: string, code: string, purpose?: string) => Promise<PhoneVerifyResponse & { error?: string }>;
  checkUsername: (username: string) => Promise<{ available: boolean; reason?: string; message?: string }>;
  completeRegistration: (data: {
    phone: string;
    verificationToken: string;
    fullName: string;
    username: string;
    password?: string;
    email?: string;
    avatar?: string;
    bio?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (username: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendRecoveryOtp: (phoneOrEmail: string) => Promise<{ success: boolean; error?: string; devOtp?: string }>;
  resetPasswordWithOtp: (
    phoneOrEmail: string,
    code: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  logoutAllSessions: () => Promise<boolean>;
  switchAccount: (userId: string) => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  toggleBlockUser: (targetUserId: string, block: boolean) => Promise<void>;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  oauthConfig: OAuthConfig | null;
  fetchOAuthConfig: () => Promise<OAuthConfig | null>;
  sessions: AuthSession[];
  fetchSessions: () => Promise<AuthSession[]>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  securityLogs: SecurityLog[];
  fetchSecurityLogs: () => Promise<SecurityLog[]>;
  toggleTwoFactor: (enabled: boolean, pin?: string) => Promise<{ success: boolean; error?: string }>;
  requestChangePhone: (newPhone: string) => Promise<{ success: boolean; error?: string; devOtp?: string }>;
  verifyChangePhone: (newPhone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deactivateAccount: () => Promise<boolean>;
  deleteAccount: () => Promise<boolean>;
  exportData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('gb_token'));
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);

  const clearAuthError = () => setAuthError(null);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.session) setCurrentSession(data.session);
        return true;
      } else {
        localStorage.removeItem('gb_token');
        setToken(null);
        setCurrentUser(null);
        setCurrentSession(null);
        return false;
      }
    } catch {
      return false;
    }
  };

  const fetchOAuthConfig = async (): Promise<OAuthConfig | null> => {
    try {
      const res = await fetch('/api/auth/oauth/config');
      if (res.ok) {
        const data = await res.json();
        setOAuthConfig(data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const fetchSessions = async (): Promise<AuthSession[]> => {
    if (!token) return [];
    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        return data.sessions || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  const revokeSession = async (sessionId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        await fetchSessions();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logoutAllSessions = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        logout();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchSecurityLogs = async (): Promise<SecurityLog[]> => {
    if (!token) return [];
    try {
      const res = await fetch('/api/auth/security-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSecurityLogs(data.logs || []);
        return data.logs || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      fetchOAuthConfig();
      if (token) {
        const ok = await fetchCurrentUser(token);
        if (!ok) {
          localStorage.removeItem('gb_token');
          setToken(null);
          setCurrentUser(null);
          setCurrentSession(null);
        }
      } else {
        setToken(null);
        setCurrentUser(null);
        setCurrentSession(null);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshUsers();
    }
  }, [currentUser]);

  // Request Phone OTP
  const requestOtp = async (
    phone: string,
    purpose: string = 'register'
  ): Promise<PhoneOtpResponse & { error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Failed to send verification code.';
        setAuthError(err);
        return {
          success: false,
          smsConfigured: data.smsConfigured ?? false,
          message: data.message || err,
          error: err,
          cooldownSeconds: data.cooldownSeconds,
          gatewayStatus: data.gatewayStatus,
        };
      }
      return { success: true, ...data };
    } catch {
      const err = 'Network error while connecting to verification gateway.';
      setAuthError(err);
      return { success: false, message: err, error: err };
    }
  };

  // Verify Phone OTP
  const verifyOtp = async (
    phone: string,
    code: string,
    purpose: string = 'register'
  ): Promise<PhoneVerifyResponse & { error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Verification code failed.';
        setAuthError(err);
        return { success: false, verified: false, error: err, message: err };
      }
      // If user logged in directly via OTP
      if (data.token && data.user) {
        setToken(data.token);
        localStorage.setItem('gb_token', data.token);
        setCurrentUser(data.user);
        if (data.session) setCurrentSession(data.session);
      }
      return data;
    } catch {
      const err = 'Network error during code verification.';
      setAuthError(err);
      return { success: false, verified: false, error: err };
    }
  };

  // Live Username Checker
  const checkUsername = async (
    username: string
  ): Promise<{ available: boolean; reason?: string; message?: string }> => {
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      return data;
    } catch {
      return { available: false, reason: 'Network error checking username availability.' };
    }
  };

  // Complete Registration with Verified Phone & Profile
  const completeRegistration = async (data: {
    phone: string;
    verificationToken: string;
    fullName: string;
    username: string;
    password?: string;
    email?: string;
    avatar?: string;
    bio?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/phone/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        const err = resData.error || 'Registration failed.';
        setAuthError(err);
        return { success: false, error: err };
      }
      setToken(resData.token);
      localStorage.setItem('gb_token', resData.token);
      setCurrentUser(resData.user);
      if (resData.session) setCurrentSession(resData.session);
      return { success: true };
    } catch {
      const err = 'Network error while completing registration.';
      setAuthError(err);
      return { success: false, error: err };
    }
  };

  // Standard or Phone Login with Optional 2FA
  const login = async (
    emailOrUsername: string,
    password: string,
    twoFactorPin?: string
  ): Promise<{ success: boolean; requires2FA?: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrUsername, password, twoFactorPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data.error || 'Login failed.';
        setAuthError(err);
        return { success: false, error: err };
      }
      if (data.requires2FA) {
        return { success: false, requires2FA: true };
      }
      setToken(data.token);
      localStorage.setItem('gb_token', data.token);
      setCurrentUser(data.user);
      if (data.session) setCurrentSession(data.session);
      return { success: true };
    } catch {
      const err = 'Connection error. Please try again.';
      setAuthError(err);
      return { success: false, error: err };
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    username: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    // If phone is provided, send OTP
    if (data.phone) {
      const otpRes = await requestOtp(data.phone, 'register');
      if (!otpRes.success) {
        return { success: false, error: otpRes.error };
      }
      return { success: true };
    }
    // Fallback direct register
    return { success: false, error: 'Phone verification is required to register.' };
  };

  // Password Recovery OTP
  const sendRecoveryOtp = async (
    phoneOrEmail: string
  ): Promise<{ success: boolean; error?: string; devOtp?: string }> => {
    try {
      const res = await fetch('/api/auth/recover/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOrEmail }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Account not found.' };
      return { success: true, devOtp: data.devOtp };
    } catch {
      return { success: false, error: 'Network error during recovery request.' };
    }
  };

  // Reset Password with Recovery OTP
  const resetPasswordWithOtp = async (
    phoneOrEmail: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/recover/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneOrEmail, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Password reset failed.' };
      return { success: true };
    } catch {
      return { success: false, error: 'Network error during password reset.' };
    }
  };

  const resetPassword = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    return resetPasswordWithOtp(username, '', password);
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('gb_token');
    setToken(null);
    setCurrentUser(null);
    setCurrentSession(null);
  };

  const switchAccount = async (userId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/switch-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem('gb_token', data.token);
        setCurrentUser(data.user);
        if (data.session) setCurrentSession(data.session);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const resData = await res.json();
        setCurrentUser(resData.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleBlockUser = async (targetUserId: string, block: boolean) => {
    if (!token || !currentUser) return;
    try {
      const res = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId, block }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser({ ...currentUser, blockedUserIds: data.blockedUserIds });
      }
    } catch {
      // ignore
    }
  };

  const toggleTwoFactor = async (
    enabled: boolean,
    pin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/auth/two-factor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled, pin }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Failed to update 2FA' };
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating 2FA' };
    }
  };

  const requestChangePhone = async (
    newPhone: string
  ): Promise<{ success: boolean; error?: string; devOtp?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/auth/change-phone/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPhone }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Request failed' };
      return { success: true, devOtp: data.devOtp };
    } catch {
      return { success: false, error: 'Network error requesting phone change' };
    }
  };

  const verifyChangePhone = async (
    newPhone: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/auth/change-phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPhone, code }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Verification failed' };
      if (currentUser) setCurrentUser({ ...currentUser, phone: newPhone });
      return { success: true };
    } catch {
      return { success: false, error: 'Network error verifying phone change' };
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Password update failed' };
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating password' };
    }
  };

  const deactivateAccount = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/deactivate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        logout();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteAccount = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        logout();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const exportData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/export-data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GB_Official_Archive_${currentUser?.username || 'user'}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        currentSession,
        isLoading,
        login,
        register,
        requestOtp,
        verifyOtp,
        checkUsername,
        completeRegistration,
        resetPassword,
        sendRecoveryOtp,
        resetPasswordWithOtp,
        logout,
        logoutAllSessions,
        switchAccount,
        updateProfile,
        toggleBlockUser,
        allUsers,
        refreshUsers,
        authError,
        clearAuthError,
        oauthConfig,
        fetchOAuthConfig,
        sessions,
        fetchSessions,
        revokeSession,
        securityLogs,
        fetchSecurityLogs,
        toggleTwoFactor,
        requestChangePhone,
        verifyChangePhone,
        changePassword,
        deactivateAccount,
        deleteAccount,
        exportData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
