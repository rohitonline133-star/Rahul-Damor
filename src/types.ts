export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document';
export type ConversationType = 'direct' | 'group';
export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'ongoing' | 'completed' | 'declined' | 'missed';
export type ReportCategory = 'spam' | 'harassment' | 'impersonation' | 'copyright' | 'illegal' | 'other';
export type PrivacyOption = 'everyone' | 'contacts' | 'nobody';

export interface UserPrivacySettings {
  lastSeen: PrivacyOption;
  profilePhoto: PrivacyOption;
  statusPrivacy: 'everyone' | 'contacts' | 'selected';
  readReceipts: boolean;
  isPrivate?: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  avatar: string;
  coverImage?: string;
  bio?: string;
  website?: string;
  online: boolean;
  lastSeen: number;
  createdAt: number;
  isVerified?: boolean;
  isBanned?: boolean;
  isPrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  privacySettings: UserPrivacySettings;
  blockedUserIds: string[];
  mutedUserIds?: string[];
  restrictedUserIds?: string[];
  role?: 'user' | 'admin' | 'moderator';
}

export type UserProfile = User;
export type Report = ReportItem;

export interface SearchResults {
  users: User[];
  conversations: Conversation[];
  messages: Message[];
}

export interface TestItem {
  name: string;
  status: 'PASS' | 'FAIL' | 'NOT TESTED';
  details: string;
  durationMs?: number;
}

export interface TestReport {
  total: number;
  passed: number;
  failed: number;
  notTested: number;
  timestamp: number;
  tests: TestItem[];
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface MessageAttachment {
  name: string;
  size: number;
  mimeType: string;
  url: string;
  duration?: number; // for audio/video in seconds
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  type: MessageType;
  attachment?: MessageAttachment;
  replyToId?: string;
  replyToMessage?: {
    id: string;
    senderName: string;
    text: string;
    type: MessageType;
  };
  reactions: MessageReaction[];
  status: MessageStatus;
  readBy: { userId: string; readAt: number }[];
  isPinned?: boolean;
  isStarred?: boolean;
  isEdited?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface ConversationMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: number;
  isMuted?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string; // For groups
  icon?: string; // For groups
  description?: string;
  creatorId?: string;
  communityId?: string;
  members: ConversationMember[];
  memberDetails?: User[];
  lastMessage?: Message;
  lastMessageTime?: number;
  pinnedForUserIds: string[];
  unreadCount?: number;
  createdAt: number;
}

export interface StatusViewer {
  userId: string;
  userName: string;
  userAvatar: string;
  viewedAt: number;
}

export interface UserStatus {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'text' | 'image' | 'video';
  content: string; // text or media URL
  caption?: string;
  backgroundColor?: string;
  viewers: StatusViewer[];
  createdAt: number;
  expiresAt: number;
  privacy: 'everyone' | 'contacts' | 'selected';
}

export interface CommunityAnnouncement {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  icon: string;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  groupIds: string[];
  announcements: CommunityAnnouncement[];
  createdAt: number;
}

export interface CallRecord {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  conversationId?: string;
  type: CallType;
  status: CallStatus;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'message' | 'group' | 'status' | 'media';
  targetId: string;
  targetContentPreview?: string;
  category: ReportCategory;
  description: string;
  status: 'pending' | 'reviewed' | 'action_taken' | 'dismissed';
  actionNote?: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'message' | 'call' | 'group' | 'status' | 'community' | 'system';
  targetId?: string;
  isRead: boolean;
  createdAt: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  wallpaper: string;
  fontSize: 'small' | 'medium' | 'large';
  notificationsSound: boolean;
  vibration: boolean;
  showPreview: boolean;
  appLockEnabled: boolean;
  pinCode?: string;
}

export interface PostPollOption {
  id: string;
  text: string;
  votes: string[]; // userIds
}

export interface PostPoll {
  question: string;
  options: PostPollOption[];
  totalVotes: number;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorVerified?: boolean;
  text: string;
  createdAt: number;
}

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorVerified?: boolean;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  tags?: string[];
  poll?: PostPoll;
  likes: string[]; // userIds
  comments: PostComment[];
  sharesCount: number;
  savedByUserIds: string[];
  createdAt: number;
}

export interface ChannelPost {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  poll?: PostPoll;
  reactions: { emoji: string; count: number; users: string[] }[];
  viewsCount: number;
  isPinned?: boolean;
  createdAt: number;
}

export interface Channel {
  id: string;
  name: string;
  username: string;
  description: string;
  icon: string;
  banner?: string;
  ownerId: string;
  moderatorIds: string[];
  subscriberIds: string[];
  isVerified?: boolean;
  category: string;
  posts: ChannelPost[];
  createdAt: number;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  fullName: string;
  category: string;
  documentType: string;
  businessOrIdentityInfo: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterUsername: string;
  requesterAvatar: string;
  targetUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

