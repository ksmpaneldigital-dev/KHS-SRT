export type ActiveTab = 'tts' | 'subtitles' | 'pitch' | 'recorder' | 'tools' | 'library';

export interface VoiceProfile {
  id: string;
  name: string;
  lang: string;
  languageLabel: string;
  country: string;
  gender: 'female' | 'male' | 'neutral';
  tone: string;
  tags: string[];
  sampleText?: string;
  browserVoiceName?: string;
}

export interface SavedAudioItem {
  id: string;
  title: string;
  type: 'tts' | 'recording' | 'subtitle' | 'tool';
  createdAt: number;
  durationSeconds: number;
  audioBlobUrl?: string;
  audioBase64?: string;
  transcript?: string;
  voiceName?: string;
  fileSizeFormatted?: string;
}

export interface PracticeSentence {
  id: string;
  title: string;
  category: 'Feminization' | 'Masculinization' | 'Resonance' | 'Vocal Warmup' | 'Articulation';
  targetPitchMinHz: number;
  targetPitchMaxHz: number;
  sentence: string;
  tip: string;
}

export type { SubtitleCue } from '../utils/audioMath';
