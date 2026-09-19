import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider } from './context/CallContext';
import { AndroidFrame } from './components/common/AndroidFrame';
import { TopAppBar } from './components/home/TopAppBar';
import { StatusStoriesRow } from './components/home/StatusStoriesRow';
import { SegmentedTabSwitcher } from './components/home/SegmentedTabSwitcher';
import { BottomNav } from './components/home/BottomNav';
import { ChatList } from './components/chat/ChatList';
import { ChatRoom } from './components/chat/ChatRoom';
import { CommunitiesTab } from './components/community/CommunitiesTab';
import { CallsTab } from './components/call/CallsTab';
import { StatusViewerModal } from './components/status/StatusViewerModal';
import { CreateStatusModal } from './components/status/CreateStatusModal';
import { CreateGroupModal } from './components/group/CreateGroupModal';
import { CreateCommunityModal } from './components/community/CreateCommunityModal';
import { NewChatModal } from './components/chat/NewChatModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { TestSuiteModal } from './components/test/TestSuiteModal';
import { SearchOverlay } from './components/search/SearchOverlay';
import { AdminModerationModal } from './components/admin/AdminModerationModal';
import { AuthModal } from './components/auth/AuthModal';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { ReportModal } from './components/report/ReportModal';
import { ActiveCallOverlay } from './components/call/ActiveCallOverlay';
import { ShopModal } from './components/shop/ShopModal';
import { LinkedDevicesModal } from './components/devices/LinkedDevicesModal';
import { BroadcastModal } from './components/broadcast/BroadcastModal';
import { ProfileTab } from './components/profile/ProfileTab';
import { CreateChannelModal } from './components/common/CreateChannelModal';
import { CreatePostModal } from './components/common/CreatePostModal';
import { CreatePollModal } from './components/common/CreatePollModal';
import { CreateShopItemModal } from './components/common/CreateShopItemModal';
import { UserStatus, Message } from './types';
import { Sparkles, Shield, Lock, CircleDot, Plus } from 'lucide-react';

