import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  Smartphone,
  Tablet,
  QrCode,
  ShieldCheck,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LinkedDevicesModalProps {
  onClose: () => void;
}

export const LinkedDevicesModal: React.FC<LinkedDevicesModalProps> = ({ onClose }) => {
  const { token } = useAuth();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [pairCode, setPairCode] = useState<string>('GB-842915');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);

  const loadDevices = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [token]);

  const handleSimulatePair = async () => {
    if (!token) return;
    setIsPairing(true);
    try {
      const res = await fetch('/api/devices/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceName: 'GB Web / Chrome (macOS)',
          platform: 'web',
        }),
      });
      if (res.ok) {
        setPairingSuccess(true);
        setTimeout(() => {
          setPairingSuccess(false);
          setShowPairDialog(false);
          loadDevices();
        }, 1500);
      }
    } catch {
      // ignore
    } finally {
      setIsPairing(false);
    }
  };

  const handleLogoutOthers = async () => {
    if (!token) return;
    setIsLoggingOutOthers(true);
    try {
      const res = await fetch('/api/devices/logout-others', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        loadDevices();
      }
    } catch {
      // ignore
    } finally {
      setIsLoggingOutOthers(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1f2c34] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#00a884]/15 text-[#00a884] dark:text-[#25d366] flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Linked Devices
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage your active web and desktop sessions
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

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Security highlight banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <span className="font-bold">Multi-Device End-to-End Encryption:</span> Each linked device maintains independent cryptographic session keys for total message privacy.
            </div>
          </div>

          {/* Link a Device Button */}
          <button
            onClick={() => {
              setPairCode(`GB-${Math.floor(100000 + Math.random() * 900000)}`);
              setShowPairDialog(true);
            }}
            className="w-full py-3 rounded-2xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" /> Link a New Device
          </button>

          {/* QR Pairing Dialog */}
          {showPairDialog && (
            <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Scan QR Code to Link
                </span>
                <button
                  onClick={() => setShowPairDialog(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* QR Graphic Simulation */}
              <div className="w-40 h-40 mx-auto bg-white p-2 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center justify-center">
                <div className="w-32 h-32 bg-[radial-gradient(#00a884_2px,transparent_2px)] [background-size:8px_8px] relative flex items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-md">
                    GB
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-[11px] text-slate-500">Or enter pairing code:</div>
                <div className="font-mono font-bold text-sm tracking-wider text-[#00a884] dark:text-[#25d366]">
                  {pairCode}
                </div>
              </div>

              {pairingSuccess ? (
                <div className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5 py-1">
                  <CheckCircle2 className="w-4 h-4" /> Device Linked Successfully!
                </div>
              ) : (
                <button
                  onClick={handleSimulatePair}
                  disabled={isPairing}
                  className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition"
                >
                  {isPairing ? 'Pairing Device...' : 'Complete Pair (Simulate Link)'}
                </button>
              )}
            </div>
          )}

          {/* Device List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Device Status</span>
              <span>{devices.length} Active</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111b21] overflow-hidden">
              {devices.map((device) => {
                const isCurrent = device.isCurrent;
                return (
                  <div key={device.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                        {device.platform === 'desktop' || device.platform === 'web' ? (
                          <Laptop className="w-4 h-4" />
                        ) : (
                          <Smartphone className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                            {device.deviceName}
                          </h5>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              This Device
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>Last active: {device.lastActive || 'Just now'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logout from all other devices */}
          {devices.length > 1 && (
            <button
              onClick={handleLogoutOthers}
              disabled={isLoggingOutOthers}
              className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOutOthers ? 'Disconnecting sessions...' : 'Log Out from All Other Devices'}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
