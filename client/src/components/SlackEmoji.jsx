import React from 'react';

/**
 * Renders Slack emoji representations including the custom Picnic runner emojis:
 * :1-red:, :2-red:, :3-red:, :picnic:
 */
export const SlackEmoji = ({ name, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-xs',
    lg: 'w-7 h-7 text-sm font-bold',
    xl: 'w-9 h-9 text-base font-black'
  };

  const cleanName = (name || '').replace(/^:/, '').replace(/:$/, '').trim();

  // Custom 1-red emoji: red square with white number 1
  if (cleanName === '1-red' || cleanName === '1') {
    return (
      <span
        title=":1-red:"
        className={`inline-flex items-center justify-center bg-red-600 text-white rounded font-black shadow-sm select-none border border-red-500/50 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      >
        1
      </span>
    );
  }

  // Custom 2-red emoji: red square with white number 2
  if (cleanName === '2-red' || cleanName === '2') {
    return (
      <span
        title=":2-red:"
        className={`inline-flex items-center justify-center bg-red-600 text-white rounded font-black shadow-sm select-none border border-red-500/50 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      >
        2
      </span>
    );
  }

  // Custom 3-red emoji: red square with white number 3
  if (cleanName === '3-red' || cleanName === '3') {
    return (
      <span
        title=":3-red:"
        className={`inline-flex items-center justify-center bg-red-600 text-white rounded font-black shadow-sm select-none border border-red-500/50 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      >
        3
      </span>
    );
  }

  // Custom 4-red emoji: red square with white number 4
  if (cleanName === '4-red' || cleanName === '4') {
    return (
      <span
        title=":4-red:"
        className={`inline-flex items-center justify-center bg-red-600 text-white rounded font-black shadow-sm select-none border border-red-500/50 ${sizeClasses[size] || sizeClasses.md} ${className}`}
      >
        4
      </span>
    );
  }

  // Picnic Logo emoji
  if (cleanName === 'picnic') {
    return (
      <span
        title=":picnic:"
        className={`inline-flex items-center justify-center bg-red-600 text-white rounded font-bold tracking-tighter px-0.5 select-none shadow-sm ${sizeClasses[size] || sizeClasses.md} ${className}`}
        style={{ fontSize: size === 'sm' ? '8px' : '10px' }}
      >
        PIC
        <span className="text-[7px] text-red-100">NIC</span>
      </span>
    );
  }

  // Fallbacks for standard emojis
  if (cleanName === 'white_check_mark') return <span className="inline-block">✅</span>;
  if (cleanName === 'alarm_clock') return <span className="inline-block">⏰</span>;
  if (cleanName === 'rotating_light') return <span className="inline-block">🚨</span>;
  if (cleanName === 'arrow_up') return <span className="inline-block">⬆️</span>;
  if (cleanName === 'broom') return <span className="inline-block">🧹</span>;

  return <span className={`inline-block ${className}`}>{name}</span>;
};