const GbMainApp: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const {
    activeTab,
    setActiveTab,
    activeConversationId,
    setActiveConversationId,
    statuses,
    conversations,
    createDirectChat,
  } = useChat();

  // Modals state
  const [viewingStatus, setViewingStatus] = useState<UserStatus | null>(null);
  const [showCreateStatus, setShowCreateStatus] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTests, setShowTests] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showLinkedDevices, setShowLinkedDevices] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [showCreateShopItem, setShowCreateShopItem] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [reportingTarget, setReportingTarget] = useState<{ id: string; type: 'user' | 'message' } | null>(null);

  const myStatus = statuses.find((s) => s.userId === currentUser?.id);
  const contactStatuses = statuses.filter((s) => s.userId !== currentUser?.id);

  return (
    <AndroidFrame>
      {/* 1. If currently inside a chat room */}
      {activeConversationId ? (
        <ChatRoom
          onBack={() => setActiveConversationId(null)}
          onOpenProfile={(uid) => setViewingUserId(uid)}
          onOpenReport={(msg: Message) => setReportingTarget({ id: msg.id, type: 'message' })}
        />
      ) : (
        /* 2. Main Navigation Dashboard */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900 select-none">
          {/* Top Bar */}
          <TopAppBar
            onOpenSearch={() => setShowSearch(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenTests={() => setShowTests(true)}
            onOpenAdmin={() => setShowAdmin(true)}
            onOpenAuth={() => setShowAuth(true)}
            onOpenCamera={() => setShowCreateStatus(true)}
            onOpenShop={() => setShowShop(true)}
            onOpenLinkedDevices={() => setShowLinkedDevices(true)}
            onOpenBroadcasts={() => setShowBroadcast(true)}
          />

          {/* Body based on activeTab */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* CHATS & COMMUNITIES MAIN TABS */}
            {(activeTab === 'chats' || activeTab === 'communities') && (
              <>
                {/* Horizontal Story / Status Carousel */}
                <StatusStoriesRow
                  onOpenCreateStatus={() => setShowCreateStatus(true)}
                  onSelectStatus={(status) => setViewingStatus(status)}
                />

                {/* Rounded Segmented Control: Chats | Communities */}
                <SegmentedTabSwitcher
                  activeSegment={activeTab === 'communities' ? 'communities' : 'chats'}
                  onSelectSegment={(segment) => setActiveTab(segment)}
                  unreadChatsCount={conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                />

                {/* Primary Content: Chat List or Communities View */}
                {activeTab === 'chats' ? (
                  <ChatList
                    onSelectConversation={(convId) => setActiveConversationId(convId)}
                    onOpenNewChat={() => setShowNewChat(true)}
                  />
                ) : (
                  <CommunitiesTab
                    onOpenCreateCommunity={() => setShowCreateCommunity(true)}
                    onOpenGroup={(groupId) => setActiveConversationId(groupId)}
                  />
                )}
              </>
            )}

            {/* STATUS TAB */}
            {activeTab === 'status' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CircleDot className="w-5 h-5 text-emerald-500" />
                      Status Updates
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Disappears automatically after 24 hours
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateStatus(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Add Status
                  </button>
                </div>

                {/* My Status Card */}
                <div className="bg-white dark:bg-slate-850 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div
                    onClick={() => {
                      if (myStatus) setViewingStatus(myStatus);
                      else setShowCreateStatus(true);
                    }}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <div className="relative">
                      <img
                        src={currentUser?.avatar}
                        alt="My Status"
                        referrerPolicy="no-referrer"
                        className={`w-12 h-12 rounded-full object-cover p-0.5 ${
                          myStatus
                            ? 'ring-2 ring-emerald-500'
                            : 'border-2 border-dashed border-slate-300 dark:border-slate-700'
                        }`}
                      />
                      {!myStatus && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                          +
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        My Status
                      </div>
                      <div className="text-xs text-slate-400">
                        {myStatus
                          ? `Posted • ${myStatus.viewers?.length || 0} views`
                          : 'Tap to add status update'}
                      </div>
                    </div>
                  </div>

                  {myStatus && (
                    <button
                      onClick={() => setViewingStatus(myStatus)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold"
                    >
                      View
                    </button>
                  )}
                </div>

                {/* Recent Updates */}
                <div>
                  <span className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wider">
                    Recent Updates ({contactStatuses.length})
                  </span>

                  <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
                    {contactStatuses.map((status) => {
                      const isViewed = status.viewers?.some((v) => v.userId === currentUser?.id);

                      return (
                        <div
                          key={status.id}
                          onClick={() => setViewingStatus(status)}
                          className="p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <div
                            className={`w-12 h-12 rounded-full p-[2px] ${
                              isViewed
                                ? 'border-2 border-slate-300 dark:border-slate-700'
                                : 'bg-gradient-to-tr from-emerald-500 to-cyan-400 shadow-sm'
                            }`}
                          >
                            <img
                              src={status.userAvatar}
                              alt={status.userName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full rounded-full object-cover bg-white dark:bg-slate-900"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {status.userName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {new Date(status.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {contactStatuses.length === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No recent updates from contacts
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CALLS TAB */}
            {activeTab === 'calls' && <CallsTab />}

            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <ProfileTab
                viewingUserId={currentUser?.id}
                onOpenSettings={() => setShowSettings(true)}
                onOpenChatWith={async (userId) => {
                  const convId = await createDirectChat(userId);
                  if (convId) setActiveConversationId(convId);
                }}
                onOpenReport={(targetId, type) => setReportingTarget({ id: targetId, type })}
              />
            )}
          </div>

          {/* Bottom Bar + Action FAB */}
          <BottomNav
            onOpenNewChat={() => setShowNewChat(true)}
            onOpenCreateGroup={() => setShowCreateGroup(true)}
            onOpenCreateCommunity={() => setShowCreateCommunity(true)}
            onOpenCreateChannel={() => setShowCreateChannel(true)}
            onOpenCreateStatus={() => setShowCreateStatus(true)}
            onOpenCreatePost={() => setShowCreatePost(true)}
            onOpenCreatePoll={() => setShowCreatePoll(true)}
            onOpenCreateShopItem={() => setShowCreateShopItem(true)}
            onUploadPhoto={() => setShowCreateStatus(true)}
            onUploadVideo={() => setShowCreateStatus(true)}
            onOpenBroadcast={() => setShowBroadcast(true)}
          />
        </div>
      )}

      {/* 3. Global Real-Time Call Overlay (Ringing / Video stream / Audio call) */}
      <ActiveCallOverlay />

      {/* 4. Modals */}
      {viewingStatus && (
        <StatusViewerModal
          status={viewingStatus}
          onClose={() => setViewingStatus(null)}
        />
      )}

      {showCreateStatus && (
        <CreateStatusModal onClose={() => setShowCreateStatus(false)} />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(convId) => setActiveConversationId(convId)}
        />
      )}

      {showCreateCommunity && (
        <CreateCommunityModal onClose={() => setShowCreateCommunity(false)} />
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelectConversation={(convId) => setActiveConversationId(convId)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={() => {
            logout();
            setShowAuth(true);
          }}
          onOpenLinkedDevices={() => setShowLinkedDevices(true)}
          onOpenShop={() => setShowShop(true)}
        />
      )}

      {showTests && <TestSuiteModal onClose={() => setShowTests(false)} />}

      {showSearch && (
        <SearchOverlay
          onClose={() => setShowSearch(false)}
          onSelectConversation={(convId) => setActiveConversationId(convId)}
          onSelectUser={async (userId) => {
            const convId = await createDirectChat(userId);
            if (convId) setActiveConversationId(convId);
          }}
        />
      )}

      {showAdmin && <AdminModerationModal onClose={() => setShowAdmin(false)} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {showShop && <ShopModal onClose={() => setShowShop(false)} />}

      {showLinkedDevices && (
        <LinkedDevicesModal onClose={() => setShowLinkedDevices(false)} />
      )}

      {showBroadcast && (
        <BroadcastModal onClose={() => setShowBroadcast(false)} />
      )}

      {viewingUserId && (
        <UserProfileModal
          userId={viewingUserId}
          onClose={() => setViewingUserId(null)}
          onOpenReport={(uid) => setReportingTarget({ id: uid, type: 'user' })}
        />
      )}

      {reportingTarget && (
        <ReportModal
          targetId={reportingTarget.id}
          targetType={reportingTarget.type}
          onClose={() => setReportingTarget(null)}
        />
      )}

      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onChannelCreated={() => setActiveTab('communities')}
        />
      )}

      {showCreatePost && (
        <CreatePostModal onClose={() => setShowCreatePost(false)} />
      )}

      {showCreatePoll && (
        <CreatePollModal onClose={() => setShowCreatePoll(false)} />
      )}

      {showCreateShopItem && (
        <CreateShopItemModal
          onClose={() => setShowCreateShopItem(false)}
          onItemCreated={() => setShowShop(true)}
        />
      )}
    </AndroidFrame>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <GbMainApp />
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
