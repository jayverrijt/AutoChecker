import React from 'react';
import { Home, Calendar, Menu } from 'lucide-react';

export const BottomNav = ({ activeTab, onTabChange, hasUnreadReaction }) => {
  const isMenuSection = activeTab === 'menu' || activeTab === 'live' || activeTab === 'settings';

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full md:max-w-md mx-auto bg-[#0e0f12]/95 backdrop-blur-md border-t border-[#232632] py-2 px-10 flex items-center justify-between z-40 select-none pb-safe">
      {/* 1. Home Tab */}
      <button
        type="button"
        onClick={() => onTabChange('home')}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${
          activeTab === 'home'
            ? 'text-[#3171f7]'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
        title="Home"
      >
        <Home className={`w-6 h-6 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
      </button>

      {/* 2. Schedule (Rooster) Tab */}
      <button
        type="button"
        onClick={() => onTabChange('schedule')}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-90 ${
          activeTab === 'schedule'
            ? 'text-[#3171f7]'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
        title="Rooster"
      >
        <Calendar className={`w-6 h-6 ${activeTab === 'schedule' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
      </button>

      {/* 3. Menu Tab */}
      <button
        type="button"
        onClick={() => onTabChange('menu')}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-90 relative ${
          isMenuSection
            ? 'text-[#3171f7]'
            : 'text-neutral-400 hover:text-neutral-200'
        }`}
        title="Menu"
      >
        <div className="relative">
          <Menu className={`w-6 h-6 ${isMenuSection ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          {hasUnreadReaction && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
          )}
        </div>
      </button>
    </nav>
  );
};
