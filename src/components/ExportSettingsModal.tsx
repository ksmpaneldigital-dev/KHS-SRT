import React, { useState } from 'react';
import { AudioExportConfig, calculateEstimatedFileSize } from '../utils/audioMath';
import {
  Download,
  Sliders,
  X,
  FileAudio,
  Radio,
  Check,
  Zap,
  Info,
} from 'lucide-react';

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  durationSeconds: number;
  initialConfig?: AudioExportConfig;
  onExport: (config: AudioExportConfig) => void;
  title?: string;
  defaultFilename?: string;
}

export const ExportSettingsModal: React.FC<ExportSettingsModalProps> = ({
  isOpen,
  onClose,
  durationSeconds,
  initialConfig,
  onExport,
  title = 'Advanced Audio Export Settings',
  defaultFilename = 'voicetool_audio',
}) => {
  const [config, setConfig] = useState<AudioExportConfig>(
    initialConfig || {
      format: 'wav',
      sampleRate: 44100,
      bitrate: 192,
      channels: 'mono',
      normalizeGain: true,
    }
  );

  if (!isOpen) return null;

  const fileSize = calculateEstimatedFileSize(durationSeconds, config);

  const sampleRateOptions = [
    {
      value: 44100,
      label: '44.1 kHz (44,100 Hz)',
      badge: 'CD / Web Standard',
      desc: 'Industry standard for music, podcasts and streaming web audio.',
    },
    {
      value: 48000,
      label: '48.0 kHz (48,000 Hz)',
      badge: 'Broadcast / Video Sync',
      desc: 'Optimal for video editing (Premiere, DaVinci, Final Cut) and television.',
    },
    {
      value: 24000,
      label: '24.0 kHz (24,000 Hz)',
      badge: 'Neural Speech Optimized',
      desc: 'High efficiency with clear voice fidelity and reduced file size.',
    },
    {
      value: 16000,
      label: '16.0 kHz (16,000 Hz)',
      badge: 'Compact Speech',
      desc: 'Low bandwidth option for speech recognition and telephony.',
    },
  ];

  const bitrateOptions = [
    { value: 128, label: '128 kbps', desc: 'Standard Voice (Compact)' },
    { value: 192, label: '192 kbps', desc: 'High Quality Narration (Recommended)' },
    { value: 256, label: '256 kbps', desc: 'Very High Clarity' },
    { value: 320, label: '320 kbps', desc: 'Maximum Studio Quality (Master)' },
  ];

  const handleConfirm = () => {
    onExport(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90">
      <div
        className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 id="export-modal-title" className="text-base font-bold text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-400">
                Configure sample rate, bitrate, format, and channel allocation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Format Tabs */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 block">
              Audio Container Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfig({ ...config, format: 'wav' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.format === 'wav'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">WAV (.wav)</span>
                  {config.format === 'wav' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  16-bit Linear PCM &bull; Lossless studio quality &bull; Zero compression artifacts
                </p>
              </button>

              <button
                type="button"
                onClick={() => setConfig({ ...config, format: 'mp3' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.format === 'mp3'
                    ? 'bg-indigo-950/50 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">MP3 (.mp3)</span>
                  {config.format === 'mp3' && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  MPEG Layer-3 &bull; Universal compatibility &bull; Highly compressed file size
                </p>
              </button>
            </div>
          </div>

          {/* Sample Rate Adjustment (44.1kHz vs 48kHz vs 24kHz) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Sample Rate (Frequency Sampling)
              </label>
              <span className="text-xs font-mono text-indigo-400 font-semibold">
                {(config.sampleRate / 1000).toFixed(1)} kHz
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sampleRateOptions.map((opt) => {
                const isSelected = config.sampleRate === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => setConfig({ ...config, sampleRate: opt.value })}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 text-white'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.label}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{opt.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bitrate Options (128kbps, 192kbps, 320kbps) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Bitrate Encoding Rate
              </label>
              <span className="text-xs font-mono text-indigo-400 font-semibold">
                {config.bitrate} kbps
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bitrateOptions.map((b) => {
                const isSelected = config.bitrate === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setConfig({ ...config, bitrate: b.value })}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-xs font-mono">{b.label}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{b.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channels Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
                Channels
              </label>
              <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-1">
                {(['mono', 'stereo'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setConfig({ ...config, channels: ch })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                      config.channels === ch
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ch === 'mono' ? 'Mono (Speech)' : 'Stereo (Spatial)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 block">
                Dynamics &amp; Gain
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.normalizeGain ?? true}
                  onChange={(e) => setConfig({ ...config, normalizeGain: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>Auto-Normalize Peak to -0.5 dB</span>
              </label>
            </div>
          </div>

          {/* Live Estimated File Info Box */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <FileAudio className="w-5 h-5 text-indigo-400" />
              <div>
                <span className="font-semibold text-white">
                  {defaultFilename}.{config.format}
                </span>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{(config.sampleRate / 1000).toFixed(1)} kHz</span>
                  <span>&bull;</span>
                  <span>{config.bitrate} kbps</span>
                  <span>&bull;</span>
                  <span className="capitalize">{config.channels}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Est. Size</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {fileSize.formatted}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>
              Export as {config.format.toUpperCase()} ({(config.sampleRate / 1000).toFixed(1)} kHz / {config.bitrate} kbps)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
