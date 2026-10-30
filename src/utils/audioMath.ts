/**
 * Pure audio and text utility calculations for VoiceTool.
 * Fully decoupled for headless testing and zero-dependency math.
 */

export interface NoteInfo {
  note: string;
  frequency: number;
  cents: number;
  octave: number;
  pitchClass: string;
}

export type VoiceRangeCategory = 'Bass' | 'Masculine' | 'Androgynous' | 'Feminine' | 'Soprano' | 'Unknown';

export interface VocalCategoryInfo {
  category: VoiceRangeCategory;
  label: string;
  minHz: number;
  maxHz: number;
  typicalHz: number;
  color: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts a frequency in Hertz to the closest musical note and cents deviation.
 * Standard A4 = 440 Hz.
 */
export function frequencyToNote(freq: number): NoteInfo | null {
  if (!freq || freq <= 0 || !isFinite(freq)) {
    return null;
  }

  // 12 * log2(freq / 440) + 69 (MIDI pitch)
  const midi = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);

  const pitchClassIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const pitchClass = NOTE_NAMES[pitchClassIndex];

  return {
    note: `${pitchClass}${octave}`,
    frequency: Math.round(freq * 10) / 10,
    cents,
    octave,
    pitchClass,
  };
}

/**
 * Returns vocal classification based on speech fundamental frequency (F0).
 * Standardized ranges used in speech therapy and VoiceTools:
 * - Masculine: 85 - 165 Hz (mean ~120 Hz)
 * - Androgynous / Neutral: 155 - 185 Hz (mean ~170 Hz)
 * - Feminine: 165 - 260 Hz (mean ~210 Hz)
 */
export function getVocalRangeCategory(freq: number): VocalCategoryInfo {
  if (freq < 75) {
    return {
      category: 'Bass',
      label: 'Deep Bass (<85 Hz)',
      minHz: 40,
      maxHz: 85,
      typicalHz: 75,
      color: '#6366f1', // Indigo
    };
  }
  if (freq < 155) {
    return {
      category: 'Masculine',
      label: 'Masculine Range (85–155 Hz)',
      minHz: 85,
      maxHz: 155,
      typicalHz: 120,
      color: '#3b82f6', // Blue
    };
  }
  if (freq <= 185) {
    return {
      category: 'Androgynous',
      label: 'Androgynous / Neutral (155–185 Hz)',
      minHz: 155,
      maxHz: 185,
      typicalHz: 170,
      color: '#10b981', // Emerald
    };
  }
  if (freq <= 270) {
    return {
      category: 'Feminine',
      label: 'Feminine Range (185–270 Hz)',
      minHz: 185,
      maxHz: 270,
      typicalHz: 215,
      color: '#ec4899', // Pink
    };
  }
  return {
    category: 'Soprano',
    label: 'High Pitch / Soprano (>270 Hz)',
    minHz: 270,
    maxHz: 500,
    typicalHz: 300,
    color: '#8b5cf6', // Purple
  };
}

/**
 * Fast normalized autocorrelation algorithm with parabolic interpolation
 * for real-time fundamental frequency (F0) pitch detection.
 */
export function autoCorrelate(
  buffer: Float32Array,
  sampleRate: number,
  rmsThreshold: number = 0.015
): number {
  const size = buffer.length;
  let rms = 0;

  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);

  // If signal is too quiet / silence
  if (rms < rmsThreshold) {
    return -1;
  }

  // Trim silence from start and end to improve accuracy
  let r1 = 0;
  let r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < thres) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buffer.subarray(r1, r2);
  const trimmedSize = trimmed.length;

  // Max and min periods for human voice (50Hz to 800Hz)
  const minPeriod = Math.floor(sampleRate / 800);
  const maxPeriod = Math.floor(sampleRate / 50);

  const correlations = new Float32Array(maxPeriod);

  for (let offset = minPeriod; offset < maxPeriod; offset++) {
    let sum = 0;
    for (let i = 0; i < trimmedSize - offset; i++) {
      sum += trimmed[i] * trimmed[i + offset];
    }
    correlations[offset] = sum;
  }

  // Find the highest peak beyond the immediate starting decay
  let bestOffset = -1;
  let maxCorrelation = 0;

  for (let offset = minPeriod; offset < maxPeriod; offset++) {
    if (correlations[offset] > maxCorrelation) {
      maxCorrelation = correlations[offset];
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || maxCorrelation <= 0) {
    return -1;
  }

  // Parabolic interpolation for sub-sample accuracy
  const x0 = bestOffset > 0 ? correlations[bestOffset - 1] : correlations[bestOffset];
  const x1 = correlations[bestOffset];
  const x2 = bestOffset < maxPeriod - 1 ? correlations[bestOffset + 1] : correlations[bestOffset];

  const denominator = 2 * (2 * x1 - x0 - x2);
  const delta = denominator !== 0 ? (x0 - x2) / denominator : 0;
  const refinedOffset = bestOffset + delta;

  const frequency = sampleRate / refinedOffset;

  if (frequency >= 50 && frequency <= 800) {
    return Math.round(frequency * 10) / 10;
  }

  return -1;
}

