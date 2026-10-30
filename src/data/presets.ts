import { VoiceProfile, PracticeSentence } from '../types';

export const CURATED_VOICES: VoiceProfile[] = [
  {
    id: 'en-US-emma',
    name: 'Emma',
    lang: 'en-US',
    languageLabel: 'English (US)',
    country: '🇺🇸',
    gender: 'female',
    tone: 'Warm, Conversational & Friendly',
    tags: ['Podcast', 'Narration', 'Natural'],
    sampleText: 'Welcome to VoiceTool! Create hyper-realistic voiceovers in seconds.',
  },
  {
    id: 'en-US-marcus',
    name: 'Marcus',
    lang: 'en-US',
    languageLabel: 'English (US)',
    country: '🇺🇸',
    gender: 'male',
    tone: 'Deep, Resonant & Authoritative',
    tags: ['Documentary', 'Trailer', 'Deep'],
    sampleText: 'Deep in the heart of the cosmos, ancient stars forge the building blocks of life.',
  },
  {
    id: 'en-GB-arthur',
    name: 'Arthur',
    lang: 'en-GB',
    languageLabel: 'English (UK)',
    country: '🇬🇧',
    gender: 'male',
    tone: 'Refined, Eloquent & Sophisticated',
    tags: ['Audiobook', 'BBC Style', 'Executive'],
    sampleText: 'Every grand expedition begins with a single curious glance across the horizon.',
  },
  {
    id: 'en-GB-olivia',
    name: 'Olivia',
    lang: 'en-GB',
    languageLabel: 'English (UK)',
    country: '🇬🇧',
    gender: 'female',
    tone: 'Crisp, Clear & Professional',
    tags: ['Corporate', 'News', 'Explainer'],
    sampleText: 'Good morning. Here is your executive briefing on today’s technology developments.',
  },
  {
    id: 'en-US-sophia',
    name: 'Sophia',
    lang: 'en-US',
    languageLabel: 'English (US)',
    country: '🇺🇸',
    gender: 'female',
    tone: 'Bright, Upbeat & Commercial',
    tags: ['Commercial', 'Social Media', 'Youth'],
    sampleText: 'Upgrade your productivity today with the fastest audio suite built for creators!',
  },
  {
    id: 'en-AU-liam',
    name: 'Liam',
    lang: 'en-AU',
    languageLabel: 'English (Australia)',
    country: '🇦🇺',
    gender: 'male',
    tone: 'Laid-back, Crisp & Engaging',
    tags: ['Vlog', 'Storytelling', 'Casual'],
    sampleText: 'G’day mate! Join us as we explore the hidden reefs along the sunlit coast.',
  },
  {
    id: 'en-IN-aarav',
    name: 'Aarav',
    lang: 'en-IN',
    languageLabel: 'English (India)',
    country: '🇮🇳',
    gender: 'male',
    tone: 'Articulate, Confident & Tech-Savvy',
    tags: ['Tech Tutorial', 'E-Learning', 'Clear'],
    sampleText: 'In this module, we will explore how neural audio synthesis powers modern applications.',
  },
  {
    id: 'es-ES-elena',
    name: 'Elena',
    lang: 'es-ES',
    languageLabel: 'Spanish (Spain)',
    country: '🇪🇸',
    gender: 'female',
    tone: 'Melodic, Natural & Expressive',
    tags: ['Audiobook', 'Travel', 'Warm'],
    sampleText: 'Hola y bienvenidos. Descubre una nueva forma de dar vida a tus historias en audio.',
  },
  {
    id: 'fr-FR-camille',
    name: 'Camille',
    lang: 'fr-FR',
    languageLabel: 'French (France)',
    country: '🇫🇷',
    gender: 'female',
    tone: 'Elegant, Smooth & Poetic',
    tags: ['Luxury', 'Culture', 'Cinema'],
    sampleText: 'Bienvenue dans l’univers sonore de VoiceTool, où chaque mot prend toute sa dimension.',
  },
  {
    id: 'de-DE-felix',
    name: 'Felix',
    lang: 'de-DE',
    languageLabel: 'German (Germany)',
    country: '🇩🇪',
    gender: 'male',
    tone: 'Precise, Direct & Clear',
    tags: ['Instructional', 'Business', 'Formal'],
    sampleText: 'Präzision und Klarheit für Ihre professionellen Audio- und Videoprojekte.',
  },
  {
    id: 'ja-JP-aoi',
    name: 'Aoi (葵)',
    lang: 'ja-JP',
    languageLabel: 'Japanese (Japan)',
    country: '🇯🇵',
    gender: 'female',
    tone: 'Gentle, Polite & Anime Style',
    tags: ['Anime', 'Narrative', 'Gentle'],
    sampleText: 'こんにちは！VoiceToolへようこそ。自然で美しい音声をお届けします。',
  },
  {
    id: 'it-IT-chiara',
    name: 'Chiara',
    lang: 'it-IT',
    languageLabel: 'Italian (Italy)',
    country: '🇮🇹',
    gender: 'female',
    tone: 'Warm, Vibrant & Dramatic',
    tags: ['Story', 'Culinary', 'Emotion'],
    sampleText: 'Benvenuti nel nostro laboratorio audio: parole e melodie che toccano il cuore.',
  },
];

