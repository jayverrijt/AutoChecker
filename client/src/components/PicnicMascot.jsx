import React from 'react';

export const PicnicMascot = ({ className = "w-40 h-28 mx-auto" }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 200 130" className="w-full h-full drop-shadow-md">
        {/* Soft blue hill / spotlight background */}
        <path
          d="M 20 130 Q 100 40 180 130 Z"
          fill="#3b72ff"
          opacity="0.8"
        />

        {/* Floating musical notes */}
        <g fill="#1b2028" opacity="0.9">
          {/* Note 1 */}
          <path d="M 124 24 L 136 21 L 136 29 L 124 32 Z" />
          <rect x="124" y="24" width="2" height="12" />
          <circle cx="123" cy="36" r="3" />
          <rect x="134" y="21" width="2" height="12" />
          <circle cx="133" cy="33" r="3" />

          {/* Note 2 */}
          <circle cx="145" cy="22" r="2.5" />
          <path d="M 147 22 L 147 13 Q 152 13 154 17" fill="none" stroke="#1b2028" strokeWidth="1.8" />
        </g>

        {/* Dancing stick legs */}
        <g stroke="#1e222a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Left leg */}
          <path d="M 94 96 L 86 114 L 80 115" />
          {/* Right leg kicking up */}
          <path d="M 106 96 L 122 108 L 132 104" />
        </g>

        {/* Milk Bottle Body */}
        <rect
          x="84"
          y="48"
          width="32"
          height="50"
          rx="6"
          fill="#ffffff"
          stroke="#1e222a"
          strokeWidth="2.8"
        />

        {/* Milk Bottle Neck */}
        <rect
          x="90"
          y="35"
          width="20"
          height="16"
          fill="#ffffff"
          stroke="#1e222a"
          strokeWidth="2.8"
        />

        {/* Red Cap */}
        <rect
          x="87"
          y="28"
          width="26"
          height="9"
          rx="3.5"
          fill="#ef4444"
          stroke="#1e222a"
          strokeWidth="2.5"
        />

        {/* Bottle details (milk line / shine) */}
        <path
          d="M 88 56 Q 100 59 112 56"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <line x1="88" y1="64" x2="88" y2="88" stroke="#f1f5f9" strokeWidth="2.5" strokeLinecap="round" />

        {/* Dancing stick arms */}
        <g stroke="#1e222a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Left arm waving down */}
          <path d="M 84 62 L 72 74 L 75 80" />
          {/* Right arm waving up */}
          <path d="M 116 62 L 128 66 L 126 75" />
        </g>
      </svg>
    </div>
  );
};
