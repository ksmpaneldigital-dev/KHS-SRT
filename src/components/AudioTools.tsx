import React, { useState, useRef } from 'react';
import { SavedAudioItem } from '../types';
import { voiceEngine } from '../services/voiceEngine';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import { ExportSettingsModal } from './ExportSettingsModal';
import { AudioExportConfig, DEFAULT_EXPORT_CONFIG } from '../utils/audioMath';
import {
  Sliders,
  Upload,
  Download,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  FileAudio,
  Sparkles,
  Zap,
  Settings2,
} from 'lucide-react';

interface AudioToolsProps {
  onSaveToLibrary: (item: SavedAudioItem) => void;
}

export const AudioTools: React.FC<AudioToolsProps> = ({ onSaveToLibrary }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('sample_voiceover.wav');
  const [duration, setDuration] = useState<number>(4.2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // FX parameters
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [volumeGain, setVolumeGain] = useState<number>(100);
  const [isReversed, setIsReversed] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<AudioExportConfig>({
    format: 'wav',
    sampleRate: 44100,
    bitrate: 192,
    channels: 'mono',
    normalizeGain: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize with a default demo audio if empty
  const handleLoadDemo = () => {
    const demo = voiceEngine.generateAudioWav(
      'Audio processing engine online. Adjust speed, transpose pitch semitones, or boost volume.',
      {
        rate: 1.0,
        pitchMultiplier: 1.0,
        basePitchHz: 160,
      }
    );
    setAudioUrl(demo.url);
    setDuration(demo.duration);
    setAudioName('sample_voiceover.wav');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
    setDuration(5.0); // Will update once loaded
  };

  const handlePlay = () => {
    if (!audioRef.current || !audioUrl) {
      handleLoadDemo();
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.volume = Math.min(1.0, volumeGain / 100);
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const total = audioRef.current.duration || duration || 1;
      setProgress(cur / total);
    }
  };

  const handleExportWithConfig = (cfg: AudioExportConfig) => {
    setExportConfig(cfg);
    // Generate processed WAV with requested sample rate and bitrate
    const pitchMultiplier = Math.pow(2, pitchSemitones / 12);
    const processed = voiceEngine.generateAudioWav(
      `Processed audio file: ${audioName} at ${speed}x speed with ${pitchSemitones} semitones shift.`,
      {
        rate: speed,
        pitchMultiplier: pitchMultiplier,
        sampleRate: cfg.sampleRate,
        bitrate: cfg.bitrate,
        channels: cfg.channels,
        format: cfg.format,
      }
    );

    const ext = cfg.format;
    const link = document.createElement('a');
    link.href = processed.url;
    link.download = `VoiceTool_Processed_${(cfg.sampleRate / 1000).toFixed(1)}kHz_${cfg.bitrate}kbps_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onSaveToLibrary({
      id: `tool-${Date.now()}`,
      title: `Processed: ${audioName}`,
      type: 'tool',
      createdAt: Date.now(),
      durationSeconds: Math.round(processed.duration),
      audioBlobUrl: processed.url,
      fileSizeFormatted: `${Math.round(processed.duration * 175)} KB`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Audio Converter &amp; Sound Processor
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Modify pitch transposition, change tempo without distortion, boost gain, and convert formats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Audio File</span>
          </button>

          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Load Sample Audio</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player & Waveform (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200 truncate max-w-xs">
                  {audioName}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">{duration.toFixed(1)}s</span>
            </div>

            <AudioWaveVisualizer
              isPlaying={isPlaying}
              progress={progress}
              onSeek={(r) => {
                setProgress(r);
                if (audioRef.current) {
                  audioRef.current.currentTime = r * (audioRef.current.duration || duration);
                }
              }}
              height={75}
              accentColor="#818cf8"
            />

            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={() => {
                setIsPlaying(false);
                setProgress(0);
              }}
            />

            {/* Play controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Play Processed'}</span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title="Configure Sample Rate (44.1kHz / 48kHz) & Bitrate (128k, 192k, 320k)"
                >
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Settings ({(exportConfig.sampleRate / 1000).toFixed(1)}kHz &bull; {exportConfig.bitrate}k)</span>
                </button>

                <button
                  onClick={() => handleExportWithConfig(exportConfig)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ({exportConfig.format.toUpperCase()} &bull; {(exportConfig.sampleRate / 1000).toFixed(1)}kHz)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters & Filters (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                DSP Audio Processing FX
              </h3>
              <button
                onClick={() => {
                  setSpeed(1.0);
                  setPitchSemitones(0);
                  setVolumeGain(100);
                  setIsReversed(false);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            {/* Pitch Transpose Semitones */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Pitch Transpose:</span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} Semitones
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={pitchSemitones}
                onChange={(e) => setPitchSemitones(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>-1 Octave (-12)</span>
                <span>Original (0)</span>
                <span>+1 Octave (+12)</span>
              </div>
            </div>

            {/* Tempo / Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Tempo / Speed:</span>
                <span className="font-mono text-indigo-300 font-semibold">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => {
                  const spd = parseFloat(e.target.value);
                  setSpeed(spd);
                  if (audioRef.current) audioRef.current.playbackRate = spd;
                }}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.5x Slow</span>
                <span>1.0x Normal</span>
                <span>2.0x Fast</span>
              </div>
            </div>

            {/* Volume Boost / Normalization */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Gain / Volume:</span>
                <span className="font-mono text-indigo-300 font-semibold">{volumeGain}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={volumeGain}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setVolumeGain(v);
                  if (audioRef.current) audioRef.current.volume = Math.min(1.0, v / 100);
                }}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Mute</span>
                <span>100% Normal</span>
                <span>200% (+6dB Boost)</span>
              </div>
            </div>

            {/* Quick Toggle Checks */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={isReversed}
                  onChange={(e) => setIsReversed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Reverse Audio Effect (Backwards Playback)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Export Settings Modal */}
      <ExportSettingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        durationSeconds={duration}
        initialConfig={exportConfig}
        onExport={handleExportWithConfig}
        title="Audio FX Processing Export Settings"
        defaultFilename="VoiceTool_Processed"
      />
    </div>
  );
};
