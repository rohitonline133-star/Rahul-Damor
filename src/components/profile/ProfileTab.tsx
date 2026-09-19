import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Edit3,
  Users,
  UserPlus,
  UserMinus,
  Shield,
  ShieldAlert,
  Ban,
  VolumeX,
  Lock,
  Phone,
  Video,
  MessageCircle,
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  Share2,
  Settings,
  Sparkles,
  Heart,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';
import { User } from '../../types';

interface ProfileTabProps {
  viewingUserId?: string | null;
  onOpenSettings: () => void;
  onOpenEditProfile?: () => void;
  onOpenChatWith?: (userId: string) => void;
  onOpenReport?: (targetId: string, type: 'user' | 'message') => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  viewingUserId,
  onOpenSettings,
  onOpenEditProfile,
  onOpenChatWith,
  onOpenReport,
}) => {
  const { currentUser, allUsers, token, updateProfile } = useAuth();
  const { statuses, setActiveConversationId, createDirectChat } = useChat();
  const { initiateCall } = useCall();

  const targetUser: User =
    (viewingUserId && allUsers.find((u) => u.id === viewingUserId)) || currentUser || allUsers[0];

  const isOwnProfile = !viewingUserId || viewingUserId === currentUser?.id;

  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);

  // Follower/Following List Modal
  const [listModalType, setListModalType] = useState<'followers' | 'following' | null>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser?.displayName || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatar || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Status/Posts for this user
  const userStatuses = statuses.filter((s) => s.userId === targetUser?.id);

  const loadFollowStatus = async () => {
    if (!targetUser?.id) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}/follow-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        setHasRequested(data.hasRequested);
        setFollowersCount(data.followersCount || 0);
        setFollowingCount(data.followingCount || 0);
        setIsBlocked(data.isBlocked || false);
        setIsMuted(data.isMuted || false);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadFollowStatus();
  }, [targetUser?.id, token]);

  const handleToggleFollow = async () => {
    if (!token || !targetUser?.id) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.isFollowing);
        setHasRequested(data.hasRequested);
        setFollowersCount((prev) => (data.isFollowing ? prev + 1 : Math.max(0, prev - 1)));
      }
    } catch {
      // ignore
    }
  };

  const handleToggleBlock = async () => {
    if (!token || !targetUser?.id) return;
    try {
      const res = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: targetUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsBlocked(data.isBlocked);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleMute = async () => {
    if (!token || !targetUser?.id) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}/mute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsMuted(data.isMuted);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleRestrict = async () => {
    if (!token || !targetUser?.id) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}/restrict`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsRestricted(data.isRestricted);
      }
    } catch {
      // ignore
    }
  };

  const openListModal = async (type: 'followers' | 'following') => {
    setListModalType(type);
    setLoadingList(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUserList(type === 'followers' ? data.followers || [] : data.following || []);
      }
    } catch {
      setUserList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    try {
      await updateProfile({
        displayName: editName.trim(),
        bio: editBio.trim(),
        avatar: editAvatar.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1000);
    } catch {
      // ignore
    }
  };

  const handleStartChat = async () => {
    if (isOwnProfile) return;
    const convId = await createDirectChat(targetUser.id);
    if (convId) {
      setActiveConversationId(convId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header Banner */}
      <div className="relative h-36 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#00a884]">
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isOwnProfile ? (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-2xl bg-black/30 backdrop-blur-md text-white hover:bg-black/40 transition"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onOpenReport && onOpenReport(targetUser.id, 'user')}
              className="p-2 rounded-2xl bg-black/30 backdrop-blur-md text-white hover:bg-red-600/80 transition"
              title="Report User"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Card Overlay */}
      <div className="max-w-md mx-auto px-4 -mt-16">
        <div className="bg-white dark:bg-[#111b21] rounded-3xl p-5 shadow-xl border border-slate-200/80 dark:border-slate-800 space-y-4">
          {/* Avatar and Primary Actions */}
          <div className="flex items-end justify-between">
            <div className="relative -mt-12">
              <img
                src={targetUser.avatar}
                alt={targetUser.displayName}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-white dark:ring-[#111b21] shadow-lg bg-slate-100 dark:bg-slate-800"
              />
              {targetUser.online && (
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111b21]" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFollow}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                      isFollowing
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        : 'bg-[#00a884] hover:bg-[#008f6f] text-white shadow-emerald-500/20'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="w-3.5 h-3.5" /> Following
                      </>
                    ) : hasRequested ? (
                      'Requested'
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" /> Follow
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleStartChat}
                    className="p-2 rounded-2xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] hover:bg-[#00a884]/25 transition"
                    title="Send Message"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => initiateCall(targetUser.id, 'voice')}
                    className="p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition"
                    title="Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => initiateCall(targetUser.id, 'video')}
                    className="p-2 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 transition"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Inline Edit Form */}
          {isEditing && isOwnProfile ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Bio / Status</label>
                <textarea
                  rows={2}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-1.5 rounded-xl bg-[#00a884] text-white text-xs font-bold"
                >
                  {saveSuccess ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            /* Standard Profile Info */
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {targetUser.displayName}
                </h2>
                {targetUser.isVerified && (
                  <span
                    className="inline-flex items-center justify-center text-cyan-500"
                    title="Verified GB Official Account"
                  >
                    <UserCheck className="w-4 h-4 fill-cyan-500 text-white dark:text-[#111b21]" />
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400">@{targetUser.username}</p>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {targetUser.bio || 'Hey there! I am using GB Official.'}
              </p>
            </div>
          )}

          {/* Social Stats: Followers / Following / Status Count */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 py-2 border-y border-slate-100 dark:border-slate-800/80 text-center">
            <div
              onClick={() => openListModal('followers')}
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl py-1 transition"
            >
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {followersCount}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Followers
              </div>
            </div>

            <div
              onClick={() => openListModal('following')}
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl py-1 transition"
            >
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {followingCount}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Following
              </div>
            </div>

            <div className="py-1">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {userStatuses.length}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Updates
              </div>
            </div>
          </div>

          {/* User Controls for Other Users: Mute / Block / Restrict / Report */}
          {!isOwnProfile && (
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <button
                onClick={handleToggleMute}
                className={`p-2 rounded-2xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  isMuted
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <VolumeX className="w-3.5 h-3.5" />
                {isMuted ? 'Muted' : 'Mute User'}
              </button>

              <button
                onClick={handleToggleBlock}
                className={`p-2 rounded-2xl border flex items-center justify-center gap-1.5 font-bold transition ${
                  isBlocked
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                {isBlocked ? 'Blocked' : 'Block User'}
              </button>
            </div>
          )}
        </div>

        {/* Status / Updates Feed Section */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isOwnProfile ? 'Your Active Stories & Updates' : `${targetUser.displayName}'s Updates`}
            </h3>
            <span className="text-[11px] text-slate-400">{userStatuses.length} active</span>
          </div>

          {userStatuses.length > 0 ? (
            <div className="space-y-2">
              {userStatuses.map((status) => (
                <div
                  key={status.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                    {status.type === 'image' && status.content ? (
                      <img
                        src={status.content}
                        alt="Status"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      'GB'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 dark:text-slate-200 truncate font-medium">
                      {status.caption || status.content}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      Posted {new Date(status.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {status.viewers?.length || 0} views
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-400 shadow-sm">
              No recent updates posted
            </div>
          )}
        </div>
      </div>

      {/* Followers / Following List Modal */}
      {listModalType && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {listModalType === 'followers' ? 'Followers' : 'Following'} ({userList.length})
              </h3>
              <button
                onClick={() => setListModalType(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto flex-1">
              {loadingList ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading connections...</div>
              ) : userList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No users found</div>
              ) : (
                userList.map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {u.displayName}
                          </span>
                          {u.isVerified && <UserCheck className="w-3 h-3 text-cyan-500" />}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