export interface SubtitleCue {
  id: number;
  startSeconds: number;
  endSeconds: number;
  duration: number;
  startTime: string;
  endTime: string;
  text: string;
  speaker?: string;
}

/**
 * Converts standard time string `00:01:23,456` or `00:01:23.456` to decimal seconds.
 */
export function srtTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace('.', ',');
  const parts = normalized.split(':');
  if (parts.length < 2) return 0;

  let hours = 0;
  let minutes = 0;
  let secondsAndMs = '0,000';

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    secondsAndMs = parts[2];
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10) || 0;
    secondsAndMs = parts[1];
  }

  const [secPart, msPart] = secondsAndMs.split(',');
  const seconds = parseInt(secPart, 10) || 0;
  const ms = parseInt((msPart || '0').padEnd(3, '0').slice(0, 3), 10) || 0;

  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * Converts decimal seconds to formatted SRT timestamp `00:01:23,456`.
 */
export function secondsToSrtTime(totalSeconds: number): string {
  if (totalSeconds < 0 || !isFinite(totalSeconds)) totalSeconds = 0;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`;
}

/**
 * Parses raw SRT subtitle text into structured cue objects.
 */
export function parseSRT(raw: string): SubtitleCue[] {
  if (!raw || !raw.trim()) return [];

  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];

  let autoId = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const startSec = srtTimeToSeconds(startStr);
    const endSec = srtTimeToSeconds(endStr);
    const duration = Math.max(0.1, endSec - startSec);

    const textLines = lines.slice(timeLineIndex + 1);
    const fullText = textLines.join('\n').trim();

    // Check if speaker tag is present e.g. "Speaker 1: Hello world" or "[Alice] Hello"
    let speaker = 'Narrator';
    let cleanText = fullText;

    const speakerMatch = fullText.match(/^\[([^\]]+)\]:\s*(.*)/) || fullText.match(/^([A-Za-z0-9 _]+):\s*(.*)/);
    if (speakerMatch && speakerMatch[2]) {
      speaker = speakerMatch[1].trim();
      cleanText = speakerMatch[2].trim();
    }

    cues.push({
      id: autoId++,
      startSeconds: Math.round(startSec * 1000) / 1000,
      endSeconds: Math.round(endSec * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
      startTime: secondsToSrtTime(startSec),
      endTime: secondsToSrtTime(endSec),
      text: cleanText || fullText,
      speaker,
    });
  }

  return cues;
}

/**
 * Formats cues back into standard SRT file string.
 */
export function formatSRT(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => {
      const id = index + 1;
      const timeLine = `${cue.startTime} --> ${cue.endTime}`;
      const text = cue.speaker && cue.speaker !== 'Narrator' ? `${cue.speaker}: ${cue.text}` : cue.text;
      return `${id}\n${timeLine}\n${text}`;
    })
    .join('\n\n');
}

export interface TextStats {
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  estimatedSeconds: number;
}

/**
 * Calculates text metrics and speech duration based on words per minute (WPM).
 */
export function calculateTextStats(text: string, wpm: number = 145): TextStats {
  if (!text) {
    return {
      characterCount: 0,
      wordCount: 0,
      sentenceCount: 0,
      estimatedSeconds: 0,
    };
  }

  const clean = text.trim();
  const characterCount = clean.length;
  const rawWords = clean.split(/\s+/).filter(Boolean);
  let wordCount = rawWords.length;

  // Check for Khmer script (\u1780-\u17FF) which frequently writes continuous text without spaces
  const isKhmer = /[\u1780-\u17FF]/.test(clean);
  if (isKhmer && (rawWords.length <= 1 || clean.replace(/\s+/g, '').length / Math.max(1, rawWords.length) > 7)) {
    // Khmer words average ~3.8 characters per word
    const nonSpaceChars = clean.replace(/\s+/g, '').length;
    wordCount = Math.max(1, Math.round(nonSpaceChars / 3.8));
  }

  // Support Khmer punctuation '។' (khan) and '៕' (bariyoosan) alongside [.!?]
  const sentences = clean.split(/[.!?\u17D4\u17D5]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;

  // Duration in seconds
  const estimatedSeconds = wordCount === 0 ? 0 : Math.round((wordCount / wpm) * 60 * 10) / 10;

  return {
    characterCount,
    wordCount,
    sentenceCount,
    estimatedSeconds,
  };
}

export interface ScriptSegment {
  type: 'text' | 'pause';
  content: string;
  durationMs: number;
}

/**
 * Parses pause tags like `[pause 0.5s]` or `[pause 1000ms]` for natural speech rhythm.
 */
export function parseScriptSegments(text: string): ScriptSegment[] {
  const pauseRegex = /\[pause\s+([0-9.]+)(s|ms)\]/gi;
  const segments: ScriptSegment[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pauseRegex.exec(text)) !== null) {
    const textChunk = text.slice(lastIndex, match.index);
    if (textChunk.trim().length > 0) {
      segments.push({
        type: 'text',
        content: textChunk,
        durationMs: 0,
      });
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const durationMs = unit === 's' ? Math.round(value * 1000) : Math.round(value);

    segments.push({
      type: 'pause',
      content: match[0],
      durationMs: Math.max(100, Math.min(10000, durationMs)),
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining.trim().length > 0 || segments.length === 0) {
    segments.push({
      type: 'text',
      content: remaining,
      durationMs: 0,
    });
  }

  return segments;
}

/**
 * Generates valid binary WAV PCM buffer from raw channel data.
 */
export function encodeWAV(
  channelData: Float32Array[],
  sampleRate: number = 44100
): Uint8Array {
  const numChannels = channelData.length;
  const numSamples = channelData[0].length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Helper to write ASCII characters
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize
  writeString(8, 'WAVE');

  // "fmt " Sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size for PCM
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bitsPerSample

  // "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      // Clamp between -1 and 1
      const s = Math.max(-1, Math.min(1, channelData[ch][i]));
      // Convert float to 16-bit signed integer
      const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

export interface AudioExportConfig {
  format: 'wav' | 'mp3';
  sampleRate: number; // e.g. 44100, 48000, 24000
  bitrate: number; // e.g. 128, 192, 320 (kbps)
  channels: 'mono' | 'stereo';
  normalizeGain?: boolean;
  targetPeakDb?: number;
  enableLimiter?: boolean;
}

export interface NormalizationPreset {
  id: string;
  name: string;
  nameKm: string;
  targetDb: number;
  mode: 'peak' | 'rms';
  description: string;
  descriptionKm: string;
}

export const NORMALIZATION_PRESETS: NormalizationPreset[] = [
  {
    id: 'ebu_true_peak',
    name: 'Broadcast True Peak (-1.0 dBFS)',
    nameKm: 'ស្តង់ដារផ្សាយ True Peak (-1.0 dBFS)',
    targetDb: -1.0,
    mode: 'peak',
    description: 'EBU R128 / ITU standard to prevent inter-sample clipping.',
    descriptionKm: 'ស្តង់ដារ EBU R128 ការពារកុំឱ្យសំឡេងបែក ឬរហែក។',
  },
  {
    id: 'voice_dialogue',
    name: 'Voiceover Dialogue (-3.0 dBFS)',
    nameKm: 'កម្រិតសំឡេងនិយាយ Voiceover (-3.0 dBFS)',
    targetDb: -3.0,
    mode: 'peak',
    description: 'Clean balanced vocal level recommended for podcasts & narration.',
    descriptionKm: 'កម្រិតល្អឥតខ្ចោះសម្រាប់ផតខាស់ និងការបញ្ចូលសំឡេង។',
  },
  {
    id: 'streaming_rms',
    name: 'Streaming Loudness (-14 dB RMS)',
    nameKm: 'កម្រិតចាក់ផ្សាយ Streaming (-14 dB RMS)',
    targetDb: -14.0,
    mode: 'rms',
    description: 'Target for Spotify, YouTube, and Apple Podcasts consistency.',
    descriptionKm: 'គោលដៅសម្រាប់ Spotify, YouTube និង Apple Podcasts។',
  },
  {
    id: 'max_headroom',
    name: 'Max Headroom Peak (-0.1 dBFS)',
    nameKm: 'កម្រិតខ្ពស់បំផុត (-0.1 dBFS)',
    targetDb: -0.1,
    mode: 'peak',
    description: 'Maximum volume normalization without clipping 0 dB digital ceiling.',
    descriptionKm: 'បង្កើនកម្រិតសំឡេងដល់អតិបរមាដោយមិនបែកសំឡេង។',
  },
];

/**
 * Converts linear amplitude (0.0 to 1.0+) to decibels Full Scale (dBFS).
 */
export function linearToDb(linear: number): number {
  if (linear <= 0.00001) return -100;
  return Math.round(20 * Math.log10(linear) * 10) / 10;
}

/**
 * Converts decibels Full Scale (dBFS) to linear amplitude multiplier.
 */
export function dbToLinear(db: number): number {
  if (db <= -100) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Measures the maximum absolute peak level in an audio buffer.
 */
export function calculatePeakLevel(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) {
      peak = abs;
    }
  }
  return Math.round(peak * 10000) / 10000;
}

/**
 * Measures the Root Mean Square (RMS) energy level of an audio buffer.
 */
export function calculateRMSLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.round(Math.sqrt(sum / samples.length) * 10000) / 10000;
}

export interface NormalizationResult {
  gainMultiplier: number;
  gainPercentage: number;
  deltaDb: number;
  currentPeakDb: number;
  currentRmsDb: number;
  projectedPeakDb: number;
  willClipWithoutLimiter: boolean;
}

/**
 * Calculates the exact normalization gain multiplier required to hit a target dB level.
 */
export function calculateNormalizationGain(
  peakLinear: number,
  rmsLinear: number,
  mode: 'peak' | 'rms',
  targetDb: number
): NormalizationResult {
  const currentPeak = Math.max(0.0001, peakLinear);
  const currentRms = Math.max(0.0001, rmsLinear);
  const targetLinear = dbToLinear(targetDb);

  const referenceLinear = mode === 'rms' ? currentRms : currentPeak;
  const gainMultiplier = targetLinear / referenceLinear;
  const gainPercentage = Math.round(gainMultiplier * 100);

  const currentPeakDb = linearToDb(currentPeak);
  const currentRmsDb = linearToDb(currentRms);
  const projectedPeakLinear = currentPeak * gainMultiplier;
  const projectedPeakDb = linearToDb(projectedPeakLinear);
  const deltaDb = Math.round((linearToDb(targetLinear) - linearToDb(referenceLinear)) * 10) / 10;

  return {
    gainMultiplier,
    gainPercentage,
    deltaDb,
    currentPeakDb,
    currentRmsDb,
    projectedPeakDb,
    willClipWithoutLimiter: projectedPeakLinear > 0.999,
  };
}

/**
 * High-fidelity soft-knee limiter / saturation function that prevents digital clipping
 * while preserving audio warmth without harsh square-wave truncation.
 */
export function applySoftLimiter(sample: number, threshold: number = 0.92): number {
  const abs = Math.abs(sample);
  if (abs <= threshold) {
    return sample;
  }
  // Soft compression above threshold: threshold + (1 - threshold) * tanh((abs - threshold) / (1 - threshold))
  const excess = (abs - threshold) / (1 - threshold);
  const compressed = threshold + (1 - threshold) * Math.tanh(excess);
  const clamped = Math.min(0.999, compressed);
  return sample < 0 ? -clamped : clamped;
}

/**
 * Applies normalization gain and optional soft-knee limiting to audio channel buffers.
 */
export function applyVolumeNormalization(
  channelData: Float32Array[],
  gainMultiplier: number,
  enableLimiter: boolean = true
): Float32Array[] {
  return channelData.map((channel) => {
    const output = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const scaled = channel[i] * gainMultiplier;
      output[i] = enableLimiter ? applySoftLimiter(scaled) : Math.max(-1.0, Math.min(1.0, scaled));
    }
    return output;
  });
}

export const DEFAULT_EXPORT_CONFIG: AudioExportConfig = {
  format: 'wav',
  sampleRate: 44100,
  bitrate: 192,
  channels: 'mono',
  normalizeGain: true,
  targetPeakDb: -1.0,
  enableLimiter: true,
};

/**
 * Resamples multi-channel audio buffer to target sample rate using linear interpolation.
 */
export function resampleAudioBuffer(
  channelData: Float32Array[],
  fromRate: number,
  toRate: number
): Float32Array[] {
  if (fromRate === toRate || !channelData || channelData.length === 0) {
    return channelData;
  }

  const ratio = fromRate / toRate;
  const originalLength = channelData[0].length;
  const newLength = Math.round(originalLength / ratio);

  return channelData.map((channel) => {
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originalPos = i * ratio;
      const index = Math.floor(originalPos);
      const frac = originalPos - index;

      if (index >= originalLength - 1) {
        resampled[i] = channel[originalLength - 1];
      } else {
        resampled[i] = channel[index] * (1 - frac) + channel[index + 1] * frac;
      }
    }
    return resampled;
  });
}

/**
 * Calculates estimated file size and formatted string for given duration and export settings.
 */
export function calculateEstimatedFileSize(
  durationSeconds: number,
  config: AudioExportConfig
): { bytes: number; formatted: string } {
  if (durationSeconds <= 0) {
    return { bytes: 0, formatted: '0 KB' };
  }

  let bytes = 0;
  if (config.format === 'wav') {
    const numChannels = config.channels === 'stereo' ? 2 : 1;
    const bytesPerSample = 2; // 16-bit PCM
    bytes = 44 + Math.round(durationSeconds * config.sampleRate * numChannels * bytesPerSample);
  } else {
    // MP3 bitrate (e.g. 192 kbps = 192,000 bits/sec = 24,000 bytes/sec)
    bytes = Math.round(durationSeconds * ((config.bitrate * 1000) / 8));
  }

  let formatted = '';
  if (bytes < 1024 * 1024) {
    formatted = `${Math.round(bytes / 1024)} KB`;
  } else {
    formatted = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return { bytes, formatted };
}

/**
 * Synthesizes a deterministic harmonic reference tone buffer (e.g. for pitch matching practice).
 */
export function generateReferenceToneBuffer(
  frequency: number,
  durationSeconds: number = 2,
  sampleRate: number = 44100
): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let envelope = 1;
    const attackSamples = sampleRate * 0.05;
    const releaseSamples = sampleRate * 0.1;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i > numSamples - releaseSamples) {
      envelope = (numSamples - i) / releaseSamples;
    }

    const fundamental = Math.sin(2 * Math.PI * frequency * t);
    const harmonic2 = 0.3 * Math.sin(2 * Math.PI * (frequency * 2) * t);
    const harmonic3 = 0.15 * Math.sin(2 * Math.PI * (frequency * 3) * t);

    buffer[i] = (fundamental + harmonic2 + harmonic3) * 0.6 * envelope;
  }

  return buffer;
}

/**
 * Result of audio buffer slicing / trimming operation.
 */
export interface AudioSliceResult {
  channels: Float32Array[];
  sampleRate: number;
  duration: number;
  sampleCount: number;
  startSample: number;
  endSample: number;
  startTime: number;
  endTime: number;
}

/**
 * Accurately slices multi-channel Float32Array audio buffers between startTime and endTime in seconds.
 * Clamps within valid bounds and ensures a minimum duration (e.g. 0.05s).
 */
export function sliceAudioBufferData(
  channels: Float32Array[],
  sampleRate: number,
  startTime: number,
  endTime: number
): AudioSliceResult {
  if (!channels || channels.length === 0 || !channels[0] || channels[0].length === 0) {
    return {
      channels: [],
      sampleRate,
      duration: 0,
      sampleCount: 0,
      startSample: 0,
      endSample: 0,
      startTime: 0,
      endTime: 0,
    };
  }

  const totalSamples = channels[0].length;
  const totalDuration = totalSamples / sampleRate;

  // Clamp startTime to [0, totalDuration - 0.05]
  const clampedStart = Math.max(0, Math.min(startTime, Math.max(0, totalDuration - 0.05)));
  // Clamp endTime to [clampedStart + 0.05, totalDuration]
  const clampedEnd = Math.max(clampedStart + 0.05, Math.min(endTime, totalDuration));

  const startSample = Math.max(0, Math.floor(clampedStart * sampleRate));
  const endSample = Math.min(totalSamples, Math.max(startSample + 1, Math.ceil(clampedEnd * sampleRate)));
  const sampleCount = endSample - startSample;
  const slicedDuration = sampleCount / sampleRate;

  const slicedChannels = channels.map((channel) => {
    return channel.slice(startSample, endSample);
  });

  return {
    channels: slicedChannels,
    sampleRate,
    duration: Math.round(slicedDuration * 1000) / 1000,
    sampleCount,
    startSample,
    endSample,
    startTime: Math.round((startSample / sampleRate) * 1000) / 1000,
    endTime: Math.round((endSample / sampleRate) * 1000) / 1000,
  };
}

/**
 * Scans an audio channel to find the first and last non-silent audio frames.
 * Returns suggested start and end crop points with an optional safety padding.
 */
export function detectSilenceBoundaries(
  channel: Float32Array,
  sampleRate: number,
  thresholdDb: number = -38,
  paddingSeconds: number = 0.05
): { start: number; end: number; detectedSilence: boolean } {
  if (!channel || channel.length === 0) {
    return { start: 0, end: 0, detectedSilence: false };
  }

  const totalDuration = channel.length / sampleRate;
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  let firstIndex = -1;
  let lastIndex = -1;

  // Windowed scan with peak to prevent single-sample noise triggers
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms window

  for (let i = 0; i < channel.length; i += windowSize) {
    let windowPeak = 0;
    const limit = Math.min(channel.length, i + windowSize);
    for (let j = i; j < limit; j++) {
      const absVal = Math.abs(channel[j]);
      if (absVal > windowPeak) windowPeak = absVal;
    }

    if (windowPeak >= thresholdLinear) {
      if (firstIndex === -1) {
        firstIndex = i;
      }
      lastIndex = limit;
    }
  }

  if (firstIndex === -1 || lastIndex === -1 || firstIndex >= lastIndex) {
    // Entirely silent or quiet audio
    return { start: 0, end: Math.round(totalDuration * 100) / 100, detectedSilence: false };
  }

  const paddingSamples = Math.floor(paddingSeconds * sampleRate);
  const paddedStartIndex = Math.max(0, firstIndex - paddingSamples);
  const paddedEndIndex = Math.min(channel.length, lastIndex + paddingSamples);

  const startSec = Math.round((paddedStartIndex / sampleRate) * 100) / 100;
  const endSec = Math.round((paddedEndIndex / sampleRate) * 100) / 100;

  return {
    start: startSec,
    end: endSec,
    detectedSilence: startSec > 0.05 || endSec < totalDuration - 0.05,
  };
}

/**
 * Formats time in seconds to mm:ss.ms or s.ms string
 */
export function formatAudioSeconds(seconds: number, includeMs: boolean = true): string {
  if (isNaN(seconds) || seconds < 0) return '0.00s';
  if (seconds < 60) {
    return includeMs ? `${seconds.toFixed(2)}s` : `${Math.floor(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  const remStr = includeMs ? remSecs.toFixed(2).padStart(5, '0') : Math.floor(remSecs).toString().padStart(2, '0');
  return `${mins}:${remStr}`;
}
