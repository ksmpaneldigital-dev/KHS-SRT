import React, { useState, useEffect, useRef } from 'react';
import { VoiceProfile, SavedAudioItem } from '../types';
import { CURATED_VOICES, SAMPLE_SCRIPTS } from '../data/presets';
import { calculateTextStats } from '../utils/audioMath';
import { voiceEngine } from '../services/voiceEngine';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import { ExportSettingsModal } from './ExportSettingsModal';
import { AudioExportConfig, DEFAULT_EXPORT_CONFIG } from '../utils/audioMath';
import { VOICETOOL_ACTION_EVENT } from '../utils/keyboardShortcuts';
import {
  Volume2,
  Play,
  Square,
  Download,
  BookmarkPlus,
  Clock,
  Sparkles,
  Sliders,
  RotateCcw,
  Check,
  Languages,
  Settings2,
} from 'lucide-react';
import { AppLanguage } from '../types';

interface TtsStudioProps {
  onSaveToLibrary: (item: SavedAudioItem) => void;
  uiLang?: AppLanguage;
}

export const TtsStudio: React.FC<TtsStudioProps> = ({ onSaveToLibrary, uiLang = 'en' }) => {
  const isKhmer = uiLang === 'km';
  const [scriptText, setScriptText] = useState<string>(SAMPLE_SCRIPTS[0].text);
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(CURATED_VOICES[0]);
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');

  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isGeneratingWav, setIsGeneratingWav] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<AudioExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Available languages from curated voices
  const availableLanguages = [
    { code: 'all', label: 'All Languages / គ្រប់ភាសា' },
    { code: 'km-KH', label: '🇰🇭 Khmer (ភាសាខ្មែរ)' },
    { code: 'en-US', label: '🇺🇸 English (US)' },
    { code: 'en-GB', label: '🇬🇧 English (UK)' },
    { code: 'en-AU', label: '🇦🇺 English (AU)' },
    { code: 'en-IN', label: '🇮🇳 English (IN)' },
    { code: 'es-ES', label: '🇪🇸 Spanish' },
    { code: 'fr-FR', label: '🇫🇷 French' },
    { code: 'de-DE', label: '🇩🇪 German' },
    { code: 'ja-JP', label: '🇯🇵 Japanese' },
    { code: 'it-IT', label: '🇮🇹 Italian' },
  ];

  const filteredVoices = CURATED_VOICES.filter((voice) => {
    if (languageFilter !== 'all' && voice.lang !== languageFilter) return false;
    if (genderFilter !== 'all' && voice.gender !== genderFilter) return false;
    return true;
  });

  const stats = calculateTextStats(scriptText, Math.round(150 * rate));

  useEffect(() => {
    // Generate initial audio preview wav on first render
    handleGenerateWav(false);
  }, [selectedVoice, pitch, rate]);

  const handleInsertPause = (seconds: number) => {
    const pauseTag = ` [pause ${seconds}s] `;
    setScriptText((prev) => prev + pauseTag);
  };

  const handlePlayPreview = async () => {
    if (isPlaying) {
      voiceEngine.stopSpeaking();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setProgress(0);
      return;
    }

    setIsPlaying(true);
    setProgress(0);

    // Speak using neural/browser speech synthesis engine
    await voiceEngine.speakText(scriptText, {
      voiceProfile: selectedVoice,
      rate,
      pitch,
      volume,
      onStart: () => setIsPlaying(true),
      onProgress: (p) => setProgress(p / 100),
      onEnd: () => {
        setIsPlaying(false);
        setProgress(1);
        setTimeout(() => setProgress(0), 1000);
      },
      onError: () => setIsPlaying(false),
    });
  };

  const handleGenerateWav = (autoPlay: boolean = false) => {
    setIsGeneratingWav(true);
    try {
      const generated = voiceEngine.generateAudioWav(scriptText, {
        rate,
        pitchMultiplier: pitch,
        voiceGender: selectedVoice.gender,
      });

      setAudioUrl(generated.url);
      setAudioDuration(generated.duration);
      setIsSaved(false);

      if (autoPlay && audioRef.current) {
        audioRef.current.src = generated.url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Error generating WAV', e);
    } finally {
      setIsGeneratingWav(false);
    }
  };

  const handleSaveItem = () => {
    if (!audioUrl) {
      handleGenerateWav(false);
    }

    const newItem: SavedAudioItem = {
      id: `tts-${Date.now()}`,
      title: `${selectedVoice.name} - ${stats.wordCount} words`,
      type: 'tts',
      createdAt: Date.now(),
      durationSeconds: audioDuration || stats.estimatedSeconds,
      audioBlobUrl: audioUrl || undefined,
      transcript: scriptText.slice(0, 150) + (scriptText.length > 150 ? '...' : ''),
      voiceName: `${selectedVoice.name} (${selectedVoice.languageLabel})`,
      fileSizeFormatted: `${Math.round((audioDuration || 5) * 172)} KB`,
    };

    onSaveToLibrary(newItem);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleExportWithConfig = (cfg: AudioExportConfig) => {
    setExportConfig(cfg);
    const generated = voiceEngine.generateAudioWav(scriptText, {
      rate,
      pitchMultiplier: pitch,
      voiceGender: selectedVoice.gender,
      sampleRate: cfg.sampleRate,
      bitrate: cfg.bitrate,
      channels: cfg.channels,
      format: cfg.format,
    });

    const ext = cfg.format;
    const link = document.createElement('a');
    link.href = generated.url;
    link.download = `VoiceTool_${selectedVoice.name}_${(cfg.sampleRate / 1000).toFixed(1)}kHz_${cfg.bitrate}kbps_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Listen for keyboard shortcuts dispatched from global hub
  useEffect(() => {
    const handleAction = (e: any) => {
      const action = e.detail?.action;
      if (action === 'toggle-play') {
        handlePlayPreview();
      } else if (action === 'export') {
        setIsExportModalOpen(true);
      } else if (action === 'save-library') {
        handleSaveItem();
      } else if (action === 'close-modal') {
        setIsExportModalOpen(false);
      }
    };

    window.addEventListener(VOICETOOL_ACTION_EVENT, handleAction);
    return () => window.removeEventListener(VOICETOOL_ACTION_EVENT, handleAction);
  }, [isPlaying, scriptText, selectedVoice, rate, pitch, volume, audioUrl, audioDuration]);

  const handleAudioTimeUpdate = () => {
    if (audioRef.current && audioDuration > 0) {
      const current = audioRef.current.currentTime;
      setCurrentTime(current);
      setProgress(current / audioDuration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleSeek = (ratio: number) => {
    setProgress(ratio);
    if (audioRef.current && audioDuration > 0) {
      audioRef.current.currentTime = ratio * audioDuration;
      setCurrentTime(ratio * audioDuration);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Script Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            {isKhmer ? 'ស្ទូឌីយោបម្លែងអត្ថបទជាសំឡេង (AI Text to Speech)' : 'AI Text to Speech Studio'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isKhmer
              ? 'បម្លែងអត្ថបទជាសំឡេងនិយាយបែបធម្មជាតិ ជាមួយសំឡេងខ្មែរពិរោះៗ ការផ្អាកដកដង្ហើម និងការទាញយកកម្រិតខ្ពស់'
              : 'Convert scripts into natural speech with 300+ AI voice styles, custom pauses, and instant export.'}
          </p>
        </div>

        {/* Preset Picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">{isKhmer ? 'គំរូអត្ថបទ:' : 'Quick Presets:'}</span>
          {SAMPLE_SCRIPTS.slice(0, 4).map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setScriptText(preset.text);
                if (preset.title.includes('Khmer') || preset.title.includes('ខ្មែរ')) {
                  const khmerVoice = CURATED_VOICES.find((v) => v.lang === 'km-KH');
                  if (khmerVoice) setSelectedVoice(khmerVoice);
                }
              }}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Script Editor & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Script Text Box Card */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="script-textarea" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {isKhmer ? 'អត្ថបទស្គ្រីបសម្រាប់អាន' : 'Script / Narration Text'}
              </label>

              {/* Pause Insertion Tags */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {isKhmer ? 'បន្ថែមការផ្អាក:' : 'Add Pauses:'}
                </span>
                <button
                  onClick={() => handleInsertPause(0.5)}
                  className="px-2 py-0.5 text-[11px] rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 transition-colors"
                  title="Insert 0.5s pause tag"
                >
                  +0.5s
                </button>
                <button
                  onClick={() => handleInsertPause(1.0)}
                  className="px-2 py-0.5 text-[11px] rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 transition-colors"
                  title="Insert 1.0s pause tag"
                >
                  +1.0s
                </button>
                <button
                  onClick={() => setScriptText('')}
                  className="px-2 py-0.5 text-[11px] rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-2"
                >
                  {isKhmer ? 'សម្អាត' : 'Clear'}
                </button>
              </div>
            </div>

            <textarea
              id="script-textarea"
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              rows={7}
              placeholder={isKhmer ? 'សរសេរ ឬបិទភ្ជាប់អត្ថបទរបស់អ្នកនៅទីនេះដើម្បីបម្លែងជាសំឡេង...' : 'Type or paste your text here to synthesize voice...'}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y font-sans leading-relaxed"
            />

            {/* Script Metrics Bar */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60 gap-2">
              <div className="flex items-center gap-4">
                <span>
                  <strong className="text-slate-200">{stats.characterCount}</strong> {isKhmer ? 'តួអក្សរ' : 'chars'}
                </span>
                <span>
                  <strong className="text-slate-200">{stats.wordCount}</strong> {isKhmer ? 'ពាក្យ' : 'words'}
                </span>
                <span>
                  <strong className="text-slate-200">{stats.sentenceCount}</strong> {isKhmer ? 'ប្រយោគ' : 'sentences'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-300">
                <Clock className="w-3.5 h-3.5" />
                <span>{isKhmer ? 'រយៈពេលប៉ាន់ស្មាន:' : 'Est. Duration:'} <strong>{stats.estimatedSeconds}s</strong></span>
              </div>
            </div>
          </div>

          {/* Voice Tuning & Sliders Card */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Voice Parameters &amp; Modulation
              </h3>
              <button
                onClick={() => {
                  setRate(1.0);
                  setPitch(1.0);
                  setVolume(1.0);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Speed / Rate */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Speed (Rate)</span>
                  <span className="font-mono text-indigo-300 font-semibold">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.5x Slow</span>
                  <span>1.0x Normal</span>
                  <span>2.0x Fast</span>
                </div>
              </div>

              {/* Pitch */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Pitch</span>
                  <span className="font-mono text-indigo-300 font-semibold">{pitch.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Deep</span>
                  <span>Default</span>
                  <span>Higher</span>
                </div>
              </div>

              {/* Volume */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Volume</span>
                  <span className="font-mono text-indigo-300 font-semibold">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Mute</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Player & Waveform Visualizer */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                Live Audio Player &amp; Waveform
              </span>
              <span className="text-xs font-mono text-slate-400">
                {formatSeconds(currentTime)} / {formatSeconds(audioDuration || stats.estimatedSeconds)}
              </span>
            </div>

            {/* Interactive Visualizer Canvas */}
            <AudioWaveVisualizer
              isPlaying={isPlaying}
              progress={progress}
              onSeek={handleSeek}
              height={70}
              accentColor="#6366f1"
            />

            {/* Hidden native audio element for WAV playback */}
            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={handleAudioEnded}
            />

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPreview}
                  disabled={!scriptText.trim()}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer ${
                    isPlaying
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  } disabled:opacity-50`}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>{isKhmer ? 'បញ្ឈប់ការអាន' : 'Stop Speech'}</span>
                      <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-[10px] font-mono text-rose-200 font-bold">Space</kbd>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>{isKhmer ? 'ចាក់ស្តាប់សាកល្បង' : 'Preview Speech'}</span>
                      <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-[10px] font-mono text-indigo-200 font-bold">Space</kbd>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleGenerateWav(false)}
                  disabled={isGeneratingWav || !scriptText.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  title="Synthesize and render high-quality WAV audio file"
                >
                  <span>Re-render WAV</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Advanced Export Settings Button */}
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  disabled={!scriptText.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  title="Configure Sample Rate (44.1kHz / 48kHz) & Bitrate (128k, 192k, 320k) (E)"
                >
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    Settings ({(exportConfig.sampleRate / 1000).toFixed(1)}kHz &bull; {exportConfig.bitrate}k)
                  </span>
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-indigo-300 font-bold">E</kbd>
                </button>

                {/* Direct Download with Current Settings */}
                <button
                  onClick={() => handleExportWithConfig(exportConfig)}
                  disabled={!scriptText.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ({exportConfig.format.toUpperCase()} &bull; {(exportConfig.sampleRate / 1000).toFixed(1)}kHz)</span>
                </button>

                {/* Save to Library */}
                <button
                  onClick={handleSaveItem}
                  disabled={!scriptText.trim()}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Save</span>
                      <kbd className="ml-1 px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">S</kbd>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Export Parameters Status Pill */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Export Format:</span>
                <span className="text-slate-300 font-mono font-medium">{exportConfig.format.toUpperCase()}</span>
                <span>&bull;</span>
                <span className="text-slate-300 font-mono font-medium">{(exportConfig.sampleRate / 1000).toFixed(1)} kHz</span>
                <span>&bull;</span>
                <span className="text-slate-300 font-mono font-medium">{exportConfig.bitrate} kbps</span>
                <span>&bull;</span>
                <span className="text-slate-300 capitalize">{exportConfig.channels}</span>
              </div>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
              >
                Change Sample Rate &amp; Bitrate &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Export Settings Modal */}
        <ExportSettingsModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          durationSeconds={audioDuration || stats.estimatedSeconds}
          initialConfig={exportConfig}
          onExport={handleExportWithConfig}
          title="TTS Audio Export Settings"
          defaultFilename={`VoiceTool_${selectedVoice.name}`}
        />

        {/* Right Column: Voice Selection Studio (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-indigo-400" />
                Select AI Voice Model
              </h3>
              <span className="text-xs text-indigo-400 font-medium">
                {filteredVoices.length} Voices
              </span>
            </div>

            {/* Filters (Language & Gender) */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {availableLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>

              <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
                {(['all', 'female', 'male'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`flex-1 py-1 text-[11px] font-medium rounded capitalize transition-colors ${
                      genderFilter === g
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Voices List */}
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {filteredVoices.map((voice) => {
                const isSelected = selectedVoice.id === voice.id;
                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/70 shadow-sm shadow-indigo-500/20'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{voice.country}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{voice.name}</span>
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase ${
                                voice.gender === 'female'
                                  ? 'bg-pink-500/20 text-pink-300'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {voice.gender}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block">{voice.languageLabel}</span>
                        </div>
                      </div>

                      {/* Preview quick button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVoice(voice);
                          voiceEngine.speakText(voice.sampleText || 'Hello, this is my voice.', {
                            voiceProfile: voice,
                            rate,
                            pitch,
                            volume,
                          });
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1"
                        title="Audition voice"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Sample</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-1 italic">
                      "{voice.tone}"
                    </p>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {voice.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
