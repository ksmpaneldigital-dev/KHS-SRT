import React from 'react';
import { ActiveTab } from '../types';
import {
  Mic,
  Volume2,
  Subtitles,
  Activity,
  Sliders,
  FolderHeart,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  libraryCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  libraryCount,
}) => {
  const tabs = [
    {
      id: 'tts' as ActiveTab,
      label: 'Text to Speech',
      shortLabel: 'TTS Studio',
      icon: Volume2,
      badge: 'AI Neural',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    {
      id: 'subtitles' as ActiveTab,
      label: 'Subtitle to Speech',
      shortLabel: 'SRT Studio',
      icon: Subtitles,
      badge: 'Auto Dub',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'pitch' as ActiveTab,
      label: 'Pitch & Vocal Analyzer',
      shortLabel: 'VoiceTools',
      icon: Activity,
      badge: 'Live F0',
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    },
    {
      id: 'recorder' as ActiveTab,
      label: 'Voice Recorder',
      shortLabel: 'Recorder',
      icon: Mic,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'tools' as ActiveTab,
      label: 'Audio Converter',
      shortLabel: 'Tools',
      icon: Sliders,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'library' as ActiveTab,
      label: 'Saved Audio',
      shortLabel: 'Library',
      icon: FolderHeart,
      badge: libraryCount > 0 ? `${libraryCount}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('tts')}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white animate-pulse" />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-mono">
                  Voice<span className="text-indigo-400">Tool</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Studio v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                All-in-One Voice, Speech &amp; Audio Workstation
              </p>
            </div>
          </div>

          {/* Quick status / Pro badge */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Web Audio &amp; Neural Engine Ready</span>
            </div>

            <button
              onClick={() => setActiveTab('pitch')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Voice Therapy &amp; Training</span>
            </button>
          </div>
        </div>

        {/* Tab navigation bar */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-900/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>

                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                      isActive ? 'bg-white/20 text-white border-white/30' : tab.badgeColor
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
