import React from 'react';
import { ActiveTab, AppLanguage } from '../types';
import {
  Mic,
  Volume2,
  Subtitles,
  Activity,
  Sliders,
  FolderHeart,
  Sparkles,
  Languages,
  Keyboard,
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  libraryCount: number;
  uiLang: AppLanguage;
  setUiLang: (lang: AppLanguage) => void;
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  libraryCount,
  uiLang,
  setUiLang,
  onOpenShortcuts,
}) => {
  const isKhmer = uiLang === 'km';

  const tabs = [
    {
      id: 'tts' as ActiveTab,
      label: isKhmer ? 'បម្លែងអត្ថបទជាសំឡេង (TTS)' : 'Text to Speech',
      shortLabel: isKhmer ? 'TTS ខ្មែរ' : 'TTS Studio',
      icon: Volume2,
      badge: isKhmer ? 'សំឡេង AI' : 'AI Neural',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      shortcutKey: '1',
    },
    {
      id: 'subtitles' as ActiveTab,
      label: isKhmer ? 'ចំណងជើងរងជាសំឡេង (SRT)' : 'Subtitle to Speech',
      shortLabel: isKhmer ? 'SRT ខ្មែរ' : 'SRT Studio',
      icon: Subtitles,
      badge: isKhmer ? 'បញ្ចូលសំឡេង' : 'Auto Dub',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      shortcutKey: '2',
    },
    {
      id: 'pitch' as ActiveTab,
      label: isKhmer ? 'វិភាគកម្រិតសំឡេង (Pitch)' : 'Pitch & Vocal Analyzer',
      shortLabel: isKhmer ? 'កម្រិតសំឡេង' : 'VoiceTools',
      icon: Activity,
      badge: 'Live F0',
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      shortcutKey: '3',
    },
    {
      id: 'recorder' as ActiveTab,
      label: isKhmer ? 'ថតសំឡេងស្ទូឌីយោ' : 'Voice Recorder',
      shortLabel: isKhmer ? 'ថតសំឡេង' : 'Recorder',
      icon: Mic,
      badge: null,
      badgeColor: '',
      shortcutKey: '4',
    },
    {
      id: 'tools' as ActiveTab,
      label: isKhmer ? 'ឧបករណ៍បំប្លែងសំឡេង' : 'Audio Converter',
      shortLabel: isKhmer ? 'ឧបករណ៍' : 'Tools',
      icon: Sliders,
      badge: null,
      badgeColor: '',
      shortcutKey: '5',
    },
    {
      id: 'library' as ActiveTab,
      label: isKhmer ? 'សំឡេងរក្សាទុក' : 'Saved Audio',
      shortLabel: isKhmer ? 'បណ្ណាល័យ' : 'Library',
      icon: FolderHeart,
      badge: libraryCount > 0 ? `${libraryCount}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-mono',
      shortcutKey: '6',
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
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
                  {isKhmer ? 'ជំនាន់ ២.៥' : 'Studio v2.5'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isKhmer
                  ? 'ស្ទូឌីយោសំឡេងឆ្លាតវៃ បម្លែងអត្ថបទ និងវិភាគកម្រិតសំឡេង'
                  : 'All-in-One Voice, Speech & Audio Workstation'}
              </p>
            </div>
          </div>

          {/* Quick status / Pro badge / Language Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {isKhmer
                  ? 'ប្រព័ន្ធ Web Audio & Speech រួចរាល់'
                  : 'Web Audio & Neural Engine Ready'}
              </span>
            </div>

            {/* Language Switcher Pill */}
            <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setUiLang('km')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  isKhmer
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="ប្តូរទៅភាសាខ្មែរ"
              >
                <span>🇰🇭</span>
                <span className="font-sans">ខ្មែរ</span>
              </button>
              <button
                type="button"
                onClick={() => setUiLang('en')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  !isKhmer
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to English"
              >
                <span>🇺🇸</span>
                <span>EN</span>
              </button>
            </div>

            <button
              onClick={() => setActiveTab('pitch')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isKhmer ? 'ហាត់កម្រិតសំឡេង' : 'Voice Therapy'}</span>
            </button>

            {onOpenShortcuts && (
              <button
                type="button"
                onClick={onOpenShortcuts}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                title={isKhmer ? 'ផ្លូវកាត់ក្ដារចុច (?)' : 'Keyboard Shortcuts (?)'}
                data-testid="navbar-shortcuts-btn"
              >
                <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline text-slate-300">
                  {isKhmer ? 'ផ្លូវកាត់' : 'Shortcuts'}
                </span>
                <kbd className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
                  ?
                </kbd>
              </button>
            )}
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>

                <kbd
                  className={`hidden md:inline text-[9px] font-mono px-1 py-0.2 rounded border transition-colors ${
                    isActive
                      ? 'bg-indigo-700/80 text-indigo-100 border-indigo-400/40'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                  }`}
                  title={isKhmer ? `ចុចលេខ ${tab.shortcutKey} ដើម្បីប្តូរ` : `Press ${tab.shortcutKey} to switch`}
                >
                  {tab.shortcutKey}
                </kbd>

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
