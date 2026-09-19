import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Radio,
  Clock,
  Compass,
  Check,
  AlertCircle,
  Square,
  Navigation,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LocationShareModalProps {
  conversationId: string;
  onClose: () => void;
  onLocationSent?: () => void;
}

export const LocationShareModal: React.FC<LocationShareModalProps> = ({
  conversationId,
  onClose,
  onLocationSent,
}) => {
  const { token } = useAuth();
  const [shareType, setShareType] = useState<'static' | 'live'>('static');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [latitude, setLatitude] = useState<number>(37.7749);
  const [longitude, setLongitude] = useState<number>(-122.4194);
  const [address, setAddress] = useState<string>('Market St, San Francisco, CA');
  const [isLoadingGps, setIsLoadingGps] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<any | null>(null);

  // Check for existing active live session in this conversation
  useEffect(() => {
    if (!token) return;
    fetch('/api/location/active-sessions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.sessions && data.sessions.length > 0) {
          const matched = data.sessions.find((s: any) => s.conversationId === conversationId);
          if (matched) setActiveSession(matched);
        }
      })
      .catch(() => {});
  }, [token, conversationId]);

  const fetchDeviceLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLoadingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setAddress(`GPS Location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        setIsLoadingGps(false);
      },
      (err) => {
        setIsLoadingGps(false);
        // Provide friendly fallback notification
        setGpsError(`GPS permission required or unavailable (${err.message}). Using preset coordinates.`);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSendLocation = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/location/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          latitude,
          longitude,
          address,
          isLive: shareType === 'live',
          durationMinutes: shareType === 'live' ? durationMinutes : undefined,
        }),
      });

      if (res.ok) {
        if (onLocationSent) onLocationSent();
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopLiveSharing = async () => {
    if (!token || !activeSession) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/location/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: activeSession.id,
        }),
      });
      if (res.ok) {
        setActiveSession(null);
        if (onLocationSent) onLocationSent();
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Share Location
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Send static pin or real-time live location
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

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* If Live Location Active Banner */}
          {activeSession && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Live Location Active
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-300">
                    Sharing in this chat. Expires soon.
                  </div>
                </div>
              </div>
              <button
                onClick={handleStopLiveSharing}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </div>
          )}

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              onClick={() => setShareType('static')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                shareType === 'static'
                  ? 'bg-white dark:bg-[#00a884] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Current Pin
            </button>
            <button
              onClick={() => setShareType('live')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                shareType === 'live'
                  ? 'bg-white dark:bg-[#00a884] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              Share Live
            </button>
          </div>

          {/* Map Preview Graphic */}
          <div className="relative h-36 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            {/* Styled Map Grid Texture */}
            <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-25 dark:opacity-40" />
            
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900">
                  <MapPin className="w-5 h-5 fill-current" />
                </div>
                {shareType === 'live' && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
                  </span>
                )}
              </div>
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-slate-800 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-800 max-w-[240px] truncate">
                {address}
              </div>
            </div>

            {/* GPS Refresh Button */}
            <button
              onClick={fetchDeviceLocation}
              disabled={isLoadingGps}
              className="absolute bottom-2 right-2 p-2 rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 hover:scale-105 active:scale-95 transition"
              title="Get live device GPS"
            >
              <Navigation className={`w-4 h-4 ${isLoadingGps ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {gpsError && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[11px] flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Coordinates & Custom Label */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Coordinates</span>
              <span className="font-mono text-[11px]">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">
                Location Title / Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Coffee Shop, Central Park, Home"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Live Duration Selector if Live */}
          {shareType === 'live' && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Share for duration</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '15 mins', val: 15 },
                  { label: '1 hour', val: 60 },
                  { label: '8 hours', val: 480 },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setDurationMinutes(d.val)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition border ${
                      durationMinutes === d.val
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Live location will continuously transmit your device's coordinates and stop automatically after {durationMinutes >= 60 ? `${durationMinutes / 60} hour(s)` : `${durationMinutes} minutes`}.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSendLocation}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" />
            {shareType === 'live' ? 'Start Live Sharing' : 'Send Location Pin'}
          </button>
        </div>
      </div>
    </div>
  );
};
