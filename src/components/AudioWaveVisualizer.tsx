import React, { useEffect, useRef } from 'react';

interface AudioWaveVisualizerProps {
  isPlaying: boolean;
  isRecording?: boolean;
  progress?: number; // 0 to 1
  onSeek?: (ratio: number) => void;
  accentColor?: string;
  height?: number;
}

export const AudioWaveVisualizer: React.FC<AudioWaveVisualizerProps> = ({
  isPlaying,
  isRecording = false,
  progress = 0,
  onSeek,
  accentColor = '#6366f1',
  height = 64,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  // Generate static pseudo waveform bars for scrub representation
  const barCount = 64;
  const barsRef = useRef<number[]>(
    Array.from({ length: barCount }, (_, i) => {
      // Natural speech-like dynamic envelope
      const mid = barCount / 2;
      const envelope = 1 - Math.pow((i - mid) / mid, 2);
      const rand = Math.sin(i * 0.45) * 0.3 + Math.cos(i * 0.9) * 0.2 + 0.5;
      return Math.max(0.15, Math.min(0.95, envelope * rand));
    })
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const currentHeight = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== currentHeight * dpr) {
        canvas.width = width * dpr;
        canvas.height = currentHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, currentHeight);

      if (isPlaying || isRecording) {
        phaseRef.current += isRecording ? 0.12 : 0.08;
      }

      const barWidth = width / barCount;
      const gap = 2;
      const actualBarWidth = Math.max(2, barWidth - gap);

      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth + gap / 2;
        let factor = barsRef.current[i];

        if (isPlaying || isRecording) {
          // Dynamic wave modulation
          const wave = Math.sin(phaseRef.current + i * 0.3) * 0.25;
          factor = Math.max(0.1, Math.min(1.0, factor + wave));
        }

        const barH = factor * (currentHeight - 8);
        const y = (currentHeight - barH) / 2;
        const barProgress = i / barCount;

        // Color based on playback progress
        if (barProgress <= progress) {
          ctx.fillStyle = isRecording ? '#ef4444' : accentColor;
        } else {
          ctx.fillStyle = '#334155'; // Slate 700
        }

        // Draw rounded pill bar
        const r = Math.min(actualBarWidth / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, y, actualBarWidth, barH, r);
        ctx.fill();
      }

      // Draw playhead cursor
      if (progress > 0 && progress < 1) {
        const playheadX = progress * width;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(playheadX - 1, 0, 2, currentHeight);

        ctx.beginPath();
        ctx.arc(playheadX, 4, 3, 0, Math.PI * 2);
        ctx.arc(playheadX, currentHeight - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      if (isPlaying || isRecording) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, isRecording, progress, accentColor]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio);
  };

  return (
    <div className="relative w-full cursor-pointer select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full rounded-lg bg-slate-900/80 border border-slate-800 transition-colors hover:border-slate-700"
        title="Click to scrub waveform"
      />
    </div>
  );
};
