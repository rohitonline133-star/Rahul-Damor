import React, { useState } from 'react';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall, Plus } from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { CallRecord } from '../../types';

export const CallsTab: React.FC = () => {
  const { callHistory, initiateCall } = useCall();
  const { allUsers, currentUser } = useAuth();
  const [showContactPicker, setShowContactPicker] = useState(false);

  const availableContacts = allUsers.filter((u) => u.id !== currentUser?.id);

  const formatDuration = (sec?: number) => {
    if (!sec) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-500" />
            GB Calls
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Voice and video calling
          </p>
        </div>

        <button
          onClick={() => setShowContactPicker(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Start Call
        </button>
      </div>

      {/* Recent Calls Log */}
      <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
        {callHistory.map((call) => {
          const isCaller = call.callerId === currentUser?.id;
          const contactName = isCaller ? call.receiverName : call.callerName;
          const contactAvatar = isCaller ? call.receiverAvatar : call.callerAvatar;
          const targetId = isCaller ? call.receiverId : call.callerId;
          const isMissed = call.status === 'missed' || call.status === 'declined';

          return (
            <div
              key={call.id}
              className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={contactAvatar}
                  alt={contactName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                />

                <div className="truncate">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {contactName}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {isCaller ? (
                      <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-500" />
                    ) : isMissed ? (
                      <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <PhoneIncoming className="w-3.5 h-3.5 text-cyan-500" />
                    )}

                    <span>{formatTime(call.startedAt)}</span>
                    {call.durationSeconds && (
                      <span className="font-mono text-[11px] text-slate-400">
                        • {formatDuration(call.durationSeconds)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Call Back Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => initiateCall(targetId, 'voice')}
                  className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 transition"
                  title="Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => initiateCall(targetId, 'video')}
                  className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 transition"
                  title="Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {callHistory.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">
            No call history. Tap "Start Call" to place your first voice or video call.
          </div>
        )}
      </div>

      {/* Start Call Contact Picker Modal */}
      {showContactPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Select Contact to Call
              </h4>
              <button
                onClick={() => setShowContactPicker(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={contact.avatar}
                      alt={contact.displayName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {contact.displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setShowContactPicker(false);
                        initiateCall(contact.id, 'voice');
                      }}
                      className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition"
                      title="Voice"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowContactPicker(false);
                        initiateCall(contact.id, 'video');
                      }}
                      className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500 hover:text-white transition"
                      title="Video"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
