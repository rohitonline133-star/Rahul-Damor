# GB Official — Messaging Feature-Parity Baseline

## Product rule
GB Official is an independently branded app. Implement familiar messaging capabilities and user-facing workflows without copying GB WhatsApp/WhatsApp logos, proprietary assets, source code, or claiming affiliation. Keep GB Official accounts/data isolated from Opexnal. Opex AI may be a shared service, but authorization, conversation ownership, and app data boundaries must remain explicit.

## Architecture rule
Use one cohesive system: React UI -> typed client/service layer -> authenticated Express API -> persistent database -> realtime event delivery. Settings must be persisted server-side where account-level, validated on the server, and reflected consistently across devices. Local-only preferences must be clearly identified. Never mark a UI-only toggle as implemented backend functionality.

## Feature inventory and acceptance checklist

### 1. Account, identity and onboarding
- [ ] Phone/email registration, country selector, username availability, profile setup
- [ ] Login by phone/email/username; logout; session expiry and revocation
- [ ] OTP delivery provider integration, resend limits, abuse throttling
- [ ] Password reset/recovery with verified channel
- [ ] Optional passkeys/OAuth only after provider configuration and verification
- [ ] Profile name, username, photo, about, links and profile visibility
- [ ] Account export, deactivation, deletion and recovery policy

### 2. Chats and messages
- [ ] One-to-one and group conversations; archive, pin, mute and mark unread
- [ ] Text, emoji, stickers, GIF, image, video, document, contact and location messages
- [ ] Voice notes with recording, playback, waveform, speed and upload progress
- [ ] Reply/quote, forward, edit, delete-for-me, delete-for-everyone with clear policy
- [ ] Reactions, mentions, link previews, copy, select, search and starred messages
- [ ] Delivery/read receipts, sent/delivered/read timestamps and typing indicators
- [ ] Draft persistence, offline queue, retry, upload cancellation and pagination
- [ ] Message permissions, block/report flows, spam controls and retention policy
- [ ] Multi-device synchronization and conflict handling

### 3. Groups and communities
- [ ] Create, rename, description, icon, invite link and QR invite
- [ ] Add/remove members, join requests, member list and role management
- [ ] Admin/moderator permissions, announcement-only mode and slow mode
- [ ] Group info, media/documents/links tabs, search and pinned messages
- [ ] Community creation, linked groups, announcement group and member controls
- [ ] Invite revocation, member reports, moderation audit trail

### 4. Status / stories
- [ ] Text, photo and video status creation, editing and deletion
- [ ] Audience controls: contacts, selected contacts, exclude contacts
- [ ] Viewers list, reactions/replies, mute/hide and status privacy
- [ ] Expiry, upload progress, playback controls and media compression
- [ ] Reshare/forward permissions and reporting

### 5. Channels and broadcasts
- [ ] Public/private channels, discovery, follow/unfollow and channel profile
- [ ] Admin roles, post publishing, media, reactions and view counts
- [ ] Broadcast lists, recipient management and delivery status
- [ ] Channel/broadcast notification preferences and moderation

### 6. Voice and video calls
- [ ] One-to-one voice/video call signaling and real WebRTC media transport
- [ ] Incoming call UI, accept/decline, missed calls and call history
- [ ] Mute, camera toggle, speaker, device selection and call quality state
- [ ] Group calls, participant management and network recovery
- [ ] Permission handling, TURN/STUN configuration and abuse reporting
- [ ] Verify actual device-to-device calls; call records alone do not count

### 7. Privacy and safety
- [ ] Last seen, online, profile photo, about and status audience controls
- [ ] Read receipts, typing/recording indicators and group-add permissions
- [ ] Block/unblock, muted chats, hidden/locked chats and app lock
- [ ] Disappearing messages and default message timer
- [ ] Unknown sender controls, group invite controls and link safety
- [ ] Report user/message/group/channel with moderation workflow
- [ ] Privacy dashboard and clear explanation of what other users can see

### 8. Security and devices
- [ ] Strong password hashing (Argon2id or scrypt with reviewed parameters)
- [ ] Secure, rotated sessions; device list, rename, revoke and logout-all
- [ ] Optional TOTP/passkey 2FA and recovery codes
- [ ] Rate limits, CSRF/CORS policy, input validation and upload scanning
- [ ] TLS-only deployment, secrets management and security event audit
- [ ] Database authorization/ownership checks on every private resource
- [ ] End-to-end encryption only with a reviewed protocol/library and key lifecycle
- [ ] Independent security review; never advertise encryption before verification

### 9. Backup, storage and data controls
- [ ] Storage usage by media category and cache controls
- [ ] Local/cloud backup with real provider, encryption and restore validation
- [ ] Backup schedule, network/battery preferences and backup status
- [ ] Export personal data and delete account/data according to policy
- [ ] Media auto-download preferences and upload limits

### 10. Notifications
- [ ] Per-chat mute, custom tone and notification preview settings
- [ ] Message, group, status, channel and call notifications
- [ ] Push provider integration, token lifecycle and delivery diagnostics
- [ ] Quiet hours, in-app notification center and read/clear controls

### 11. Appearance and accessibility
- [ ] GB Official light/dark themes, chat wallpaper and per-chat theme
- [ ] Font size, density, bubble shape, contrast and reduced motion
- [ ] Reference-inspired black/red background, white incoming and pink outgoing bubbles
- [ ] Reference-inspired in-app keyboard with functional key handling and accessibility
- [ ] Screen-reader labels, focus order, keyboard navigation and dynamic text sizing
- [ ] Clearly separate app-rendered keyboard from the Android system keyboard

### 12. Search, links and utilities
- [ ] Global search across people, chats, messages and channels
- [ ] In-chat search, date filters and media/document/link search
- [ ] Contact sync with explicit permission and contact privacy
- [ ] Location sharing with duration and stop-sharing controls
- [ ] QR profile, invite links, deep links and link safety warnings

### 13. Payments, shop and subscriptions
- [ ] Payment provider integration, server-side verification and webhook validation
- [ ] Orders, refunds, transaction history and receipts
- [ ] Subscription lifecycle, cancellation, renewal and entitlement checks
- [ ] Shop inventory, cart, checkout and order status
- [ ] Sandbox and production environments clearly separated

### 14. Opex AI
- [ ] Dedicated Opex AI entry and chat in GB Official
- [ ] In-chat invoke/share flow with explicit user action
- [ ] AI drafting, summaries and Q&A with user-controlled context
- [ ] Shared Opex AI service with strict app/account data isolation
- [ ] Consent, privacy controls, rate limits and clear AI identity

### 15. Help, moderation and administration
- [ ] Help center, FAQ, contact support and issue reporting
- [ ] Safety/copyright complaint and appeal workflows
- [ ] Admin roles, least privilege, audit log and abuse queue
- [ ] User-facing account/security activity notices
- [ ] Policy, privacy notice, terms and data-retention disclosures

## Verification gates
- [ ] TypeScript check
- [ ] Production frontend and server build
- [ ] Automated API, authorization and regression tests
- [ ] Database migration and backup/restore tests
- [ ] Multi-user realtime tests
- [ ] Real Android browser/device testing for keyboard, media and permissions
- [ ] Real device-to-device WebRTC call test
- [ ] Production provider configuration and webhook tests
- [ ] Security review and deployment smoke tests

## Current known baseline
This checklist is an implementation and verification inventory, not a claim that every item is already implemented. Existing screens, routes, JSON-backed storage, or demo/self-tests do not prove production readiness. Each item must be marked complete only after its backend behavior and relevant acceptance test are verified.
