import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Clock,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Repeat,
} from 'lucide-react';
import { formatAudioSeconds, detectSilenceBoundaries } from '../utils/audioMath';
import { AppLanguage } from '../types';

export interface AudioTrimmerProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  trimStart: number;
  trimEnd: number;
  rawChannelData?: Float32Array | null;
  sampleRate?: number;
  uiLang?: AppLanguage;
  onTrimChange: (start: number, end: number) => void;
  onPlayTrimmedRegion: (loop: boolean) => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

export const AudioTrimmer: React.FC<AudioTrimmerProps> = ({
  duration,
  currentTime,
  isPlaying,
  trimStart,
  trimEnd,
  rawChannelData,
  sampleRate = 44100,
  uiLang = 'km',
  onTrimChange,
  onPlayTrimmedRegion,
  onPause,
  onSeek,
}) => {
  const isKhmer = uiLang === 'km';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | 'middle' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragInitialTrim, setDragInitialTrim] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [isLooping, setIsLooping] = useState<boolean>(false);

  const safeDuration = Math.max(0.1, duration);
  const safeStart = Math.max(0, Math.min(trimStart, safeDuration - 0.05));
  const safeEnd = Math.max(safeStart + 0.05, Math.min(trimEnd, safeDuration));
  const trimmedDuration = Math.max(0, safeEnd - safeStart);
  const croppedDuration = Math.max(0, safeDuration - trimmedDuration);

  // Compute waveform peaks from rawChannelData if available
  const barCount = 72;
  const waveformPeaks = React.useMemo(() => {
    if (!rawChannelData || rawChannelData.length === 0) {
      // Fallback pseudo-waveform with natural vocal speech peaks
      return Array.from({ length: barCount }, (_, i) => {
        const mid = barCount / 2;
        const envelope = 1 - Math.pow((i - mid) / mid, 2);
        const wave = Math.sin(i * 0.4) * 0.35 + Math.cos(i * 0.8) * 0.2 + 0.45;
        return Math.max(0.12, Math.min(0.95, envelope * wave));
      });
    }

    const peaks: number[] = [];
    const step = Math.floor(rawChannelData.length / barCount);
    for (let i = 0; i < barCount; i++) {
      let max = 0;
      const startIdx = i * step;
      const endIdx = Math.min(rawChannelData.length, startIdx + step);
      for (let j = startIdx; j < endIdx; j++) {
        const absVal = Math.abs(rawChannelData[j]);
        if (absVal > max) max = absVal;
      }
      peaks.push(Math.max(0.1, Math.min(1.0, max)));
    }
    return peaks;
  }, [rawChannelData, barCount]);

  // Handle Dragging
  const handlePointerDown = (type: 'start' | 'end' | 'middle', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveDrag(type);
    setDragStartX(e.clientX);
    setDragInitialTrim({ start: safeStart, end: safeEnd });
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeDrag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pixelWidth = rect.width;
      if (pixelWidth <= 0) return;

      const deltaX = e.clientX - dragStartX;
      const deltaSec = (deltaX / pixelWidth) * safeDuration;

      if (activeDrag === 'start') {
        const newStart = Math.max(0, Math.min(dragInitialTrim.start + deltaSec, safeEnd - 0.05));
        onTrimChange(Math.round(newStart * 100) / 100, safeEnd);
      } else if (activeDrag === 'end') {
        const newEnd = Math.max(safeStart + 0.05, Math.min(dragInitialTrim.end + deltaSec, safeDuration));
        onTrimChange(safeStart, Math.round(newEnd * 100) / 100);
      } else if (activeDrag === 'middle') {
        const range = dragInitialTrim.end - dragInitialTrim.start;
        let newStart = dragInitialTrim.start + deltaSec;
        let newEnd = newStart + range;
        if (newStart < 0) {
          newStart = 0;
          newEnd = range;
        } else if (newEnd > safeDuration) {
          newEnd = safeDuration;
          newStart = safeDuration - range;
        }
        onTrimChange(Math.round(newStart * 100) / 100, Math.round(newEnd * 100) / 100);
      }
    },
    [activeDrag, dragStartX, dragInitialTrim, safeStart, safeEnd, safeDuration, onTrimChange]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveDrag(null);
    }
  };

  // Quick Action: Reset to full
  const handleResetFull = () => {
    onTrimChange(0, Math.round(safeDuration * 100) / 100);
  };

  // Quick Action: Auto Detect Silence
  const handleAutoTrimSilence = () => {
    if (rawChannelData && rawChannelData.length > 0) {
      const detected = detectSilenceBoundaries(rawChannelData, sampleRate, -38, 0.05);
      onTrimChange(detected.start, detected.end);
    } else {
      // Fallback: trim first 0.2s and last 0.2s
      const newStart = Math.min(0.2, safeDuration * 0.1);
      const newEnd = Math.max(newStart + 0.5, safeDuration - 0.2);
      onTrimChange(Math.round(newStart * 100) / 100, Math.round(newEnd * 100) / 100);
    }
  };

  // Nudge functions
  const nudgeStart = (delta: number) => {
    const updated = Math.max(0, Math.min(safeStart + delta, safeEnd - 0.05));
    onTrimChange(Math.round(updated * 100) / 100, safeEnd);
  };

  const nudgeEnd = (delta: number) => {
    const updated = Math.max(safeStart + 0.05, Math.min(safeEnd + delta, safeDuration));
    onTrimChange(safeStart, Math.round(updated * 100) / 100);
  };

  // Track scrubber click
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeDrag) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * safeDuration;
    onSeek(targetTime);
  };

  // Percentages for UI layout
  const startPercent = (safeStart / safeDuration) * 100;
  const endPercent = (safeEnd / safeDuration) * 100;
  const currentPercent = (Math.max(0, Math.min(currentTime, safeDuration)) / safeDuration) * 100;

  return (
    <div className="rounded-xl bg-slate-900 border border-indigo-900/40 p-4 space-y-4">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              {isKhmer ? 'កាត់តសំឡេង (Audio Trimmer & Crop)' : 'Interactive Audio Trimmer & Region Crop'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isKhmer
                ? 'កំណត់ចំណុចចាប់ផ្តើម និងបញ្ចប់ ដើម្បីកាត់យកផ្នែកដែលត្រូវការមុនពេលទាញយក'
                : 'Drag handles or adjust timecodes to crop audio region prior to download and export.'}
            </p>
          </div>
        </div>

        {/* Trim Duration Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-semibold">
            {isKhmer ? 'ជ្រើសរើស' : 'Selected'}: {formatAudioSeconds(trimmedDuration)}
          </span>
          {croppedDuration > 0 && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {isKhmer ? 'កាត់ចោល' : 'Cropped'}: -{formatAudioSeconds(croppedDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive Visual Timeline Area */}
      <div className="space-y-1">
        {/* Time ruler */}
        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1 select-none">
          <span>0.00s</span>
          <span>{formatAudioSeconds(safeDuration * 0.25)}</span>
          <span>{formatAudioSeconds(safeDuration * 0.5)}</span>
          <span>{formatAudioSeconds(safeDuration * 0.75)}</span>
          <span>{formatAudioSeconds(safeDuration)}</span>
        </div>

        {/* Waveform & Handles Track */}
        <div
          ref={containerRef}
          onClick={handleTrackClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative h-24 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden cursor-crosshair select-none"
        >
          {/* Background Grid Lines */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
            <div className="w-px h-full bg-slate-500" />
            <div className="w-px h-full bg-slate-500" />
            <div className="w-px h-full bg-slate-500" />
            <div className="w-px h-full bg-slate-500" />
            <div className="w-px h-full bg-slate-500" />
          </div>

          {/* Render Waveform Bars */}
          <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none gap-0.5">
            {waveformPeaks.map((peak, idx) => {
              const barPosRatio = idx / barCount;
              const barPosSec = barPosRatio * safeDuration;
              const isInsideTrim = barPosSec >= safeStart && barPosSec <= safeEnd;

              return (
                <div
                  key={idx}
                  className="flex-1 flex items-center justify-center h-full"
                >
                  <div
                    className={`w-full max-w-[4px] rounded-full transition-colors duration-150 ${
                      isInsideTrim
                        ? 'bg-indigo-400 opacity-90'
                        : 'bg-slate-700 opacity-40'
                    }`}
                    style={{ height: `${Math.max(10, peak * 82)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Dimmed Left Cropped Region (Cut out) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-slate-950/80 border-r border-dashed border-rose-500/50 backdrop-blur-[1px] pointer-events-none transition-all"
            style={{ width: `${startPercent}%` }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />
            {startPercent > 8 && (
              <span className="absolute top-1 left-2 text-[10px] font-mono text-rose-400 font-bold opacity-75">
                {isKhmer ? 'កាត់' : 'CUT'}
              </span>
            )}
          </div>

          {/* Active Highlighted Trim Window */}
          <div
            onPointerDown={(e) => handlePointerDown('middle', e)}
            className="absolute top-0 bottom-0 border-y-2 border-indigo-400 bg-indigo-500/10 cursor-grab active:cursor-grabbing transition-all group"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
            }}
            title={isKhmer ? 'អូសដើម្បីរំកិលផ្នែកដែលបានជ្រើស' : 'Drag window to reposition region'}
          >
            {/* Center handle indicator */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <ArrowLeftRight className="w-4 h-4 text-indigo-300/80 drop-shadow" />
            </div>
          </div>

          {/* Dimmed Right Cropped Region (Cut out) */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-slate-950/80 border-l border-dashed border-rose-500/50 backdrop-blur-[1px] pointer-events-none transition-all"
            style={{ width: `${100 - endPercent}%` }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(#e11d48_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />
            {100 - endPercent > 8 && (
              <span className="absolute top-1 right-2 text-[10px] font-mono text-rose-400 font-bold opacity-75">
                {isKhmer ? 'កាត់' : 'CUT'}
              </span>
            )}
          </div>

          {/* Start Trim Handle (Left) */}
          <div
            onPointerDown={(e) => handlePointerDown('start', e)}
            className="absolute top-0 bottom-0 w-5 -ml-2.5 z-20 flex flex-col items-center justify-between cursor-ew-resize group"
            style={{ left: `${startPercent}%` }}
          >
            {/* Top Badge */}
            <div className="px-1 py-0.5 rounded bg-indigo-600 text-[9px] font-mono font-bold text-white shadow-md transform -translate-y-1">
              {safeStart.toFixed(2)}s
            </div>
            {/* Handle Bar */}
            <div className="w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-400 rounded-full shadow-lg shadow-indigo-500/50 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white rounded-full opacity-80" />
            </div>
            {/* Bottom Grip */}
            <div className="w-3 h-2 bg-indigo-600 rounded-b shadow" />
          </div>

          {/* End Trim Handle (Right) */}
          <div
            onPointerDown={(e) => handlePointerDown('end', e)}
            className="absolute top-0 bottom-0 w-5 -ml-2.5 z-20 flex flex-col items-center justify-between cursor-ew-resize group"
            style={{ left: `${endPercent}%` }}
          >
            {/* Top Badge */}
            <div className="px-1 py-0.5 rounded bg-indigo-600 text-[9px] font-mono font-bold text-white shadow-md transform -translate-y-1">
              {safeEnd.toFixed(2)}s
            </div>
            {/* Handle Bar */}
            <div className="w-1.5 h-full bg-indigo-500 group-hover:bg-indigo-400 rounded-full shadow-lg shadow-indigo-500/50 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white rounded-full opacity-80" />
            </div>
            {/* Bottom Grip */}
            <div className="w-3 h-2 bg-indigo-600 rounded-b shadow" />
          </div>

          {/* Live Playhead Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 pointer-events-none transition-all duration-75"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="w-2.5 h-2.5 bg-amber-400 rounded-full -ml-1 -mt-0.5 shadow-md shadow-amber-400/50" />
          </div>
        </div>
      </div>

      {/* Control Strip: Numeric Precision Inputs & Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
        {/* Start Point Input Box (4 Cols) */}
        <div className="md:col-span-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              {isKhmer ? 'ចំណុចចាប់ផ្តើម (Start):' : 'Start Point:'}
            </span>
            <span className="font-mono text-indigo-300 font-bold">{safeStart.toFixed(2)}s</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => nudgeStart(-0.1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
              title={isKhmer ? 'បន្ថយ ០.១ វិនាទី' : 'Decrease start by 0.1s'}
              data-testid="trim-start-minus"
            >
              -0.1s
            </button>
            <input
              type="number"
              min="0"
              max={safeEnd - 0.05}
              step="0.05"
              value={safeStart}
              data-testid="trim-start-input"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  onTrimChange(Math.max(0, Math.min(val, safeEnd - 0.05)), safeEnd);
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={() => nudgeStart(0.1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
              title={isKhmer ? 'បង្កើន ០.១ វិនាទី' : 'Increase start by 0.1s'}
              data-testid="trim-start-plus"
            >
              +0.1s
            </button>
          </div>
        </div>

        {/* End Point Input Box (4 Cols) */}
        <div className="md:col-span-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              {isKhmer ? 'ចំណុចបញ្ចប់ (End):' : 'End Point:'}
            </span>
            <span className="font-mono text-indigo-300 font-bold">{safeEnd.toFixed(2)}s</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => nudgeEnd(-0.1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
              title={isKhmer ? 'បន្ថយ ០.១ វិនាទី' : 'Decrease end by 0.1s'}
              data-testid="trim-end-minus"
            >
              -0.1s
            </button>
            <input
              type="number"
              min={safeStart + 0.05}
              max={safeDuration}
              step="0.05"
              value={safeEnd}
              data-testid="trim-end-input"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                  onTrimChange(safeStart, Math.max(safeStart + 0.05, Math.min(val, safeDuration)));
                }
              }}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={() => nudgeEnd(0.1)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
              title={isKhmer ? 'បង្កើន ០.១ វិនាទី' : 'Increase end by 0.1s'}
              data-testid="trim-end-plus"
            >
              +0.1s
            </button>
          </div>
        </div>

        {/* Quick Trim Presets & Preview Action (4 Cols) */}
        <div className="md:col-span-4 flex flex-col justify-between gap-1.5">
          {/* Play Trimmed Region Button */}
          <div className="flex items-center gap-1.5">
            <button
              data-testid="trim-preview-btn"
              onClick={() => {
                if (isPlaying) {
                  onPause();
                } else {
                  onPlayTrimmedRegion(isLooping);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer active:scale-95"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>
                {isPlaying
                  ? isKhmer ? 'ផ្អាកស្តាប់' : 'Pause'
                  : isKhmer ? 'ស្តាប់ផ្នែកកាត់ (Preview)' : 'Preview Selection'}
              </span>
            </button>

            <button
              data-testid="trim-loop-btn"
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
              }`}
              title={isKhmer ? 'ចាក់ឡើងវិញ (Loop)' : 'Loop selection'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              data-testid="trim-silence-btn"
              onClick={handleAutoTrimSilence}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
              title={isKhmer ? 'កាត់ចន្លោះស្ងាត់ដោយស្វ័យប្រវត្តិ' : 'Auto-detect voice and cut silence'}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{isKhmer ? 'កាត់ស្ងាត់ (Auto)' : 'Trim Silence'}</span>
            </button>

            <button
              data-testid="trim-reset-btn"
              onClick={handleResetFull}
              className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 transition-colors cursor-pointer"
              title={isKhmer ? 'ជ្រើសរើសសំឡេងទាំងមូល' : 'Reset to full audio'}
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>{isKhmer ? 'ពេញ' : 'Full'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
