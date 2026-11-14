import React, { useEffect, useState } from 'react';
import { Users2, Megaphone, Plus, ChevronRight, ShieldCheck, MessageSquare, Globe } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Community } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface CommunitiesTabProps {
  onOpenCreateCommunity: () => void;
  onOpenGroup: (groupId: string) => void;
}

export const CommunitiesTab: React.FC<CommunitiesTabProps> = ({
  onOpenCreateCommunity,
  onOpenGroup,
}) => {
  const { communities, joinCommunity, postAnnouncement, refreshCommunities } = useChat();
  const { token } = useAuth();
  const [communityGroups, setCommunityGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');

  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceContent, setAnnounceContent] = useState('');

  const activeComm = communities.find((community) => community.id === selectedCommunityId) || communities[0] || null;
  const isMember = Boolean(activeComm?.isMember);
  const isAdmin = Boolean(activeComm?.isAdmin);

  const loadCommunityGroups = async (communityId: string) => {
    if (!token) return;
    setGroupsLoading(true);
    setGroupsError('');
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(communityId)}/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load community groups.');
      setCommunityGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (error) {
      setGroupsError(error instanceof Error ? error.message : 'Could not load community groups.');
      setCommunityGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (activeComm?.id) void loadCommunityGroups(activeComm.id);
    else setCommunityGroups([]);
  }, [activeComm?.id, token]);

  const handleJoinGroup = async (groupId: string) => {
    if (!activeComm || !token) return;
    setGroupsError('');
    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(activeComm.id)}/groups/${encodeURIComponent(groupId)}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not join this group.');
      await loadCommunityGroups(activeComm.id);
    } catch (error) {
      setGroupsError(error instanceof Error ? error.message : 'Could not join this group.');
    }
  };

  const handleJoinCommunity = async () => {
    if (!activeComm) return;
    await joinCommunity(activeComm.id);
    await refreshCommunities();
    await loadCommunityGroups(activeComm.id);
  };

  const handlePostAnnouncement = async () => {
    if (!activeComm || !announceContent.trim()) return;
    await postAnnouncement(
      activeComm.id,
      announceTitle.trim() || 'Announcement',
      announceContent.trim()
    );
    setAnnounceTitle('');
    setAnnounceContent('');
    setShowAnnounceModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 space-y-4">
      {/* Community Selector Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            GB Communities
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connect topics, announcement feeds, and sub-groups
          </p>
          {communities.length > 1 && (
            <select
              aria-label="Select community"
              value={activeComm?.id || ''}
              onChange={(event) => setSelectedCommunityId(event.target.value)}
              className="mt-2 max-w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
            >
              {communities.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={onOpenCreateCommunity}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> New Community
        </button>
      </div>

      {/* Community Card */}
      {activeComm ? (
        <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={activeComm.icon}
                alt={activeComm.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <div className="truncate">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {activeComm.name}
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {activeComm.memberCount} members • {communityGroups.length} linked groups
                </span>
              </div>
            </div>

            {!isMember ? (
              <button
                onClick={handleJoinCommunity}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition shrink-0"
              >
                Join
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 shrink-0 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Member
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeComm.description}
          </p>

          {/* Announcements Feed */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-cyan-500" />
                Announcements Board
              </span>

              {isAdmin && (
                <button
                  onClick={() => setShowAnnounceModal(true)}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  + Post Update
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeComm.announcements?.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {ann.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ann.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{ann.content}</p>
                  <div className="mt-1 text-[10px] text-slate-400 italic">By {ann.authorName}</div>
                </div>
              ))}

              {(!activeComm.announcements || activeComm.announcements.length === 0) && (
                <div className="text-xs text-slate-400 py-3 text-center">No announcements yet</div>
              )}
            </div>
          </div>

          {/* Linked Groups in Community */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-2">
              Community Groups
            </span>

            <div className="space-y-1.5">
              {groupsLoading && <div className="text-xs text-slate-400 py-2">Loading linked groups…</div>}
              {groupsError && <div role="alert" className="text-xs text-red-600 dark:text-red-400 py-2">{groupsError}</div>}
              {communityGroups.map((grp) => (
                <div key={grp.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={grp.icon || ''} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-xl object-cover bg-slate-100 dark:bg-slate-800" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{grp.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{grp.memberCount} members</div>
                    </div>
                  </div>
                  {grp.isMember ? (
                    <button type="button" onClick={() => onOpenGroup(grp.id)} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold">
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button type="button" disabled={!isMember} onClick={() => handleJoinGroup(grp.id)} className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">
                      Join group
                    </button>
                  )}
                </div>
              ))}

              {!groupsLoading && communityGroups.length === 0 && (
                <div className="text-xs text-slate-400 py-2">
                  No linked groups yet. Community admins can create a group and link it to this community.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <Users2 className="w-12 h-12 mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-semibold">No communities yet</p>
          <button
            onClick={onOpenCreateCommunity}
            className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
          >
            Create First Community
          </button>
        </div>
      )}

      {/* Post Announcement Modal */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Post Community Announcement
            </h4>
            <input
              type="text"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Announcement Title"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <textarea
              value={announceContent}
              onChange={(e) => setAnnounceContent(e.target.value)}
              placeholder="Write announcement for all community members..."
              className="w-full h-24 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handlePostAnnouncement}
                disabled={!announceContent.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
