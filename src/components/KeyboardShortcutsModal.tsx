import React, { useState, useMemo } from 'react';
import {
  Keyboard,
  X,
  Search,
  Play,
  Mic,
  Download,
  Compass,
  Sparkles,
  Command,
} from 'lucide-react';
import { AppLanguage } from '../types';
import {
  SHORTCUT_REGISTRY,
  ShortcutDefinition,
  formatShortcutBadge,
} from '../utils/keyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang?: AppLanguage;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  uiLang = 'km',
}) => {
  const isKhmer = uiLang === 'km';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const isMac = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }
    return false;
  }, []);

  const categories = [
    { id: 'all', labelEn: 'All Shortcuts', labelKm: 'ផ្លូវកាត់ទាំងអស់', icon: Keyboard },
    { id: 'playback', labelEn: 'Playback & Audio', labelKm: 'ការចាក់ & សំឡេង', icon: Play },
    { id: 'recording', labelEn: 'Voice Recording', labelKm: 'ការថតសំឡេង', icon: Mic },
    { id: 'export', labelEn: 'Export & Library', labelKm: 'ទាញយក & បណ្ណាល័យ', icon: Download },
    { id: 'navigation', labelEn: 'Studio Navigation', labelKm: 'ផ្ទាំងស្ទូឌីយោ', icon: Compass },
  ];

  const filteredShortcuts = useMemo(() => {
    return SHORTCUT_REGISTRY.filter((sc) => {
      if (selectedCategory !== 'all' && sc.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        sc.descriptionEn.toLowerCase().includes(query) ||
        sc.descriptionKm.toLowerCase().includes(query) ||
        (sc.badgeText && sc.badgeText.toLowerCase().includes(query)) ||
        sc.key.toLowerCase().includes(query)
      );
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-base font-bold text-white flex items-center gap-2"
              >
                {isKhmer ? 'ផ្លូវកាត់ក្ដារចុច (Keyboard Shortcuts)' : 'Keyboard Shortcuts Cheat Sheet'}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {filteredShortcuts.length} {isKhmer ? 'ផ្លូវកាត់' : 'keys'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKhmer
                  ? 'បង្កើនល្បឿនការងារជាមួយផ្លូវកាត់សម្រាប់ ការចាក់ ការថត និងការទាញយក'
                  : 'Boost your workflow efficiency with rapid recording, playback, and export actions.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isKhmer ? 'បិទ (Esc)' : 'Close (Esc)'}
            data-testid="close-shortcuts-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isKhmer
                  ? 'ស្វែងរកផ្លូវកាត់... (ឧទាហរណ៍៖ record, play, export, space)'
                  : 'Search shortcuts... (e.g. record, play, export, space)'
              }
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{isKhmer ? cat.labelKm : cat.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcuts List Table */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredShortcuts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {isKhmer
                ? 'មិនមានផ្លូវកាត់ត្រូវនឹងពាក្យស្វែងរកឡើយ។'
                : 'No shortcuts matched your search query.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredShortcuts.map((sc) => {
                const badge = formatShortcutBadge(sc, isMac);
                return (
                  <div
                    key={sc.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-950 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                        {isKhmer ? sc.descriptionKm : sc.descriptionEn}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="capitalize text-slate-400 font-mono">
                          {sc.category}
                        </span>
                        {sc.allowInInput && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                            {isKhmer ? 'ប្រើពេលកំពុងវាយបាន' : 'In inputs'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Styled Keycap */}
                    <div className="shrink-0 flex items-center gap-1">
                      {badge.split(' + ').map((keyPart, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="text-[10px] text-slate-400">+</span>}
                          <kbd className="px-2.5 py-1 rounded-md bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 shadow-sm shadow-black/50 text-[11px] font-mono font-bold text-indigo-300 tracking-wider">
                            {keyPart}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with quick tip */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isKhmer
                ? 'ព័ត៌មានជំនួយ៖ ចុច Space ដើម្បីចាក់/ផ្អាក ឬ R ដើម្បីចាប់ផ្តើមថតសំឡេងភ្លាមៗ'
                : 'Tip: Press Space to Play/Pause, R to Record, or E to open Export Settings from anywhere.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">
              {isKhmer ? 'បិទផ្ទាំង' : 'Close'}:
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
