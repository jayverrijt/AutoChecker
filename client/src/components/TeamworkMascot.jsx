import React from 'react';

export const TeamworkMascot = ({ className = "w-14 h-14 mx-auto" }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
        {/* Soft shadow below mascot */}
        <ellipse cx="50" cy="88" rx="22" ry="5" fill="#000000" opacity="0.4" />

        {/* Roller skis / skateboard line */}
        <path
          d="M 28 85 L 72 85"
          stroke="#556075"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="34" cy="88" r="3" fill="#3b82f6" />
        <circle cx="66" cy="88" r="3" fill="#3b82f6" />

        {/* Stick legs */}
        <path
          d="M 42 70 L 38 83"
          stroke="#252a36"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M 58 70 L 62 83"
          stroke="#252a36"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Orange Body with smooth gradient */}
        <defs>
          <radialGradient id="orangeGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff8533" />
            <stop offset="60%" stopColor="#f95700" />
            <stop offset="100%" stopColor="#d33f00" />
          </radialGradient>
          <linearGradient id="shadesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e222a" />
            <stop offset="100%" stopColor="#0a0c10" />
          </linearGradient>
        </defs>

        <circle
          cx="50"
          cy="48"
          r="26"
          fill="url(#orangeGrad)"
          stroke="#b83400"
          strokeWidth="1.8"
        />

        {/* Green leaf and stem on top */}
        <path
          d="M 50 23 Q 48 15 46 12"
          fill="none"
          stroke="#4b2e18"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M 50 19 Q 62 14 66 22 Q 58 26 50 19 Z"
          fill="#22c55e"
          stroke="#15803d"
          strokeWidth="1.2"
        />

        {/* Cool black sunglasses (shades) */}
        <g>
          {/* Bridge */}
          <line x1="43" y1="46" x2="57" y2="46" stroke="#000000" strokeWidth="2.8" />
          {/* Left lens */}
          <rect
            x="30"
            y="42"
            width="16"
            height="13"
            rx="3"
            fill="url(#shadesGrad)"
            stroke="#000000"
            strokeWidth="1.5"
          />
          {/* Right lens */}
          <rect
            x="54"
            y="42"
            width="16"
            height="13"
            rx="3"
            fill="url(#shadesGrad)"
            stroke="#000000"
            strokeWidth="1.5"
          />
          {/* Glare/shine on glasses */}
          <line x1="33" y1="44" x2="40" y2="52" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <line x1="57" y1="44" x2="64" y2="52" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* Confident smile */}
        <path
          d="M 43 62 Q 50 67 57 62"
          fill="none"
          stroke="#421200"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Stick arms - thumbs up / relaxed wave */}
        <path
          d="M 25 50 L 16 43 L 14 46"
          stroke="#252a36"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M 75 50 L 84 56 L 87 53"
          stroke="#252a36"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
};
