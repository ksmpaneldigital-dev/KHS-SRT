/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ActiveTab, AppLanguage, SavedAudioItem } from './types';
import { Navbar } from './components/Navbar';
import { TtsStudio } from './components/TtsStudio';
import { SubtitleStudio } from './components/SubtitleStudio';
import { PitchAnalyzer } from './components/PitchAnalyzer';
import { VoiceRecorder } from './components/VoiceRecorder';
import { AudioTools } from './components/AudioTools';
import { LibraryModal } from './components/LibraryModal';
import { Sparkles, Shield, Cpu, Github, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'voicetool_library_v1';
const LANG_STORAGE_KEY = 'voicetool_ui_lang_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tts');
  const [uiLang, setUiLang] = useState<AppLanguage>(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'en' || stored === 'km') return stored;
    } catch {}
    return 'km'; // Default to Khmer as requested
  });

  const [libraryItems, setLibraryItems] = useState<SavedAudioItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSetUiLang = (lang: AppLanguage) => {
    setUiLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  };

  // Check URL query parameters for ?tab=... or ?lang=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as ActiveTab | null;
      if (tabParam && ['tts', 'subtitles', 'pitch', 'recorder', 'tools', 'library'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const langParam = params.get('lang') as AppLanguage | null;
      if (langParam === 'en' || langParam === 'km') {
        handleSetUiLang(langParam);
      }
    } catch {}
  }, []);

  const handleSaveToLibrary = (item: SavedAudioItem) => {
    setLibraryItems((prev) => {
      const updated = [item, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 30)));
      } catch {}
      return updated;
    });
  };

  const handleDeleteItem = (id: string) => {
    setLibraryItems((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearLibrary = () => {
    setLibraryItems([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const isKhmer = uiLang === 'km';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Studio Header & Tab Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        libraryCount={libraryItems.length}
        uiLang={uiLang}
        setUiLang={handleSetUiLang}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'tts' && <TtsStudio onSaveToLibrary={handleSaveToLibrary} uiLang={uiLang} />}
        {activeTab === 'subtitles' && <SubtitleStudio onSaveToLibrary={handleSaveToLibrary} uiLang={uiLang} />}
        {activeTab === 'pitch' && <PitchAnalyzer />}
        {activeTab === 'recorder' && <VoiceRecorder onSaveToLibrary={handleSaveToLibrary} />}
        {activeTab === 'tools' && <AudioTools onSaveToLibrary={handleSaveToLibrary} uiLang={uiLang} />}
        {activeTab === 'library' && (
          <LibraryModal
            items={libraryItems}
            onDeleteItem={handleDeleteItem}
            onClearAll={handleClearLibrary}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 mt-12 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-200">VoiceTool Studio</span>
            <span>&bull;</span>
            <span>
              {isKhmer
                ? 'ដំណើរការក្នុងម៉ាស៊ីនផ្ទាល់ដោយគ្មានការពន្យារពេល'
                : 'Zero Server Latency Client-Side Processing'}
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <span className="hidden sm:inline flex items-center gap-1 text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              {isKhmer ? 'ឯកជនភាព ១០០% និងសំឡេងសុវត្ថិភាព' : '100% Privacy & Local Audio'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Web Audio &amp; Speech API
            </span>
            <span>WAV PCM Linear 16-bit</span>
            <span className="text-slate-500">&copy; 2026 VoiceTool</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
