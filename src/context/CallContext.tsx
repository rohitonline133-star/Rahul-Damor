import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CallRecord, CallType } from '../types';
import { useAuth } from './AuthContext';
import { sounds } from '../utils/sound';

interface CallContextType {
  activeCall: CallRecord | null;
  incomingCall: CallRecord | null;
  callHistory: CallRecord[];
  initiateCall: (receiverId: string, type: CallType, conversationId?: string) => Promise<boolean>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endActiveCall: () => Promise<void>;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoEnabled: boolean;
  toggleVideo: () => void;
  isSpeakerOn: boolean;
  toggleSpeaker: () => void;
  callDuration: number;
  localStream: MediaStream | null;
  refreshCallHistory: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, token } = useAuth();
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallRecord | null>(null);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const ringStopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);

  const refreshCallHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/calls', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCallHistory(data.calls || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshCallHistory();
    }
  }, [currentUser]);

  // Authenticate the call event stream with a short-lived, single-use ticket.
  useEffect(() => {
    if (!currentUser || !token) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let isDisposed = false;

    const connectSSE = async () => {
      try {
        const ticketResponse = await fetch('/api/events/ticket', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!ticketResponse.ok) throw new Error('Could not authenticate call event stream');
        const ticketData = await ticketResponse.json();
        if (isDisposed || typeof ticketData.ticket !== 'string') return;

        const source = new EventSource(`/api/events?ticket=${encodeURIComponent(ticketData.ticket)}`);
        eventSource = source;

        source.addEventListener('incoming_call', (e) => {
          try {
            const call: CallRecord = JSON.parse(e.data);
            if (call.receiverId === currentUser.id && call.status === 'ringing') {
              setIncomingCall(call);
              ringStopRef.current?.();
              ringStopRef.current = sounds.playRingtone();
            }
          } catch {
            // ignore malformed events
          }
        });

        source.addEventListener('call_status_updated', (e) => {
          try {
            const updated: CallRecord = JSON.parse(e.data);
            if (updated.status === 'ongoing') {
              ringStopRef.current?.();
              setActiveCall(updated);
              setIncomingCall(null);
            } else if (['completed', 'declined', 'missed'].includes(updated.status)) {
              ringStopRef.current?.();
              setActiveCall(null);
              setIncomingCall(null);
              refreshCallHistory();
            }
          } catch {
            // ignore malformed events
          }
        });

        source.onerror = () => {
          source.close();
          if (eventSource === source) eventSource = null;
          if (!isDisposed) reconnectTimeout = window.setTimeout(() => { void connectSSE(); }, 3000);
        };
      } catch {
        if (!isDisposed) reconnectTimeout = window.setTimeout(() => { void connectSSE(); }, 3000);
      }
    };

    void connectSSE();

    return () => {
      isDisposed = true;
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ringStopRef.current?.();
    };
  }, [currentUser, token]);

  // Call duration timer
  useEffect(() => {
    if (activeCall && activeCall.status === 'ongoing') {
      setCallDuration(0);
      timerRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall]);

  const initiateMediaStream = async (type: CallType) => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === 'video',
        });
        setLocalStream(stream);
        return stream;
      }
    } catch {
      console.log('Media device permission not granted or available, using virtual stream.');
    }
    return null;
  };

  const stopMediaStream = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
  };

  const initiateCall = async (
    receiverId: string,
    type: CallType,
    conversationId?: string
  ): Promise<boolean> => {
    if (!token || !currentUser) return false;

    try {
      await initiateMediaStream(type);
      ringStopRef.current?.();
      ringStopRef.current = sounds.playRingtone();

      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiverId, type, conversationId }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.call);
        return true;
      }
      return false;
    } catch {
      ringStopRef.current?.();
      return false;
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !token) return;
    ringStopRef.current?.();

    await initiateMediaStream(incomingCall.type);

    try {
      const res = await fetch(`/api/calls/${incomingCall.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'ongoing' }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.call);
        setIncomingCall(null);
      }
    } catch {
      // ignore
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall || !token) return;
    ringStopRef.current?.();

    try {
      await fetch(`/api/calls/${incomingCall.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'declined' }),
      });
      setIncomingCall(null);
      refreshCallHistory();
    } catch {
      // ignore
    }
  };

  const endActiveCall = async () => {
    ringStopRef.current?.();
    stopMediaStream();

    if (!activeCall || !token) {
      setActiveCall(null);
      return;
    }

    try {
      await fetch(`/api/calls/${activeCall.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'completed',
          durationSeconds: callDuration,
        }),
      });
      setActiveCall(null);
      refreshCallHistory();
    } catch {
      setActiveCall(null);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        callHistory,
        initiateCall,
        acceptIncomingCall,
        declineIncomingCall,
        endActiveCall,
        isMuted,
        toggleMute,
        isVideoEnabled,
        toggleVideo,
        isSpeakerOn,
        toggleSpeaker,
        callDuration,
        localStream,
        refreshCallHistory,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
