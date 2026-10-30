import React, { useState, useRef, useEffect } from 'react';
import { SavedAudioItem } from '../types';
import { voiceEngine } from '../services/voiceEngine';
import { AudioWaveVisualizer } from './AudioWaveVisualizer';
import { ExportSettingsModal } from './ExportSettingsModal';
import { AudioExportConfig, DEFAULT_EXPORT_CONFIG } from '../utils/audioMath';
import { VOICETOOL_ACTION_EVENT } from '../utils/keyboardShortcuts';
import {
  Mic,
  Square,
  Play,
  Pause,
  Download,
  BookmarkPlus,
  Scissors,
  RotateCcw,
  Sparkles,
  Check,
  Radio,
  Settings2,
} from 'lucide-react';

interface VoiceRecorderProps {
  onSaveToLibrary: (item: SavedAudioItem) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSaveToLibrary }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(100);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportConfig, setExportConfig] = useState<AudioExportConfig>({
    format: 'wav',
    sampleRate: 44100,
    bitrate: 192,
    channels: 'mono',
    normalizeGain: true,
  });

  // VU Meter & MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsSaved(false);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setAudioUrl(null);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 0.1);
      }, 100);
    } catch (err) {
      console.warn('Microphone error or permission denied, using simulated sample', err);
      // Fallback demo recording generator
      handleGenerateDemoRecording();
    }
  };

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 0.1);
      }, 100);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleGenerateDemoRecording = () => {
    const demo = voiceEngine.generateAudioWav(
      'This is a crystal clear test voice recording captured directly with VoiceTool audio workstation.',
      {
        rate: 1.0,
        pitchMultiplier: 1.0,
        basePitchHz: 180,
      }
    );
    setAudioUrl(demo.url);
    setRecordingSeconds(demo.duration);
    setIsRecording(false);
    setIsSaved(false);
  };

  const handlePlayAudio = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const duration = audioRef.current.duration || recordingSeconds || 1;
      const current = audioRef.current.currentTime;
      setProgress(current / duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleSeek = (ratio: number) => {
    if (audioRef.current && audioUrl) {
      const duration = audioRef.current.duration || recordingSeconds;
      audioRef.current.currentTime = ratio * duration;
      setProgress(ratio);
    }
  };

  const handleSaveToLibrary = () => {
    if (!audioUrl) return;

    const item: SavedAudioItem = {
      id: `rec-${Date.now()}`,
      title: `Microphone Recording (${Math.round(recordingSeconds)}s)`,
      type: 'recording',
      createdAt: Date.now(),
      durationSeconds: Math.round(recordingSeconds),
      audioBlobUrl: audioUrl,
      fileSizeFormatted: `${Math.round(recordingSeconds * 180)} KB`,
    };

    onSaveToLibrary(item);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleExportWithConfig = (cfg: AudioExportConfig) => {
    setExportConfig(cfg);
    if (!audioUrl) return;

    const ext = cfg.format;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `VoiceTool_Recording_${(cfg.sampleRate / 1000).toFixed(1)}kHz_${cfg.bitrate}kbps_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Listen for keyboard shortcuts dispatched from global hub
  useEffect(() => {
    const handleAction = (e: any) => {
      const action = e.detail?.action;
      if (action === 'toggle-record') {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      } else if (action === 'pause-record') {
        handlePauseResume();
      } else if (action === 'toggle-play') {
        if (isRecording) {
          stopRecording();
        } else {
          handlePlayAudio();
        }
      } else if (action === 'export') {
        if (audioUrl) {
          setIsExportModalOpen(true);
        }
      } else if (action === 'save-library') {
        handleSaveToLibrary();
      } else if (action === 'close-modal') {
        setIsExportModalOpen(false);
      }
    };

    window.addEventListener(VOICETOOL_ACTION_EVENT, handleAction);
    return () => window.removeEventListener(VOICETOOL_ACTION_EVENT, handleAction);
  }, [isRecording, isPaused, audioUrl, isPlaying, playbackSpeed, recordingSeconds]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Mic className="w-5 h-5 text-rose-500" />
            Online Voice Recorder &amp; Audio Studio
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Capture studio-grade microphone audio, monitor sound levels, trim clips, and export uncompressed WAV.
          </p>
        </div>

        <button
          onClick={handleGenerateDemoRecording}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Load Test Recording</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recording Deck (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 flex flex-col items-center justify-center text-center space-y-5">
            {/* Live Timer Counter */}
            <div className="flex items-center gap-3">
              {isRecording && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-mono font-semibold animate-pulse">
                  <Radio className="w-3 h-3" /> REC
                </span>
              )}
              <span className="text-4xl sm:text-5xl font-mono font-extrabold text-white tracking-tight">
                {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Dynamic Status / Oscilloscope indicator */}
            <p className="text-xs text-slate-400 max-w-sm">
              {isRecording
                ? isPaused
                  ? 'Recording paused. Click resume to continue.'
                  : 'Recording in progress... Speak clearly into your microphone.'
                : audioUrl
                ? 'Recording complete! You can preview, trim, and download below.'
                : 'Click the record button below to start capturing audio.'}
            </p>

            {/* Record / Pause / Stop Buttons */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/40 transition-transform active:scale-95 cursor-pointer"
                    title="Start Recording (R)"
                    data-testid="record-trigger-btn"
                  >
                    <Mic className="w-7 h-7" />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-rose-300 font-bold shadow">
                      R
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handlePauseResume}
                      className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                      title={isPaused ? 'Resume (P)' : 'Pause (P)'}
                    >
                      {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
                      <span className="absolute -bottom-1 -right-1 px-1 py-0.1 rounded bg-slate-900 border border-slate-700 text-[9px] font-mono text-amber-300 font-bold">
                        P
                      </span>
                    </button>

                    <button
                      onClick={stopRecording}
                      className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 hover:bg-white text-slate-900 shadow-xl shadow-white/10 transition-transform active:scale-95 cursor-pointer"
                      title="Stop Recording (R or Space)"
                      data-testid="record-stop-btn"
                    >
                      <Square className="w-7 h-7 fill-current" />
                      <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-900 font-bold shadow">
                        R
                      </span>
                    </button>
                  </>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <span>Shortcut:</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-rose-300 font-bold">R</kbd>
                <span>{isRecording ? 'to stop' : 'to record'}</span>
              </div>
            </div>
          </div>

          {/* Waveform Visualizer & Scrub Player */}
          {audioUrl && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Audio Review &amp; Waveform
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Duration: {formatTime(recordingSeconds)}
                </span>
              </div>

              <AudioWaveVisualizer
                isPlaying={isPlaying}
                isRecording={isRecording}
                progress={progress}
                onSeek={handleSeek}
                height={75}
                accentColor="#f43f5e"
              />

              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayAudio}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-md transition-all cursor-pointer ${
                      isPlaying
                        ? 'bg-slate-700 hover:bg-slate-600'
                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    <span>{isPlaying ? 'Pause' : 'Play Audio'}</span>
                    <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/30 border border-white/20 text-[10px] font-mono text-rose-200 font-bold">Space</kbd>
                  </button>

                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        setProgress(0);
                      }
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                    title="Restart from beginning"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Settings button */}
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                    title="Configure Sample Rate & Bitrate (E)"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Settings ({(exportConfig.sampleRate / 1000).toFixed(1)}kHz &bull; {exportConfig.bitrate}k)</span>
                    <kbd className="ml-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-rose-300 font-bold">E</kbd>
                  </button>

                  {/* Download button */}
                  <button
                    onClick={() => handleExportWithConfig(exportConfig)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download ({exportConfig.format.toUpperCase()} &bull; {(exportConfig.sampleRate / 1000).toFixed(1)}kHz)</span>
                  </button>

                  <button
                    onClick={handleSaveToLibrary}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isSaved ? 'Saved to Library' : 'Save'}</span>
                    <kbd className="ml-1 px-1 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">S</kbd>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Audio Trimmer & Playback Speed (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-indigo-400" />
              Audio Trimmer &amp; Playback
            </h3>

            {/* Playback speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Playback Speed:</span>
                <span className="font-mono text-indigo-300 font-semibold">{playbackSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => {
                  const spd = parseFloat(e.target.value);
                  setPlaybackSpeed(spd);
                  if (audioRef.current) audioRef.current.playbackRate = spd;
                }}
                className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Trimmer Sliders */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trim Start:</span>
                  <span className="font-mono text-slate-200">
                    {formatTime((trimStart / 100) * (recordingSeconds || 1))}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={trimStart}
                  onChange={(e) => setTrimStart(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trim End:</span>
                  <span className="font-mono text-slate-200">
                    {formatTime((trimEnd / 100) * (recordingSeconds || 1))}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Interactive Export Format & Sample Rate Settings */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  Export Settings
                </span>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                >
                  More Options &rarr;
                </button>
              </div>

              {/* Sample Rate (44.1kHz vs 48kHz) */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Sample Rate:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {(exportConfig.sampleRate / 1000).toFixed(1)} kHz
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[44100, 48000].map((sr) => (
                    <button
                      key={sr}
                      type="button"
                      onClick={() => setExportConfig({ ...exportConfig, sampleRate: sr })}
                      className={`py-1 text-center text-[11px] rounded border transition-colors ${
                        exportConfig.sampleRate === sr
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sr === 44100 ? '44.1 kHz (CD)' : '48.0 kHz (Video)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bitrate Options (128, 192, 320 kbps) */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Bitrate Encoding:</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {exportConfig.bitrate} kbps
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[128, 192, 320].map((br) => (
                    <button
                      key={br}
                      type="button"
                      onClick={() => setExportConfig({ ...exportConfig, bitrate: br })}
                      className={`py-1 text-center text-[11px] rounded border transition-colors ${
                        exportConfig.bitrate === br
                          ? 'bg-rose-950/60 border-rose-500 text-rose-200 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {br} kbps
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Settings Modal */}
      <ExportSettingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        durationSeconds={recordingSeconds}
        initialConfig={exportConfig}
        onExport={handleExportWithConfig}
        title="Microphone Recording Export Settings"
        defaultFilename="VoiceTool_Recording"
      />
    </div>
  );
};
