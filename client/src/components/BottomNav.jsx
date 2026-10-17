import React from 'react';
import { Calendar, Bot, Settings, Home } from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange, hasUnreadReaction }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#141416]/95 backdrop-blur-md border-t border-[#23242b] py-2 px-6 flex items-center justify-around z-40 select-none pb-safe">
      {/* 1. Schedule (Rooster) Tab */}
      <button
        onClick={() => onTabChange('schedule')}
        className={`flex flex-col items-center gap-1 transition-all py-1 px-3 rounded-xl ${
          activeTab === 'schedule'
            ? 'text-blue-500 scale-105'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Calendar className={`w-6 h-6 ${activeTab === 'schedule' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] font-semibold">Rooster</span>
      </button>

      {/* 2. Slack Bot & Live Stream Tab */}
      <button
        onClick={() => onTabChange('live')}
        className={`flex flex-col items-center gap-1 transition-all py-1 px-3 rounded-xl relative ${
          activeTab === 'live'
            ? 'text-blue-500 scale-105'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <div className="relative">
          <Bot className={`w-6 h-6 ${activeTab === 'live' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          {hasUnreadReaction && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
          )}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
        </div>
        <span className="text-[10px] font-semibold">Slack Live</span>
      </button>

      {/* 3. Settings / Profile Tab */}
      <button
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center gap-1 transition-all py-1 px-3 rounded-xl ${
          activeTab === 'settings'
            ? 'text-blue-500 scale-105'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Settings className={`w-6 h-6 ${activeTab === 'settings' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] font-semibold">Instellingen</span>
      </button>
    </nav>
  );
};
