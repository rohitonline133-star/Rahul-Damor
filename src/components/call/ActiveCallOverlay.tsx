import React, { useRef, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
} from 'lucide-react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';

export const ActiveCallOverlay: React.FC = () => {
  const {
    activeCall,
    incomingCall,
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
  } = useCall();
  const { currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to video tag
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  if (!activeCall && !incomingCall) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  /* 1. INCOMING CALL SCREEN */
  if (incomingCall) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-8 text-white animate-in fade-in duration-200">
        <div className="text-center pt-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            GB Encrypted {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
          </div>
          <h2 className="text-2xl font-bold">{incomingCall.callerName}</h2>
          <p className="text-sm text-slate-400">Incoming call...</p>
        </div>

        {/* Center Ringing Avatar with radar animation */}
        <div className="flex items-center justify-center relative">
          <div className="w-36 h-36 rounded-full bg-emerald-500/20 absolute animate-ping" />
          <div className="w-32 h-32 rounded-full bg-emerald-500/30 absolute" />
          <img
            src={incomingCall.callerAvatar}
            alt={incomingCall.callerName}
            referrerPolicy="no-referrer"
            className="w-28 h-28 rounded-full object-cover relative z-10 ring-4 ring-emerald-500 shadow-2xl"
          />
        </div>

        {/* Bottom Accept / Decline Buttons */}
        <div className="flex items-center justify-around pb-8 max-w-sm mx-auto w-full">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={declineIncomingCall}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-950/50 hover:scale-105 active:scale-95 transition"
              title="Decline"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-slate-400">Decline</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptIncomingCall}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-950/50 hover:scale-105 active:scale-95 transition animate-bounce"
              title="Accept"
            >
              <Phone className="w-7 h-7" />
            </button>
            <span className="text-xs text-emerald-400 font-semibold">Accept</span>
          </div>
        </div>
      </div>
    );
  }

  /* 2. ONGOING / OUTGOING CALL SCREEN */
  const isCaller = activeCall?.callerId === currentUser?.id;
  const partnerName = isCaller ? activeCall?.receiverName : activeCall?.callerName;
  const partnerAvatar = isCaller ? activeCall?.receiverAvatar : activeCall?.callerAvatar;
  const isVideo = activeCall?.type === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Video Feed Background if video call */}
      {isVideo && (
        <div className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center overflow-hidden">
          {localStream && isVideoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center">
                <VideoOff className="w-10 h-10 text-slate-600" />
              </div>
              <span className="text-xs">Camera is turned off</span>
            </div>
          )}
        </div>
      )}

      {/* Top Overlay Header */}
      <div className="relative z-20 pt-8 px-6 pb-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex flex-col items-center text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-emerald-400 text-[11px] font-semibold border border-white/10">
          <ShieldCheck className="w-3 h-3" />
          End-to-End Encrypted
        </div>
        <h2 className="text-xl font-bold">{partnerName}</h2>
        <div className="text-sm font-mono text-emerald-400 font-medium">
          {activeCall?.status === 'ringing' ? 'Calling...' : formatTimer(callDuration)}
        </div>
      </div>

      {/* Center Avatar for voice call */}
      {!isVideo && (
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 space-y-4">
          <div className="relative">
            <div className="w-36 h-36 rounded-full bg-emerald-500/10 absolute -inset-2 animate-pulse" />
            <img
              src={partnerAvatar}
              alt={partnerName}
              referrerPolicy="no-referrer"
              className="w-32 h-32 rounded-full object-cover ring-4 ring-emerald-500/60 shadow-2xl relative z-10"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            HD Audio via GB Real-Time Codec
          </span>
        </div>
      )}

      {/* Video Call Partner Floating PIP if in video mode */}
      {isVideo && (
        <div className="absolute top-20 right-4 z-20 w-24 h-32 rounded-2xl overflow-hidden border-2 border-white/40 shadow-2xl bg-slate-850">
          <img
            src={partnerAvatar}
            alt={partnerName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 pb-10 px-6 pt-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <div className="flex items-center justify-center gap-5 max-w-sm mx-auto">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`w-13 h-13 rounded-full flex items-center justify-center backdrop-blur-md transition ${
              isMuted
                ? 'bg-amber-500/90 text-slate-950'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Video Toggle if video call */}
          {isVideo && (
            <button
              onClick={toggleVideo}
              className={`w-13 h-13 rounded-full flex items-center justify-center backdrop-blur-md transition ${
                !isVideoEnabled
                  ? 'bg-amber-500/90 text-slate-950'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={isVideoEnabled ? 'Turn Video Off' : 'Turn Video On'}
            >
              {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          )}

          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            className={`w-13 h-13 rounded-full flex items-center justify-center backdrop-blur-md transition ${
              isSpeakerOn
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-slate-700/80 text-slate-400'
            }`}
            title="Speaker"
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={endActiveCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-950/60 hover:scale-105 active:scale-95 transition"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
