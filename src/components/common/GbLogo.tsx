import React from 'react';

interface GbLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  withRing?: boolean;
}

export const GbLogo: React.FC<GbLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  withRing = false,
}) => {
  const pixelSizes = {
    sm: 32,
    md: 44,
    lg: 64,
    xl: 88,
  };

  const px = pixelSizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative flex items-center justify-center rounded-2xl shadow-md transition-all ${
          withRing ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : ''
        }`}
        style={{
          width: px,
          height: px,
          background: 'linear-gradient(135deg, #059669 0%, #0d9488 50%, #0891b2 100%)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-4/5 h-4/5 text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle outer communication signal waves */}
          <path
            d="M20 72 C 16 65, 14 55, 16 42 C 18 28, 30 18, 50 18 C 72 18, 86 32, 86 52 C 86 70, 72 82, 52 82 C 45 82, 38 80, 32 76 L 18 80 Z"
            fill="rgba(255, 255, 255, 0.18)"
          />
          {/* Central crisp speech outline */}
          <path
            d="M24 68 L 22 76 L 31 73 C 37 76, 44 78, 51 78 C 70 78, 82 66, 82 50 C 82 34, 68 22, 50 22 C 32 22, 20 34, 20 50 C 20 57, 23 63, 27 68"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Distinctive stylized "GB" monogram */}
          <text
            x="51"
            y="57"
            fill="white"
            fontSize="28"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            textAnchor="middle"
            letterSpacing="-1px"
          >
            GB
          </text>
          {/* Fast connection dot */}
          <circle cx="71" cy="33" r="4.5" fill="#34d399" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-lg leading-none bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
              GB Official
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              PRO
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Secure Android Messenger
          </span>
        </div>
      )}
    </div>
  );
};