export const SAMPLE_SCRIPTS = [
  {
    title: 'Product Launch Trailer',
    category: 'Commercial',
    text: `Meet VoiceTool: the next-generation audio workstation for creators. [pause 0.5s] Transform any script into studio-quality voiceovers with natural pacing, customizable pitch, and synchronized subtitle dubbing. [pause 0.8s] Download in uncompressed WAV or stream directly. Your voice, perfected.`,
  },
  {
    title: 'Documentary Narration',
    category: 'Audiobook',
    text: `At the high elevations of the volcanic plateau, temperatures plummet as twilight descends. [pause 0.6s] The silence is broken only by the whistling alpine wind. [pause 1.0s] Here, resilience is not just a virtue—it is the very condition of survival.`,
  },
  {
    title: 'Tech Tutorial & Coding',
    category: 'Education',
    text: `In this step, we initialize the Web Audio API context. [pause 0.4s] By attaching a real-time AnalyserNode to the input stream, we can extract frequency spectrum data and fundamental pitch values at 60 frames per second.`,
  },
  {
    title: 'Mindful Meditation Guide',
    category: 'Wellness',
    text: `Gently close your eyes and bring your attention to your breathing. [pause 1.2s] Inhale slowly through your nose, filling your lungs with fresh energy. [pause 1.5s] And exhale completely, letting go of all tension in your shoulders.`,
  },
  {
    title: 'Quick Social Media Hook',
    category: 'Social Media',
    text: `Stop scrolling! Did you know you can generate multi-language voiceovers for your video in under ten seconds? Check this out right now!`,
  },
];

export const PRACTICE_SENTENCES: PracticeSentence[] = [
  {
    id: 'rainbow-1',
    title: 'The Rainbow Passage (Section 1)',
    category: 'Resonance',
    targetPitchMinHz: 165,
    targetPitchMaxHz: 235,
    sentence: 'When the sunlight strikes raindrops in the air, they act like a prism and form a rainbow.',
    tip: 'Focus on forward vocal resonance in the mask of your face rather than chest vibrations.',
  },
  {
    id: 'rainbow-2',
    title: 'The Rainbow Passage (Section 2)',
    category: 'Resonance',
    targetPitchMinHz: 170,
    targetPitchMaxHz: 240,
    sentence: 'The rainbow is a division of white light into many beautiful colors, taking the shape of a long round arch.',
    tip: 'Keep your larynx slightly elevated and maintain a relaxed, open throat.',
  },
  {
    id: 'arthur-rat',
    title: 'Arthur the Rat',
    category: 'Feminization',
    targetPitchMinHz: 185,
    targetPitchMaxHz: 250,
    sentence: 'Once upon a time there was a young rat named Arthur, who could never make up his mind.',
    tip: 'Aim for a dynamic pitch inflection with gentle melody shifts at sentence ends.',
  },
  {
    id: 'masculine-1',
    title: 'Chest Resonance Practice',
    category: 'Masculinization',
    targetPitchMinHz: 90,
    targetPitchMaxHz: 145,
    sentence: 'Deep ocean currents move vast amounts of cool water beneath the stormy waves.',
    tip: 'Feel the sympathetic vibration deep in your upper sternum and relax downward.',
  },
  {
    id: 'warmup-1',
    title: 'Vocal Stability & Sustained Pitch',
    category: 'Vocal Warmup',
    targetPitchMinHz: 150,
    targetPitchMaxHz: 220,
    sentence: 'Singing sweet morning melodies brings peaceful harmony throughout the whole day.',
    tip: 'Sustain the vowel sounds steadily without letting your pitch wobble.',
  },
  {
    id: 'daily-phone',
    title: 'Phone Customer Service Tone',
    category: 'Articulation',
    targetPitchMinHz: 175,
    targetPitchMaxHz: 230,
    sentence: 'Hello! Thank you for calling VoiceTool today. How may I direct your call?',
    tip: 'Smile gently while speaking to naturally lift the oral cavity and brighten the tone.',
  },
];

export const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,200
Emma: Welcome to the future of voice production with VoiceTool.

2
00:00:04,800 --> 00:00:08,500
Arthur: Subtitle-to-Speech allows you to dub video projects with sample-accurate timing.

3
00:00:09,100 --> 00:00:12,600
Emma: You can assign distinct characters, preview line-by-line, and export audio tracks.

4
00:00:13,200 --> 00:00:16,800
Arthur: Perfect for YouTube dubbing, e-learning courses, and multilingual translation!`;
