import React, { useMemo, useState } from 'react';
import { X, Users, UserPlus, Shield, Link2, LogOut, Trash2, Save, Copy } from 'lucide-react';
import { Conversation } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface GroupSettingsModalProps {
  conversation: Conversation;
  currentUserId: string;
  token: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  conversation, currentUserId, token, onClose, onUpdated,
}) => {
  const { allUsers } = useAuth();
  const currentMembership = conversation.members.find((member) => member.userId === currentUserId);
  const isAdmin = currentMembership?.role === 'admin';
  const [name, setName] = useState(conversation.name || '');
  const [description, setDescription] = useState(conversation.description || '');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const availableUsers = useMemo(() => allUsers.filter((person) =>
    person.id !== currentUserId && !conversation.members.some((member) => member.userId === person.id)
  ), [allUsers, currentUserId, conversation.members]);

  const request = async (url: string, method: string, body?: unknown) => {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await action(); await onUpdated(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  const saveInfo = () => run(async () => {
    await request(`/api/conversations/${encodeURIComponent(conversation.id)}/group`, 'PATCH', { name, description });
    setNotice('Group information saved.');
  });

  const addMember = () => {
    if (!selectedUserId) return;
    run(async () => {
      await request(`/api/conversations/${encodeURIComponent(conversation.id)}/members`, 'POST', { userIds: [selectedUserId] });
      setSelectedUserId(''); setNotice('Member added.');
    });
  };

  const changeRole = (userId: string, role: 'admin' | 'member') => run(async () => {
    await request(`/api/conversations/${encodeURIComponent(conversation.id)}/admins/${encodeURIComponent(userId)}`, 'POST', { role });
    setNotice('Member role updated.');
  });

  const removeMember = (userId: string) => run(async () => {
    await request(`/api/conversations/${encodeURIComponent(conversation.id)}/members/${encodeURIComponent(userId)}`, 'DELETE');
    setNotice('Member removed.');
  });

  const createInvite = () => run(async () => {
    const data = await request(`/api/conversations/${encodeURIComponent(conversation.id)}/invite`, 'POST');
    setInviteCode(data.inviteCode || '');
    setNotice('Invite link created.');
  });

  const disableInvite = () => run(async () => {
    await request(`/api/conversations/${encodeURIComponent(conversation.id)}/invite`, 'DELETE');
    setInviteCode(''); setNotice('Invite link disabled.');
  });

  const leaveGroup = () => run(async () => {
    await request(`/api/conversations/${encodeURIComponent(conversation.id)}/leave`, 'POST');
    onClose(); await onUpdated();
  });

  const inviteUrl = inviteCode ? `${window.location.origin}/join-group/${encodeURIComponent(inviteCode)}` : '';

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
      <section role="dialog" aria-modal="true" aria-label="Group info and settings" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100">
        <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-emerald-500" /><h2 className="font-bold">Group info & settings</h2></div>
          <button onClick={onClose} aria-label="Close group settings" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <img src={conversation.icon || ''} alt="" className="w-14 h-14 rounded-full object-cover bg-slate-100 dark:bg-slate-800" />
            <div><div className="font-bold">{conversation.name || 'Group chat'}</div><div className="text-xs text-slate-500">{conversation.members.length} members</div></div>
          </div>
          {isAdmin && <>
            <div className="space-y-2">
              <label className="block text-xs font-semibold">Group name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="w-full rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-sm" />
              <label className="block text-xs font-semibold">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} className="w-full rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-sm resize-none" />
              <button disabled={busy || !name.trim()} onClick={saveInfo} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Save group info</button>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
              <div className="text-sm font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add members</div>
              <div className="flex gap-2">
                <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="min-w-0 flex-1 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs">
                  <option value="">Choose a person</option>{availableUsers.map((person) => <option key={person.id} value={person.id}>{person.displayName} (@{person.username})</option>)}
                </select>
                <button disabled={busy || !selectedUserId} onClick={addMember} className="rounded-xl bg-emerald-600 text-white px-3 text-xs font-semibold disabled:opacity-50">Add</button>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
              <div className="text-sm font-bold flex items-center gap-2"><Link2 className="w-4 h-4" /> Invite link</div>
              {inviteCode ? <div className="flex gap-2"><input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-xl px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs" /><button onClick={() => navigator.clipboard?.writeText(inviteUrl).then(() => setNotice('Invite link copied.')).catch(() => setNotice('Could not copy the invite link.'))} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800" aria-label="Copy invite link"><Copy className="w-4 h-4" /></button><button disabled={busy} onClick={disableInvite} className="px-3 rounded-xl border text-xs">Disable</button></div>
                : <button disabled={busy} onClick={createInvite} className="rounded-xl border border-emerald-500/40 text-emerald-600 px-3 py-2 text-xs font-semibold">Create invite link</button>}
            </div>
          </>}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="font-bold text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Members</div>
            {conversation.members.map((member) => {
              const person = conversation.memberDetails?.find((item) => item.id === member.userId);
              const self = member.userId === currentUserId;
              return <div key={member.userId} className="flex items-center gap-2">
                <img src={person?.avatar || ''} alt="" className="w-9 h-9 rounded-full object-cover bg-slate-100 dark:bg-slate-800" />
                <div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{person?.displayName || member.userId}{self ? ' (You)' : ''}</div><div className="text-[10px] text-slate-500">@{person?.username || 'member'} · {member.role}</div></div>
                {isAdmin && !self && true && <div className="flex items-center gap-1">
                  <button disabled={busy} onClick={() => changeRole(member.userId, member.role === 'admin' ? 'member' : 'admin')} className="text-[10px] px-2 py-1 rounded-lg border">{member.role === 'admin' ? 'Make member' : 'Make admin'}</button>
                  <button disabled={busy} onClick={() => removeMember(member.userId)} aria-label="Remove member" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>}
              </div>;
            })}
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button disabled={busy} onClick={leaveGroup} className="inline-flex items-center gap-2 rounded-xl border border-red-300 text-red-600 px-3 py-2 text-xs font-semibold"><LogOut className="w-4 h-4" /> Leave group</button>
          </div>
          {notice && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{notice}</p>}
        </div>
      </section>
    </div>
  );
};
