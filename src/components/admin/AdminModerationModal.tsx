import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Users,
  AlertTriangle,
  CheckCircle,
  Ban,
  UserCheck,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, Report } from '../../types';

interface AdminModerationModalProps {
  onClose: () => void;
}

export const AdminModerationModal: React.FC<AdminModerationModalProps> = ({ onClose }) => {
  const { token, allUsers, refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReports = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    if (!token) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: currentBanned ? 'unban' : 'ban' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update user ban status.');
      await refreshUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update user ban status.');
    }
  };

  const handleToggleVerify = async (userId: string, currentVerified: boolean) => {
    if (!token) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: currentVerified ? 'unverify' : 'verify' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update verification status.');
      await refreshUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update verification status.');
    }
  };

  const handleResolveReport = async (reportId: string, action: string) => {
    if (!token) return;
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: action === 'ban_user' ? 'suspend_user' : action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not process this report.');
      await fetchReports();
      await refreshUsers();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not process this report.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-tight">
                GB Trust & Safety Admin Console
              </h3>
              <p className="text-[11px] text-slate-500">
                Live moderation, user bans, verification, and safety reports
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'users'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            <Users className="w-4 h-4" /> Users Directory ({allUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'reports'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Pending Reports ({reports.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {actionError && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">{actionError}</div>}
          {activeTab === 'users' && (
            <div className="space-y-2">
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {user.displayName}
                        </span>
                        {user.isVerified && (
                          <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                            Verified
                          </span>
                        )}
                        {user.isBanned && (
                          <span className="px-1.5 py-0.2 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] font-bold">
                            Banned
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        @{user.username} • {user.role}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleVerify(user.id, Boolean(user.isVerified))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        user.isVerified
                          ? 'bg-cyan-500/15 text-cyan-600 hover:bg-cyan-500 hover:text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                      title="Toggle Official Verification"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleToggleBan(user.id, Boolean(user.isBanned))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        user.isBanned
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-red-600 hover:bg-red-500 hover:text-white'
                      }`}
                      title={user.isBanned ? 'Unban user' : 'Ban user'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-400">
                      Category: {report.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Status: {report.status}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl">
                    Target: {report.targetType} (ID: {report.targetId})
                  </p>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={() => handleResolveReport(report.id, 'dismiss')}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleResolveReport(report.id, report.targetType === 'user' ? 'suspend_user' : 'delete_content')}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                      Ban Target & Resolve
                    </button>
                  </div>
                </div>
              ))}

              {reports.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No moderation reports found. System is healthy!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
