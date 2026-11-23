import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 36,
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Original Warm Smart Notebook Vector Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md select-none"
      >
        <defs>
          <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>

          <linearGradient id="logoPageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>

          <linearGradient id="logoSpiral" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="40%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          <linearGradient id="logoEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <pattern id="logoMathGrid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#fcd34d" strokeWidth="1" opacity="0.6" />
          </pattern>
        </defs>

        {/* Base Squircle Tile */}
        <rect width="512" height="512" rx="118" fill="url(#logoBgGrad)" />
        <rect
          width="506"
          height="506"
          x="3"
          y="3"
          rx="116"
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="3"
        />

        {/* Notebook Body */}
        <g>
          {/* Cover & Paper */}
          <rect x="88" y="78" width="336" height="364" rx="28" fill="#78350f" opacity="0.6" />
          <rect x="96" y="68" width="324" height="364" rx="24" fill="url(#logoPageGrad)" />
          <rect x="96" y="68" width="324" height="364" rx="24" fill="url(#logoMathGrid)" />

          {/* Red Notebook Margin */}
          <line x1="168" y1="68" x2="168" y2="432" stroke="#f43f5e" strokeWidth="2.5" opacity="0.75" />

          {/* Red Bookmark Ribbon (Ляссе) */}
          <path d="M 330 68 L 330 176 L 345 160 L 360 176 L 360 68 Z" fill="#ef4444" />
        </g>

        {/* Spiral Binder Rings */}
        <g>
          {[104, 152, 200, 248, 296, 344, 392].map((y) => (
            <g key={y}>
              <rect x="84" y={y} width="28" height="12" rx="6" fill="url(#logoSpiral)" />
              <circle cx="84" cy={y + 6} r="4.5" fill="#451a03" />
              <circle cx="112" cy={y + 6} r="3.5" fill="#fde68a" opacity="0.9" />
            </g>
          ))}
        </g>

        {/* Shopping Basket / Bag with Checkmark */}
        <g>
          <path
            d="M 200 240 L 350 240 C 356 240 361 245 359 251 L 342 338 C 340 348 331 356 320 356 L 230 356 C 219 356 210 348 208 338 L 191 251 C 189 245 194 240 200 240 Z"
            fill="url(#logoEmerald)"
          />
          <path
            d="M 235 240 C 235 204 315 204 315 240"
            fill="none"
            stroke="#fef08a"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 248 298 L 268 318 L 306 274"
            fill="none"
            stroke="#ffffff"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Golden Sparkle ✨ */}
        <path
          d="M 382 190 Q 382 208 400 208 Q 382 208 382 226 Q 382 208 364 208 Q 382 208 382 190 Z"
          fill="#fde047"
        />

        {/* Sum Symbol */}
        <rect x="290" y="114" width="34" height="22" rx="6" fill="#fbbf24" />
        <text
          x="307"
          y="130"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="13"
          fontWeight="900"
          fill="#78350f"
          textAnchor="middle"
        >
          ∑
        </text>
      </svg>

      {showText && (
        <span className="font-extrabold text-base tracking-tight text-stone-900 dark:text-stone-100">
          NotebookSmart
        </span>
      )}
    </div>
  );
};
