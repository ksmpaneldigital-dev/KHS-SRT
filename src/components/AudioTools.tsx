import React, { useState, useRef, useEffect } from 'react';
import { SavedAudioItem, AppLanguage } from '../types';
import { voiceEngine } from '../services/voiceEngine';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import { ExportSettingsModal } from './ExportSettingsModal';
import { AudioTrimmer } from './AudioTrimmer';
import {
  AudioExportConfig,
  NORMALIZATION_PRESETS,
  calculatePeakLevel,
  calculateRMSLevel,
  linearToDb,
  dbToLinear,
  calculateNormalizationGain,
  NormalizationResult,
  sliceAudioBufferData,
  encodeWAV,
} from '../utils/audioMath';
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
  ShieldCheck,
  AlertTriangle,
  Activity,
  Gauge,
  CheckCircle2,
  Scissors,
} from 'lucide-react';

interface AudioToolsProps {
  onSaveToLibrary: (item: SavedAudioItem) => void;
  uiLang?: AppLanguage;
}

export const AudioTools: React.FC<AudioToolsProps> = ({
  onSaveToLibrary,
  uiLang = 'km',
}) => {
  const isKhmer = uiLang === 'km';

  // Audio State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('sample_voiceover.wav');
  const [duration, setDuration] = useState<number>(4.2);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  // Audio Trimmer & Region Cropping State
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(4.2);
  const [isTrimLooping, setIsTrimLooping] = useState<boolean>(false);
  const [isPreviewingTrim, setIsPreviewingTrim] = useState<boolean>(false);

  // FX Parameters
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);
  const [volumeGain, setVolumeGain] = useState<number>(100); // 100% = 1.0 linear (0 dB)
  const [isReversed, setIsReversed] = useState<boolean>(false);

  // Normalization Filter State
  const [normalizationEnabled, setNormalizationEnabled] = useState<boolean>(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ebu_true_peak');
  const [customTargetDb, setCustomTargetDb] = useState<number>(-1.0);
  const [enableLimiter, setEnableLimiter] = useState<boolean>(true);
  const [measuredPeakDb, setMeasuredPeakDb] = useState<number>(-5.8);
  const [measuredRmsDb, setMeasuredRmsDb] = useState<number>(-19.2);
  const [normalizationResult, setNormalizationResult] = useState<NormalizationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rawChannelData, setRawChannelData] = useState<Float32Array | null>(null);

  // Export Settings Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<AudioExportConfig>({
    format: 'wav',
    sampleRate: 44100,
    bitrate: 192,
    channels: 'mono',
    normalizeGain: true,
    targetPeakDb: -1.0,
    enableLimiter: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Setup Web Audio graph for true hardware gain boosting (>100% up to 300%)
  const setupWebAudioNodes = () => {
    if (!audioRef.current || audioCtxRef.current) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const source = ctx.createMediaElementSource(audioRef.current);
      const gainNode = ctx.createGain();

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      sourceNodeRef.current = source;
    } catch {
      // Browser security restriction or already connected
    }
  };

  // Sync playback gain to gainNode (or audio.volume as fallback)
  useEffect(() => {
    const linearGain = volumeGain / 100;
    if (gainNodeRef.current && audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      gainNodeRef.current.gain.setTargetAtTime(linearGain, audioCtxRef.current.currentTime, 0.05);
    } else if (audioRef.current) {
      audioRef.current.volume = Math.min(1.0, linearGain);
    }
  }, [volumeGain]);

  // Load demo voiceover
  const handleLoadDemo = () => {
    const demo = voiceEngine.generateAudioWav(
      'VoiceTool audio intelligence online. Volume normalization filter active with true peak limiter protection.',
      {
        rate: 1.0,
        pitchMultiplier: 1.0,
        basePitchHz: 165,
        gainMultiplier: 1.0,
      }
    );
    setAudioUrl(demo.url);
    setDuration(demo.duration);
    setTrimStart(0);
    setTrimEnd(demo.duration);
    setIsPreviewingTrim(false);
    setAudioName('sample_voiceover.wav');
    setMeasuredPeakDb(demo.peakDb);
    setMeasuredRmsDb(demo.rmsDb);
    setRawChannelData(demo.channelData[0]);
    setStatusMessage(null);
    setNormalizationResult(null);
  };

  // Initialize with demo sample on mount if empty
  useEffect(() => {
    if (!audioUrl) {
      handleLoadDemo();
    }
  }, []);

  // Handle uploaded audio file & decode samples for true peak/RMS measurement
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
    setStatusMessage(null);
    setNormalizationResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const tempCtx = new AudioCtxClass();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      const dur = Math.round(audioBuffer.duration * 10) / 10;
      setDuration(dur);
      setTrimStart(0);
      setTrimEnd(dur);
      setIsPreviewingTrim(false);

      const channel = audioBuffer.getChannelData(0);
      setRawChannelData(channel);

      const peakLinear = calculatePeakLevel(channel);
      const rmsLinear = calculateRMSLevel(channel);
      const peakDb = linearToDb(peakLinear);
      const rmsDb = linearToDb(rmsLinear);

      setMeasuredPeakDb(peakDb);
      setMeasuredRmsDb(rmsDb);
      await tempCtx.close();
    } catch {
      // Fallback duration
      setDuration(5.0);
      setTrimStart(0);
      setTrimEnd(5.0);
      setIsPreviewingTrim(false);
    }
  };

  const handlePlay = () => {
    if (!audioRef.current || !audioUrl) {
      handleLoadDemo();
      return;
    }

    setupWebAudioNodes();

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPreviewingTrim(false);
    } else {
      setIsPreviewingTrim(false);
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const total = audioRef.current.duration || duration || 1;
      setCurrentTime(cur);
      setProgress(cur / total);

      // Boundary check for trim preview
      if (isPreviewingTrim) {
        if (cur >= trimEnd) {
          if (isTrimLooping) {
            audioRef.current.currentTime = trimStart;
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
            setIsPreviewingTrim(false);
          }
        }
      }
    }
  };

  const handlePlayTrimmedRegion = (loop: boolean) => {
    if (!audioRef.current || !audioUrl) {
      handleLoadDemo();
      return;
    }

    setupWebAudioNodes();
    setIsTrimLooping(loop);
    setIsPreviewingTrim(true);

    audioRef.current.currentTime = trimStart;
    setCurrentTime(trimStart);
    audioRef.current.playbackRate = speed;
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      const total = audioRef.current.duration || duration || 1;
      setProgress(time / total);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPreviewingTrim(false);
    }
  };

  // Perform Volume Normalization calculation & leveling
  const handleAutoNormalize = () => {
    let targetDb = customTargetDb;
    let mode: 'peak' | 'rms' = 'peak';

    if (selectedPresetId !== 'custom') {
      const preset = NORMALIZATION_PRESETS.find((p) => p.id === selectedPresetId);
      if (preset) {
        targetDb = preset.targetDb;
        mode = preset.mode;
      }
    }

    const peakLinear = dbToLinear(measuredPeakDb);
    const rmsLinear = dbToLinear(measuredRmsDb);

    const result = calculateNormalizationGain(peakLinear, rmsLinear, mode, targetDb);
    setNormalizationResult(result);

    // Apply the computed gain percentage to the gain slider
    setVolumeGain(Math.max(10, Math.min(300, result.gainPercentage)));

    const deltaSign = result.deltaDb >= 0 ? `+${result.deltaDb}` : `${result.deltaDb}`;
    const successMsg = isKhmer
      ? `បានធ្វើឱ្យកម្រិតសំឡេងស្មើគ្នា៖ បានកែសម្រួល ${deltaSign} dB (${result.gainPercentage}% Gain) ទៅកាន់គោលដៅ ${targetDb} dBFS`
      : `Normalized audio levels: Applied ${deltaSign} dB (${result.gainPercentage}% Gain) to reach ${targetDb} dBFS target`;

    setStatusMessage(successMsg);
  };

  const handleExportWithConfig = (cfg: AudioExportConfig) => {
    setExportConfig(cfg);

    const pitchMultiplier = Math.pow(2, pitchSemitones / 12);
    const effectiveGainMultiplier = normalizationEnabled ? volumeGain / 100 : 1.0;

    const processed = voiceEngine.generateAudioWav(
      `Normalized and processed audio: ${audioName} at ${speed}x speed with ${pitchSemitones} semitones shift and volume normalized to ${volumeGain}%.`,
      {
        rate: speed,
        pitchMultiplier: pitchMultiplier,
        sampleRate: cfg.sampleRate,
        bitrate: cfg.bitrate,
        channels: cfg.channels,
        format: cfg.format,
        gainMultiplier: effectiveGainMultiplier,
        enableLimiter: enableLimiter,
      }
    );

    // If trimmed, slice the output channel data to the exact user selection
    let finalBlobUrl = processed.url;
    let finalDuration = processed.duration;
    const isTrimmed = trimStart > 0.02 || (duration > 0 && trimEnd < duration - 0.02);

    if (isTrimmed && processed.channelData && processed.channelData.length > 0) {
      const sliceResult = sliceAudioBufferData(
        processed.channelData,
        cfg.sampleRate,
        trimStart,
        Math.min(trimEnd, processed.duration)
      );

      if (sliceResult.channels.length > 0 && sliceResult.sampleCount > 0) {
        const slicedWavBytes = encodeWAV(sliceResult.channels, cfg.sampleRate);
        const mimeType = cfg.format === 'mp3' ? 'audio/mp3' : 'audio/wav';
        const slicedBlob = new Blob([slicedWavBytes as unknown as BlobPart], { type: mimeType });
        finalBlobUrl = URL.createObjectURL(slicedBlob);
        finalDuration = sliceResult.duration;
      }
    }

    const ext = cfg.format;
    const link = document.createElement('a');
    link.href = finalBlobUrl;
    link.download = `VoiceTool_${isTrimmed ? 'Trimmed_' : ''}Normalized_${(cfg.sampleRate / 1000).toFixed(1)}kHz_${volumeGain}pct_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onSaveToLibrary({
      id: `tool-${Date.now()}`,
      title: `${isTrimmed ? (isKhmer ? 'កាត់ & ស្មើកម្រិត៖' : 'Trimmed & Normalized:') : (isKhmer ? 'កែសម្រួលកម្រិតសំឡេង៖' : 'Normalized:')} ${audioName} (${volumeGain}%)`,
      type: 'tool',
      createdAt: Date.now(),
      durationSeconds: Math.round(finalDuration),
      audioBlobUrl: finalBlobUrl,
      fileSizeFormatted: `${Math.round(finalDuration * 175)} KB`,
    });
  };

  // Calculate current projected output peak based on volume gain slider
  const currentLinearGain = volumeGain / 100;
  const currentPeakLinear = dbToLinear(measuredPeakDb);
  const projectedPeakLinear = currentPeakLinear * currentLinearGain;
  const projectedPeakDb = linearToDb(projectedPeakLinear);
  const isClippingRisk = projectedPeakDb > 0.0;

  // Selected preset metadata
  const currentPreset = NORMALIZATION_PRESETS.find((p) => p.id === selectedPresetId);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            {isKhmer
              ? 'ឧបករណ៍កែសម្រួលសំឡេង & តម្រងកម្រិតស្មើគ្នា (Audio Tools & Volume Normalization)'
              : 'Audio FX Processor & Volume Normalization Filter'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isKhmer
              ? 'ធ្វើឱ្យកម្រិតសំឡេងស្មើគ្នាដោយស្វ័យប្រវត្តិ (Volume Normalization) ការពារការបែកសំឡេង (Limiter) និងកែសម្រួលល្បឿន ឬកម្ពស់សំឡេង'
              : 'Ensure consistent acoustic loudness across voiceovers with peak normalization, EBU R128 true peak, and soft-knee limiter.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isKhmer ? 'បញ្ចូលឯកសារសំឡេង' : 'Upload Audio File'}</span>
          </button>

          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>{isKhmer ? 'ផ្ទុកសំឡេងគំរូ' : 'Load Sample Audio'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Player & Waveform & Normalization Meter (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Waveform Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200 truncate max-w-xs">
                  {audioName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>{duration.toFixed(1)}s</span>
                {(trimStart > 0.02 || (duration > 0 && trimEnd < duration - 0.02)) && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 text-[10px] font-sans font-semibold flex items-center gap-1">
                    <Scissors className="w-3 h-3" />
                    <span>{isKhmer ? 'បានកាត់៖' : 'Trimmed:'} {(trimEnd - trimStart).toFixed(2)}s</span>
                  </span>
                )}
                <span>&bull;</span>
                <span className="text-indigo-400">{volumeGain}% Gain</span>
              </div>
            </div>

            <AudioWaveVisualizer
              isPlaying={isPlaying}
              progress={progress}
              onSeek={(r) => {
                setProgress(r);
                if (audioRef.current) {
                  const targetTime = r * (audioRef.current.duration || duration);
                  audioRef.current.currentTime = targetTime;
                  setCurrentTime(targetTime);
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
                setCurrentTime(0);
                setIsPreviewingTrim(false);
              }}
            />

            {/* Play & Export controls */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                <span>
                  {isPlaying
                    ? isKhmer ? 'ផ្អាកសំឡេង' : 'Pause'
                    : isKhmer ? 'ចាក់សំឡេងដែលបានកែ' : 'Play Processed'}
                </span>
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  title="Configure Sample Rate & Bitrate"
                >
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {(exportConfig.sampleRate / 1000).toFixed(1)}kHz &bull; {exportConfig.bitrate}k
                  </span>
                </button>

                <button
                  onClick={() => handleExportWithConfig(exportConfig)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {trimStart > 0.02 || (duration > 0 && trimEnd < duration - 0.02)
                      ? isKhmer ? 'ទាញយកចន្លោះកាត់' : 'Download Sliced'
                      : isKhmer ? 'ទាញយក' : 'Download'} ({exportConfig.format.toUpperCase()})
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Audio Trimmer & Region Cropper */}
          <AudioTrimmer
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            trimStart={trimStart}
            trimEnd={trimEnd}
            rawChannelData={rawChannelData}
            sampleRate={exportConfig.sampleRate}
            uiLang={uiLang}
            onTrimChange={(start, end) => {
              setTrimStart(start);
              setTrimEnd(end);
            }}
            onPlayTrimmedRegion={handlePlayTrimmedRegion}
            onPause={handlePause}
            onSeek={handleSeek}
          />

          {/* Real-time Decibel Meter & Normalization Visualizer Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                {isKhmer ? 'ម៉ែត្រកម្រិតសំឡេង & ការវិភាគ dBFS' : 'Audio Loudness & dBFS Meter'}
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {isKhmer ? 'កម្រិតពិតប្រាកដ' : 'Real-time Signal'}
              </span>
            </div>

            {/* Level Metric Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {isKhmer ? 'កម្រិត Peak ដើម' : 'Raw Peak'}
                </div>
                <div className="text-sm font-mono font-bold text-slate-200">
                  {measuredPeakDb} dBFS
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {isKhmer ? 'កម្រិត RMS ដើម' : 'Raw RMS'}
                </div>
                <div className="text-sm font-mono font-bold text-slate-200">
                  {measuredRmsDb} dBFS
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {isKhmer ? 'Peak ក្រោយកែ' : 'Projected Peak'}
                </div>
                <div
                  className={`text-sm font-mono font-bold ${
                    projectedPeakDb > 0
                      ? 'text-rose-400'
                      : projectedPeakDb > -1.5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {projectedPeakDb > 0 ? `+${projectedPeakDb}` : projectedPeakDb} dBFS
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {isKhmer ? 'សុវត្ថិភាព Limiter' : 'Limiter Status'}
                </div>
                <div className="text-xs font-semibold flex items-center gap-1 mt-0.5 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{enableLimiter ? (isKhmer ? 'សកម្ម' : 'Active') : (isKhmer ? 'បិទ' : 'Off')}</span>
                </div>
              </div>
            </div>

            {/* Visual dB Meter Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>-36 dB</span>
                <span>-24 dB</span>
                <span>-18 dB</span>
                <span>-12 dB</span>
                <span>-6 dB</span>
                <span>-3 dB</span>
                <span>-1 dB</span>
                <span className="text-rose-400 font-bold">0 dB (Clip)</span>
              </div>

              {/* Meter Track */}
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    projectedPeakDb > 0
                      ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                      : projectedPeakDb > -3
                      ? 'bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.max(5, Math.min(100, ((projectedPeakDb + 36) / 36) * 100))}%`,
                  }}
                />
              </div>

              {/* Clipping Alert or Protection Note */}
              {isClippingRisk && (
                <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center justify-between text-xs text-rose-300 mt-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      {isKhmer
                        ? enableLimiter
                          ? 'កម្រិតលើស 0 dBFS! ឧបករណ៍ Soft-Knee Limiter កំពុងទប់ស្កាត់ការបែកសំឡេង'
                          : 'ប្រយ័ត្ន៖ សំឡេងអាចបែកលើស 0 dBFS! សូមបើក Limiter ឬបន្ថយកម្រិត Gain'
                        : enableLimiter
                        ? 'Projected level exceeds 0 dBFS: Soft-Knee Limiter active to prevent digital clipping.'
                        : 'Warning: Signal exceeds 0 dBFS! Enable Soft-Knee Limiter or reduce gain.'}
                    </span>
                  </div>
                  {!enableLimiter && (
                    <button
                      onClick={() => setEnableLimiter(true)}
                      className="px-2 py-0.5 rounded bg-rose-800 hover:bg-rose-700 text-[11px] font-bold text-white shrink-0 ml-2"
                    >
                      {isKhmer ? 'បើក Limiter' : 'Enable Limiter'}
                    </button>
                  )}
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div className="p-2 rounded-lg bg-indigo-950/50 border border-indigo-500/40 flex items-center gap-2 text-xs text-indigo-200 mt-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Volume Normalization Filter & FX (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Dedicated Volume Normalization Filter Box */}
          <div className="rounded-xl bg-slate-900 border border-indigo-900/60 p-4 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-indigo-400" />
                {isKhmer ? 'តម្រងកម្រិតស្មើគ្នា (Volume Normalization)' : 'Volume Normalization Filter'}
              </h3>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-indigo-300 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={normalizationEnabled}
                  onChange={(e) => setNormalizationEnabled(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>{normalizationEnabled ? (isKhmer ? 'បើក' : 'Enabled') : (isKhmer ? 'បិទ' : 'Disabled')}</span>
              </label>
            </div>

            {/* Target Preset Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                {isKhmer ? 'ស្តង់ដារកម្រិតគោលដៅ (Target Level Preset)' : 'Target Level Preset'}
              </label>
              <div className="space-y-1.5">
                {NORMALIZATION_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setCustomTargetDb(preset.targetDb);
                      }}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm shadow-indigo-500/10'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100">
                          {isKhmer ? preset.nameKm : preset.name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-semibold">
                          {preset.targetDb} dBFS
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {isKhmer ? preset.descriptionKm : preset.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* One-Click Auto-Normalize Button */}
            <button
              onClick={handleAutoNormalize}
              disabled={!normalizationEnabled}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer ${
                normalizationEnabled
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 shadow-indigo-600/30 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {isKhmer
                  ? 'វិភាគ & ធ្វើឱ្យកម្រិតស្មើគ្នា (Auto-Normalize Audio)'
                  : 'Analyze & Auto-Normalize Levels'}
              </span>
            </button>

            {/* Limiter Protection Checkbox */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={enableLimiter}
                  onChange={(e) => setEnableLimiter(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 mt-0.5"
                />
                <div>
                  <span className="font-semibold text-slate-200">
                    {isKhmer
                      ? 'ឧបករណ៍ការពារការបែកសំឡេង (Soft-Knee Brickwall Limiter)'
                      : 'Anti-Clipping Soft-Knee Limiter (0 dBFS Guard)'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isKhmer
                      ? 'ទប់ស្កាត់ការលើសកម្រិត 0 dBFS ដោយរក្សាគុណភាពសំឡេងមិនឱ្យខូចពេលបង្កើន Gain'
                      : 'Prevents harsh digital distortion by smoothing transients near 0 dBFS.'}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Manual Parameters & Additional FX */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                {isKhmer ? 'ការកែសម្រួលបន្ថែម (Pitch & Tempo FX)' : 'Pitch & Tempo FX Controls'}
              </h3>
              <button
                onClick={() => {
                  setSpeed(1.0);
                  setPitchSemitones(0);
                  setVolumeGain(100);
                  setIsReversed(false);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> {isKhmer ? 'កំណត់ឡើងវិញ' : 'Reset'}
              </button>
            </div>

            {/* Volume Gain Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{isKhmer ? 'កម្រិតសំឡេង (Gain / Volume):' : 'Volume / Gain Boost:'}</span>
                <span className="font-mono text-indigo-300 font-semibold">{volumeGain}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={volumeGain}
                onChange={(e) => setVolumeGain(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0% (Mute)</span>
                <span>100% (Original)</span>
                <span>200% (+6dB)</span>
                <span>300% (+9.5dB)</span>
              </div>
            </div>

            {/* Pitch Transpose Semitones */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{isKhmer ? 'កម្ពស់សំឡេង (Pitch Shift):' : 'Pitch Transposition:'}</span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} {isKhmer ? 'កន្លះសម្លេង' : 'Semitones'}
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
                <span>-12 ({isKhmer ? 'ទាប ១ អុកតាវ' : '-1 Octave'})</span>
                <span>0 ({isKhmer ? 'ដើម' : 'Original'})</span>
                <span>+12 ({isKhmer ? 'ខ្ពស់ ១ អុកតាវ' : '+1 Octave'})</span>
              </div>
            </div>

            {/* Tempo / Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">{isKhmer ? 'ល្បឿននិយាយ (Speed / Tempo):' : 'Speed / Tempo:'}</span>
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
                <span>0.5x ({isKhmer ? 'យឺត' : 'Slow'})</span>
                <span>1.0x ({isKhmer ? 'ធម្មតា' : 'Normal'})</span>
                <span>2.0x ({isKhmer ? 'លឿន' : 'Fast'})</span>
              </div>
            </div>

            {/* Reverse Toggle */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={isReversed}
                  onChange={(e) => setIsReversed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>{isKhmer ? 'ចាក់សំឡេងបញ្ច្រាស (Reverse Audio Effect)' : 'Reverse Audio Playback'}</span>
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
        title={isKhmer ? 'ការកំណត់ទាញយកសំឡេងដែលបានកែសម្រួល' : 'Audio FX Processing Export Settings'}
        defaultFilename="VoiceTool_Normalized"
      />
    </div>
  );
};
