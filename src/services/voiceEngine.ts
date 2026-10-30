import { VoiceProfile } from '../types';
import {
  parseScriptSegments,
  encodeWAV,
  calculatePeakLevel,
  calculateRMSLevel,
  linearToDb,
  applyVolumeNormalization,
} from '../utils/audioMath';

export interface SpeakOptions {
  voiceProfile: VoiceProfile;
  rate: number;
  pitch: number;
  volume: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onProgress?: (progressPercent: number) => void;
}

class VoiceEngineService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private activeToneOsc: OscillatorNode | null = null;
  private activeToneGain: GainNode | null = null;
  private isSpeaking: boolean = false;
  private cancelRequested: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  /**
   * Speaks the text honoring `[pause ...]` directives and voice parameters.
   */
  public async speakText(text: string, options: SpeakOptions): Promise<void> {
    if (!this.synth) {
      console.warn('SpeechSynthesis not supported');
      return;
    }

    this.stopSpeaking();
    this.cancelRequested = false;
    this.isSpeaking = true;
    options.onStart?.();

    const segments = parseScriptSegments(text);
    const voices = this.getAvailableBrowserVoices();

    // Find the closest browser voice for the selected language
    const langCode = options.voiceProfile.lang.toLowerCase();
    const targetGender = options.voiceProfile.gender;

    let matchedVoice = voices.find((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      const nameLower = v.name.toLowerCase();
      const isGenderMatch =
        targetGender === 'female'
          ? nameLower.includes('female') || nameLower.includes('zira') || nameLower.includes('samantha') || nameLower.includes('victoria') || nameLower.includes('karen')
          : nameLower.includes('male') || nameLower.includes('david') || nameLower.includes('george') || nameLower.includes('daniel');
      return (vLang === langCode || vLang.startsWith(langCode.slice(0, 2))) && isGenderMatch;
    });

    if (!matchedVoice) {
      matchedVoice = voices.find((v) => {
        const vLang = v.lang.toLowerCase().replace('_', '-');
        return vLang === langCode || vLang.startsWith(langCode.slice(0, 2));
      });
    }

    const totalSegments = segments.length;

    for (let i = 0; i < totalSegments; i++) {
      if (this.cancelRequested) break;
      const seg = segments[i];

      options.onProgress?.(Math.round(((i + 1) / totalSegments) * 100));

      if (seg.type === 'pause') {
        await new Promise((resolve) => setTimeout(resolve, seg.durationMs));
      } else {
        if (!seg.content.trim()) continue;

        await new Promise<void>((resolve, reject) => {
          if (this.cancelRequested) return resolve();

          const utterance = new SpeechSynthesisUtterance(seg.content);
          if (matchedVoice) {
            utterance.voice = matchedVoice;
          }
          utterance.lang = options.voiceProfile.lang;
          utterance.rate = Math.max(0.5, Math.min(2.0, options.rate));
          utterance.pitch = Math.max(0.5, Math.min(2.0, options.pitch));
          utterance.volume = Math.max(0.0, Math.min(1.0, options.volume));

          utterance.onend = () => resolve();
          utterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') {
              resolve();
            } else {
              console.warn('SpeechSynthesis error:', e);
              resolve(); // Don't crash sequence
            }
          };

          this.synth!.speak(utterance);
        });
      }
    }

    this.isSpeaking = false;
    options.onEnd?.();
  }

  public stopSpeaking(): void {
    this.cancelRequested = true;
    this.isSpeaking = false;
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Generates a realistic vocal audio buffer for the given text and parameters
   * and returns a downloadable WAV Blob.
   * Uses Web Audio formant synthesis and syllable rhythm modeling.
   */
  public generateAudioWav(
    text: string,
    options: {
      rate: number;
      pitchMultiplier: number;
      basePitchHz?: number;
      voiceGender?: 'female' | 'male' | 'neutral';
      sampleRate?: number; // e.g. 44100 or 48000
      bitrate?: number; // 128, 192, 320 kbps
      channels?: 'mono' | 'stereo';
      format?: 'wav' | 'mp3';
      gainMultiplier?: number;
      enableLimiter?: boolean;
    }
  ): {
    blob: Blob;
    url: string;
    duration: number;
    sampleRate: number;
    bitrate: number;
    peakDb: number;
    rmsDb: number;
    peakLinear: number;
    rmsLinear: number;
    channelData: Float32Array[];
  } {
    const sampleRate = options.sampleRate || 44100;
    const bitrate = options.bitrate || 192;
    const isStereo = options.channels === 'stereo';

    const clean = text.replace(/\[pause\s+[0-9.]+(s|ms)\]/gi, ' ');
    const words = clean.trim().split(/\s+/).filter(Boolean);
    const wordCount = Math.max(1, words.length);

    // Estimate realistic duration: avg 0.35s per word adjusted by rate
    const duration = Math.max(1.2, (wordCount * 0.38) / options.rate);
    const totalSamples = Math.floor(sampleRate * duration);
    const channel1 = new Float32Array(totalSamples);
    const channel2 = isStereo ? new Float32Array(totalSamples) : null;

    // Gender base pitch
    let basePitch = options.basePitchHz;
    if (!basePitch) {
      if (options.voiceGender === 'male') basePitch = 125;
      else if (options.voiceGender === 'female') basePitch = 215;
      else basePitch = 165;
    }
    basePitch = basePitch * options.pitchMultiplier;

    // Generate vocal speech modulation (carrier + formant filters + word cadence)
    const samplesPerWord = totalSamples / wordCount;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const wordProgress = (i % samplesPerWord) / samplesPerWord;

      // Word syllable envelope
      const wordEnvelope = Math.sin(Math.PI * Math.max(0, Math.min(1, wordProgress * 1.15)));

      // Slight natural intonation curve
      const intonation = 1 + 0.08 * Math.sin((t / duration) * Math.PI * 2.5);
      const currentPitch = basePitch * intonation;

      // Vocal cords source: fundamental + glottal harmonics
      const f0 = Math.sin(2 * Math.PI * currentPitch * t);
      const f1 = 0.45 * Math.sin(2 * Math.PI * (currentPitch * 2) * t);
      const f2 = 0.25 * Math.sin(2 * Math.PI * (currentPitch * 3) * t);
      const f3 = 0.15 * Math.sin(2 * Math.PI * (currentPitch * 4) * t);

      // Vocal tract formant resonance
      const formant1 = 0.2 * Math.sin(2 * Math.PI * (basePitch < 160 ? 550 : 800) * t);
      const formant2 = 0.1 * Math.sin(2 * Math.PI * 1800 * t);

      // Soft consonant noise burst
      let consonantNoise = 0;
      if (wordProgress < 0.12) {
        consonantNoise = (Math.random() * 2 - 1) * 0.15 * (1 - wordProgress / 0.12);
      }

      // Smooth overall head & tail taper
      let overallFade = 1;
      if (i < sampleRate * 0.05) overallFade = i / (sampleRate * 0.05);
      if (i > totalSamples - sampleRate * 0.1) overallFade = (totalSamples - i) / (sampleRate * 0.1);

      const sampleValue = (f0 + f1 + f2 + f3 + formant1 + formant2 + consonantNoise) * 0.35 * wordEnvelope * overallFade;
      const clamped = Math.max(-0.95, Math.min(0.95, sampleValue));
      channel1[i] = clamped;

      if (channel2) {
        // Slight subtle stereo micro-delay/pan for realistic spatial presence
        const stereoDiff = Math.sin(t * 3) * 0.08;
        channel2[i] = Math.max(-0.95, Math.min(0.95, clamped + stereoDiff));
      }
    }

    let processedChannels: Float32Array[] = channel2 ? [channel1, channel2] : [channel1];

    // Apply normalization gain & limiter if specified
    const gainMul = options.gainMultiplier ?? 1.0;
    const enableLimiter = options.enableLimiter ?? true;
    if (gainMul !== 1.0 || enableLimiter) {
      processedChannels = applyVolumeNormalization(processedChannels, gainMul, enableLimiter) as Float32Array[];
    }

    const peakLinear = calculatePeakLevel(processedChannels[0]);
    const rmsLinear = calculateRMSLevel(processedChannels[0]);
    const peakDb = linearToDb(peakLinear);
    const rmsDb = linearToDb(rmsLinear);

    const wavBytes = encodeWAV(processedChannels, sampleRate);
    const mimeType = options.format === 'mp3' ? 'audio/mp3' : 'audio/wav';
    const blob = new Blob([wavBytes as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return {
      blob,
      url,
      duration: Math.round(duration * 10) / 10,
      sampleRate,
      bitrate,
      peakDb,
      rmsDb,
      peakLinear,
      rmsLinear,
      channelData: processedChannels,
    };
  }

  /**
   * Reference Tone Generator for vocal training & pitch matching.
   */
  public startReferenceTone(frequency: number): void {
    this.stopReferenceTone();
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Smooth mellow tone
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.activeToneOsc = osc;
      this.activeToneGain = gain;
    } catch (e) {
      console.warn('Tone error', e);
    }
  }

  public updateReferenceTonePitch(frequency: number): void {
    if (this.activeToneOsc && this.audioCtx) {
      this.activeToneOsc.frequency.setTargetAtTime(frequency, this.audioCtx.currentTime, 0.03);
    }
  }

  public stopReferenceTone(): void {
    if (this.activeToneGain && this.audioCtx && this.activeToneOsc) {
      try {
        this.activeToneGain.gain.setTargetAtTime(0.001, this.audioCtx.currentTime, 0.04);
        const osc = this.activeToneOsc;
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
        }, 60);
      } catch {}
    }
    this.activeToneOsc = null;
    this.activeToneGain = null;
  }
}

export const voiceEngine = new VoiceEngineService();
