import React, { useState, useEffect, useRef } from 'react';
import { PRACTICE_SENTENCES } from '../data/presets';
import {
  frequencyToNote,
  getVocalRangeCategory,
  autoCorrelate,
  NoteInfo,
  VocalCategoryInfo,
} from '../utils/audioMath';
import { voiceEngine } from '../services/voiceEngine';
import {
  Activity,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Target,
  BarChart2,
  BookOpen,
  Sparkles,
  Info,
  Play,
} from 'lucide-react';

export const PitchAnalyzer: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [currentNote, setCurrentNote] = useState<NoteInfo | null>(null);
  const [vocalCat, setVocalCat] = useState<VocalCategoryInfo>(getVocalRangeCategory(170));

  // Target Pitch & Reference Tone
  const [targetPitchHz, setTargetPitchHz] = useState<number>(205);
  const [isPlayingTone, setIsPlayingTone] = useState<boolean>(false);

  // Pitch Statistics
  const [minFreq, setMinFreq] = useState<number>(0);
  const [maxFreq, setMaxFreq] = useState<number>(0);
  const [avgFreq, setAvgFreq] = useState<number>(0);
  const pitchHistoryRef = useRef<number[]>([]);

  // Selected Practice Sentence
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number>(0);

  // Audio Context & Stream Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const simIntervalRef = useRef<any>(null);

  // Canvas ref for pitch history graph
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rollingPitchRef = useRef<{ time: number; freq: number }[]>([]);

  const activeSentence = PRACTICE_SENTENCES[selectedSentenceIndex];

  // Set target pitch according to active sentence
  useEffect(() => {
    const mid = Math.round((activeSentence.targetPitchMinHz + activeSentence.targetPitchMaxHz) / 2);
    setTargetPitchHz(mid);
  }, [selectedSentenceIndex]);

  const startListening = async () => {
    stopSimulating();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      resetStats();
      runPitchLoop();
    } catch (err) {
      console.warn('Microphone access denied or unavailable, switching to demo simulation', err);
      startSimulating();
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setCurrentFreq(0);
    setCurrentNote(null);
  };

  const runPitchLoop = () => {
    if (!analyserRef.current || !audioCtxRef.current) return;

    const analyser = analyserRef.current;
    const buffer = new Float32Array(analyser.fftSize);

    const check = () => {
      analyser.getFloatTimeDomainData(buffer);
      const detected = autoCorrelate(buffer, audioCtxRef.current!.sampleRate);

      if (detected > 50 && detected < 600) {
        processNewFrequency(detected);
      } else {
        // Decay to 0 when silence
        rollingPitchRef.current.push({ time: Date.now(), freq: 0 });
      }

      // Keep last 150 points for rolling graph
      if (rollingPitchRef.current.length > 150) {
        rollingPitchRef.current.shift();
      }

      drawPitchGraph();
      animFrameRef.current = requestAnimationFrame(check);
    };

    check();
  };

  const processNewFrequency = (f: number) => {
    setCurrentFreq(f);
    const note = frequencyToNote(f);
    setCurrentNote(note);
    setVocalCat(getVocalRangeCategory(f));

    // Stats
    pitchHistoryRef.current.push(f);
    if (pitchHistoryRef.current.length > 500) {
      pitchHistoryRef.current.shift();
    }

    const arr = pitchHistoryRef.current;
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const sum = arr.reduce((acc, v) => acc + v, 0);
    const avg = Math.round((sum / arr.length) * 10) / 10;

    setMinFreq(Math.round(min * 10) / 10);
    setMaxFreq(Math.round(max * 10) / 10);
    setAvgFreq(avg);

    rollingPitchRef.current.push({ time: Date.now(), freq: f });
  };

  const resetStats = () => {
    pitchHistoryRef.current = [];
    rollingPitchRef.current = [];
    setMinFreq(0);
    setMaxFreq(0);
    setAvgFreq(0);
  };

  const startSimulating = () => {
    stopListening();
    setIsSimulating(true);
    resetStats();

    let phase = 0;
    simIntervalRef.current = setInterval(() => {
      phase += 0.15;
      // Realistic human vocal contour around target frequency
      const wobble = Math.sin(phase) * 15 + Math.cos(phase * 2.3) * 8;
      const simulatedPitch = Math.round((targetPitchHz + wobble) * 10) / 10;

      processNewFrequency(simulatedPitch);
      if (rollingPitchRef.current.length > 150) {
        rollingPitchRef.current.shift();
      }
      drawPitchGraph();
    }, 120);
  };

  const stopSimulating = () => {
    setIsSimulating(false);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setCurrentFreq(0);
    setCurrentNote(null);
  };

  const toggleTone = () => {
    if (isPlayingTone) {
      voiceEngine.stopReferenceTone();
      setIsPlayingTone(false);
    } else {
      voiceEngine.startReferenceTone(targetPitchHz);
      setIsPlayingTone(true);
    }
  };

  const handleTargetPitchChange = (hz: number) => {
    setTargetPitchHz(hz);
    if (isPlayingTone) {
      voiceEngine.updateReferenceTonePitch(hz);
    }
  };

  // Draw Rolling Canvas Pitch Graph with Gender Ranges
  const drawPitchGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Coordinate mapping: 60Hz (bottom) to 350Hz (top)
    const minH = 60;
    const maxH = 340;
    const getY = (hz: number) => height - ((hz - minH) / (maxH - minH)) * height;

    // Draw Range Guide Bands
    // 1. Masculine range (85 - 155 Hz)
    const yMascTop = getY(155);
    const yMascBottom = getY(85);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'; // Blue
    ctx.fillRect(0, yMascTop, width, yMascBottom - yMascTop);

    // 2. Androgynous / Neutral range (155 - 185 Hz)
    const yAndroTop = getY(185);
    const yAndroBottom = getY(155);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'; // Green
    ctx.fillRect(0, yAndroTop, width, yAndroBottom - yAndroTop);

    // 3. Feminine range (185 - 260 Hz)
    const yFemTop = getY(260);
    const yFemBottom = getY(185);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.08)'; // Pink
    ctx.fillRect(0, yFemTop, width, yFemBottom - yFemTop);

    // Draw Horizontal Gridlines & Labels
    const gridPoints = [
      { hz: 100, label: '100 Hz (G2)', color: 'rgba(59, 130, 246, 0.4)' },
      { hz: 155, label: '155 Hz (D#3)', color: 'rgba(59, 130, 246, 0.6)' },
      { hz: 185, label: '185 Hz (F#3)', color: 'rgba(16, 185, 129, 0.6)' },
      { hz: 220, label: '220 Hz (A3)', color: 'rgba(236, 72, 153, 0.5)' },
      { hz: 260, label: '260 Hz (C4)', color: 'rgba(236, 72, 153, 0.6)' },
    ];

    ctx.font = '10px JetBrains Mono, monospace';
    gridPoints.forEach((g) => {
      const y = getY(g.hz);
      ctx.strokeStyle = g.color;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.fillText(g.label, 8, y - 3);
    });

    // Draw Target Pitch Line
    const targetY = getY(targetPitchHz);
    ctx.strokeStyle = '#f59e0b'; // Amber
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`Target: ${targetPitchHz} Hz`, width - 110, targetY - 4);

    // Draw Rolling Pitch Data Curve
    const data = rollingPitchRef.current;
    if (data.length > 1) {
      ctx.lineWidth = 3;
      ctx.beginPath();

      let isDrawingSegment = false;
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * width;
        const pt = data[i];

        if (pt.freq > minH && pt.freq < maxH) {
          const y = getY(pt.freq);
          if (!isDrawingSegment) {
            ctx.moveTo(x, y);
            isDrawingSegment = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          isDrawingSegment = false;
        }
      }

      ctx.strokeStyle = '#a855f7'; // Purple glow
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw active head dot
      const lastPt = data[data.length - 1];
      if (lastPt && lastPt.freq > minH && lastPt.freq < maxH) {
        const lastX = width;
        const lastY = getY(lastPt.freq);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lastX - 2, lastY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  useEffect(() => {
    drawPitchGraph();
  }, [targetPitchHz]);

  useEffect(() => {
    return () => {
      stopListening();
      stopSimulating();
      voiceEngine.stopReferenceTone();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-pink-400" />
            VoiceTools &bull; Vocal Pitch &amp; Frequency Analyzer
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time fundamental frequency (F₀) monitoring, vocal range classification, and speech therapy pitch matching.
          </p>
        </div>

        {/* Start / Stop Monitor Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isListening && !isSimulating ? (
            <>
              <button
                onClick={startListening}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs shadow-md shadow-pink-600/30 transition-all"
              >
                <Mic className="w-4 h-4" />
                <span>Start Microphone</span>
              </button>
              <button
                onClick={startSimulating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-xs transition-colors"
                title="Test with simulated vocal speech contour"
              >
                <Play className="w-3.5 h-3.5 text-indigo-400" />
                <span>Simulate Voice Demo</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                stopListening();
                stopSimulating();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/30 transition-all"
            >
              <MicOff className="w-4 h-4" />
              <span>Stop Pitch Monitor</span>
            </button>
          )}

          <button
            onClick={resetStats}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
          >
            Reset Stats
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Real-Time Dial & Graph (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Real-time Frequency Readout Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            {/* Live Hz */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Current Pitch (F0)
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                  {currentFreq > 0 ? currentFreq.toFixed(1) : '--'}
                </span>
                <span className="text-xs text-slate-400">Hz</span>
              </div>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded w-fit"
                style={{ backgroundColor: `${vocalCat.color}20`, color: vocalCat.color }}
              >
                {currentFreq > 0 ? vocalCat.label : 'Waiting for voice...'}
              </span>
            </div>

            {/* Note & Cents */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Musical Note
              </span>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-3xl font-extrabold font-mono text-indigo-300">
                  {currentNote ? currentNote.note : '--'}
                </span>
                {currentNote && (
                  <span
                    className={`text-xs font-mono font-semibold ${
                      Math.abs(currentNote.cents) < 10
                        ? 'text-emerald-400'
                        : currentNote.cents > 0
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {currentNote.cents > 0 ? `+${currentNote.cents}` : currentNote.cents} cents
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                {currentNote ? `Octave ${currentNote.octave}` : 'Speak or hum to detect'}
              </span>
            </div>

            {/* Session Stats */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                Session Averages
              </span>
              <div className="space-y-1 my-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Pitch:</span>
                  <span className="text-emerald-400 font-bold">{avgFreq ? `${avgFreq} Hz` : '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Min &ndash; Max:</span>
                  <span className="text-slate-300">
                    {minFreq ? `${minFreq} - ${maxFreq} Hz` : '--'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500">
                Samples recorded: {pitchHistoryRef.current.length}
              </span>
            </div>
          </div>

          {/* Canvas Rolling Pitch Graph Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Pitch Timeline Graph
                </span>
                {(isListening || isSimulating) && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-blue-500/40 border border-blue-400" />
                  <span className="text-slate-400">Masculine (85-155Hz)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-400" />
                  <span className="text-slate-400">Neutral (155-185Hz)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-pink-500/40 border border-pink-400" />
                  <span className="text-slate-400">Feminine (185-260Hz)</span>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="relative w-full h-[280px]">
              <canvas
                ref={canvasRef}
                className="w-full h-full rounded-lg bg-slate-950 border border-slate-800"
              />
            </div>
          </div>

          {/* Reference Pitch Tone Generator */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                Target Pitch &amp; Audio Tone Generator
              </h3>
              <button
                onClick={toggleTone}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
                  isPlayingTone
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                }`}
              >
                {isPlayingTone ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Stop Tone</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Play Reference Tone</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Target Frequency:</span>
                <span className="font-mono text-amber-300 font-bold text-sm">
                  {targetPitchHz} Hz ({frequencyToNote(targetPitchHz)?.note})
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="300"
                step="1"
                value={targetPitchHz}
                onChange={(e) => handleTargetPitchChange(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <button onClick={() => handleTargetPitchChange(115)} className="hover:text-amber-300">
                  115 Hz (Masculine)
                </button>
                <button onClick={() => handleTargetPitchChange(170)} className="hover:text-amber-300">
                  170 Hz (Androgynous)
                </button>
                <button onClick={() => handleTargetPitchChange(215)} className="hover:text-amber-300">
                  215 Hz (Feminine)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Practice Sentences & Voice Training Guide (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Practice Sentences Card */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-pink-400" />
                Practice Sentences
              </h3>
              <span className="text-[11px] text-slate-400">
                {selectedSentenceIndex + 1} of {PRACTICE_SENTENCES.length}
              </span>
            </div>

            {/* Category Pill */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                {activeSentence.category}
              </span>
              <span className="text-xs text-slate-400">
                Target: {activeSentence.targetPitchMinHz}&ndash;{activeSentence.targetPitchMaxHz} Hz
              </span>
            </div>

            {/* Sentence Box */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-sm font-medium text-slate-100 leading-relaxed italic">
              "{activeSentence.sentence}"
            </div>

            {/* Speech Therapy Tip */}
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-900/60 text-xs text-indigo-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Coach Tip:</strong> {activeSentence.tip}
              </span>
            </div>

            {/* Sentence Nav Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                disabled={selectedSentenceIndex === 0}
                onClick={() => setSelectedSentenceIndex((i) => Math.max(0, i - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 disabled:opacity-40"
              >
                &larr; Previous
              </button>
              <button
                disabled={selectedSentenceIndex === PRACTICE_SENTENCES.length - 1}
                onClick={() =>
                  setSelectedSentenceIndex((i) => Math.min(PRACTICE_SENTENCES.length - 1, i + 1))
                }
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-40"
              >
                Next Sentence &rarr;
              </button>
            </div>
          </div>

          {/* Voice Training Quick Reference */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 text-xs text-slate-400">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              Voice Science Insights
            </h4>
            <p>
              Vocal perception is shaped by both <strong>Fundamental Frequency (F₀)</strong> and{' '}
              <strong>Resonance (Vocal Tract Size)</strong>.
            </p>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
              <li>
                <strong>Feminization:</strong> Elevate the larynx gently, brighten vowels, and speak in the 185–230 Hz zone.
              </li>
              <li>
                <strong>Masculinization:</strong> Relax the throat, engage chest resonance, and anchor pitch around 95–135 Hz.
              </li>
              <li>
                <strong>Ear Training:</strong> Use the reference tone generator to lock in your desired pitch before speaking.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
