import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Smartphone, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const { deviceView, toggleDeviceView } = useTheme();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTime(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start sm:p-4 md:p-6 transition-colors">
      {/* Top Device Switcher bar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 px-3 text-xs text-slate-400 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-300">GB Official</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Android 14 (API 34) • Real-Time Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDeviceView}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            title="Toggle between Phone frame and Full Responsive canvas"
          >
            {deviceView === 'phone' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>Expand View</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Phone Frame</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        className={`w-full transition-all duration-300 flex flex-col ${
          deviceView === 'phone'
            ? 'max-w-[430px] h-[890px] max-h-[95vh] rounded-[42px] border-[8px] border-slate-800 shadow-2xl shadow-emerald-950/40 relative overflow-hidden bg-white dark:bg-[#111b21]'
            : 'max-w-4xl h-[92vh] rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden bg-white dark:bg-[#111b21]'
        }`}
      >
        {/* Android Status Bar */}
        <section
          aria-label="System status bar"
          className="w-full px-5 pt-3 pb-1 flex items-center justify-between text-xs font-semibold select-none z-30 shrink-0 bg-[#005c4b] dark:bg-[#1f2c34] text-white transition-colors"
        >
          <span className="font-mono text-xs">{time || '09:41'}</span>

          {/* Camera Punch-Hole cutout */}
          {deviceView === 'phone' && (
            <div className="w-4 h-4 rounded-full bg-black/80 border border-white/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-emerald-100">
            <span className="text-[10px] tracking-tighter text-emerald-300 font-bold">5G</span>
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">98%</span>
              <Battery className="w-4 h-4 fill-current" />
            </div>
          </div>
        </section>

        {/* Viewport content */}
        <div className="flex-1 relative flex flex-col overflow-hidden">
          {children}
        </div>

        {/* Android Navigation Gesture Pill */}
        {deviceView === 'phone' && (
          <nav aria-label="System navigation bar" className="w-full py-2 flex items-center justify-center bg-transparent shrink-0">
            <div className="w-32 h-1 rounded-full bg-slate-400/50 dark:bg-slate-600" />
          </nav>
        )}
      </main>
    </div>
  );
};
