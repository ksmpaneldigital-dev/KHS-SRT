import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frequencyToNote,
  getVocalRangeCategory,
  autoCorrelate,
  srtTimeToSeconds,
  secondsToSrtTime,
  parseSRT,
  formatSRT,
  calculateTextStats,
  parseScriptSegments,
  encodeWAV,
  generateReferenceToneBuffer,
  calculateEstimatedFileSize,
  linearToDb,
  dbToLinear,
  calculatePeakLevel,
  calculateRMSLevel,
  calculateNormalizationGain,
  applySoftLimiter,
  applyVolumeNormalization,
  NORMALIZATION_PRESETS,
  sliceAudioBufferData,
  detectSilenceBoundaries,
  formatAudioSeconds,
} from './audioMath';

test('frequencyToNote accurately identifies musical notes', () => {
  const a4 = frequencyToNote(440);
  assert.ok(a4);
  assert.equal(a4.note, 'A4');
  assert.equal(a4.cents, 0);

  const c4 = frequencyToNote(261.63);
  assert.ok(c4);
  assert.equal(c4.note, 'C4');

  const invalid = frequencyToNote(0);
  assert.equal(invalid, null);
});

test('getVocalRangeCategory classifies speech pitches correctly', () => {
  const deepMale = getVocalRangeCategory(110);
  assert.equal(deepMale.category, 'Masculine');

  const androgynous = getVocalRangeCategory(170);
  assert.equal(androgynous.category, 'Androgynous');

  const feminine = getVocalRangeCategory(220);
  assert.equal(feminine.category, 'Feminine');

  const high = getVocalRangeCategory(350);
  assert.equal(high.category, 'Soprano');
});

test('srtTimeToSeconds and secondsToSrtTime roundtrip correctly', () => {
  const timeStr = '00:01:23,456';
  const seconds = srtTimeToSeconds(timeStr);
  assert.equal(seconds, 83.456);

  const formatted = secondsToSrtTime(seconds);
  assert.equal(formatted, timeStr);
});

test('parseSRT parses subtitle cues with timecodes and speaker tags', () => {
  const srtContent = `1
00:00:01,000 --> 00:00:04,500
Alice: Welcome to VoiceTool audio suite!

2
00:00:05,200 --> 00:00:08,800
Generate neural voiceovers effortlessly.`;

  const cues = parseSRT(srtContent);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].id, 1);
  assert.equal(cues[0].startSeconds, 1);
  assert.equal(cues[0].endSeconds, 4.5);
  assert.equal(cues[0].speaker, 'Alice');
  assert.equal(cues[0].text, 'Welcome to VoiceTool audio suite!');

  assert.equal(cues[1].id, 2);
  assert.equal(cues[1].speaker, 'Narrator');
  assert.equal(cues[1].text, 'Generate neural voiceovers effortlessly.');

  // Test formatSRT reconstructs
  const srtOut = formatSRT(cues);
  assert.ok(srtOut.includes('Alice: Welcome to VoiceTool'));
  assert.ok(srtOut.includes('00:00:05,200 --> 00:00:08,800'));
});

test('calculateTextStats counts characters, words, sentences and estimated duration', () => {
  const text = 'Hello world! This is a test. Are you ready?';
  const stats = calculateTextStats(text, 150);
  assert.equal(stats.wordCount, 9);
  assert.equal(stats.sentenceCount, 3);
  assert.ok(stats.estimatedSeconds > 0);
});

test('parseScriptSegments detects pause directives', () => {
  const script = 'Hello world. [pause 1.5s] Welcome to the studio. [pause 500ms] Done!';
  const segments = parseScriptSegments(script);
  assert.equal(segments.length, 5);
  assert.equal(segments[0].type, 'text');
  assert.equal(segments[1].type, 'pause');
  assert.equal(segments[1].durationMs, 1500);
  assert.equal(segments[3].type, 'pause');
  assert.equal(segments[3].durationMs, 500);
});

test('encodeWAV produces valid 44-byte RIFF WAVE header', () => {
  const sampleRate = 44100;
  const channelData = [new Float32Array(100)];
  const wavBytes = encodeWAV(channelData, sampleRate);

  // Check header length
  assert.ok(wavBytes.length >= 44 + 200);

  // Check "RIFF"
  const headerAscii = String.fromCharCode(...wavBytes.subarray(0, 4));
  assert.equal(headerAscii, 'RIFF');

  // Check "WAVE"
  const waveAscii = String.fromCharCode(...wavBytes.subarray(8, 12));
  assert.equal(waveAscii, 'WAVE');
});

test('generateReferenceToneBuffer creates sinusoidal audio buffer and autoCorrelate detects pitch', () => {
  const sampleRate = 44100;
  const targetFreq = 220; // A3
  const buffer = generateReferenceToneBuffer(targetFreq, 0.5, sampleRate);
  assert.equal(buffer.length, 22050);

  const detected = autoCorrelate(buffer, sampleRate);
  assert.ok(detected > 215 && detected < 225, `Expected ~220Hz, detected: ${detected}`);
});

test('encodeWAV writes custom sample rates (44.1kHz vs 48kHz) into RIFF header', () => {
  const channelData = [new Float32Array(480)];

  // Test 44.1kHz
  const wav44 = encodeWAV(channelData, 44100);
  const view44 = new DataView(wav44.buffer, wav44.byteOffset, wav44.byteLength);
  const sampleRate44 = view44.getUint32(24, true);
  assert.equal(sampleRate44, 44100);

  // Test 48kHz
  const wav48 = encodeWAV(channelData, 48000);
  const view48 = new DataView(wav48.buffer, wav48.byteOffset, wav48.byteLength);
  const sampleRate48 = view48.getUint32(24, true);
  assert.equal(sampleRate48, 48000);
});

test('calculateEstimatedFileSize accurately estimates WAV and MP3 bitrates', () => {
  const duration = 10; // 10 seconds

  // 44.1kHz 16-bit mono WAV: 10 * 44100 * 1 * 2 + 44 = 882044 bytes (~861 KB)
  const wav44Est = calculateEstimatedFileSize(duration, {
    format: 'wav',
    sampleRate: 44100,
    bitrate: 192,
    channels: 'mono',
  });
  assert.ok(wav44Est.bytes > 880000 && wav44Est.bytes < 885000);
  assert.equal(wav44Est.formatted, '861 KB');

  // 48kHz 16-bit mono WAV: 10 * 48000 * 1 * 2 + 44 = 960044 bytes (~938 KB)
  const wav48Est = calculateEstimatedFileSize(duration, {
    format: 'wav',
    sampleRate: 48000,
    bitrate: 192,
    channels: 'mono',
  });
  assert.ok(wav48Est.bytes > 950000 && wav48Est.bytes < 965000);

  // 128kbps MP3: 10 * (128000 / 8) = 160000 bytes (~156 KB)
  const mp3_128 = calculateEstimatedFileSize(duration, {
    format: 'mp3',
    sampleRate: 44100,
    bitrate: 128,
    channels: 'stereo',
  });
  assert.equal(mp3_128.bytes, 160000);
  assert.equal(mp3_128.formatted, '156 KB');

  // 320kbps MP3: 10 * (320000 / 8) = 400000 bytes (~391 KB)
  const mp3_320 = calculateEstimatedFileSize(duration, {
    format: 'mp3',
    sampleRate: 44100,
    bitrate: 320,
    channels: 'stereo',
  });
  assert.equal(mp3_320.bytes, 400000);
  assert.equal(mp3_320.formatted, '391 KB');
});

test('calculateTextStats correctly handles Khmer language text and punctuation (។ and ៕)', () => {
  // Continuous Khmer script without standard ASCII spaces, punctuated by '។'
  const khmerText = 'សូមស្វាគមន៍មកកាន់ VoiceTool ស្ទូឌីយោសំឡេងឆ្លាតវៃ។ បម្លែងអត្ថបទរបស់អ្នកទៅជាសំឡេងនិយាយបែបធម្មជាតិ។';
  const stats = calculateTextStats(khmerText, 145);

  assert.ok(stats.characterCount > 50);
  assert.ok(stats.wordCount >= 10);
  assert.equal(stats.sentenceCount, 2); // 2 sentences separated by '។'
  assert.ok(stats.estimatedSeconds > 0);
});

test('linearToDb and dbToLinear convert accurately', () => {
  assert.equal(linearToDb(1.0), 0);
  const dbMinus6 = linearToDb(0.5);
  assert.ok(dbMinus6 >= -6.1 && dbMinus6 <= -5.9, `Expected ~ -6.0 dB, got ${dbMinus6}`);
  assert.equal(linearToDb(0), -100);

  const linear0 = dbToLinear(0);
  assert.ok(Math.abs(linear0 - 1.0) < 0.001);

  const linearMinus6 = dbToLinear(-6.02);
  assert.ok(Math.abs(linearMinus6 - 0.5) < 0.01);
});

test('calculatePeakLevel and calculateRMSLevel correctly analyze audio buffers', () => {
  const samples = new Float32Array([0, 0.2, -0.8, 0.5, -0.3, 0.1]);
  const peak = calculatePeakLevel(samples);
  assert.equal(peak, 0.8);

  const rms = calculateRMSLevel(samples);
  assert.ok(rms > 0.35 && rms < 0.5, `RMS should be around 0.42, got ${rms}`);
});

test('calculateNormalizationGain calculates accurate boost for quiet voiceovers', () => {
  // A quiet signal with peak 0.25 (-12 dBFS)
  const currentPeak = 0.25;
  const currentRms = 0.08;
  const targetDb = -1.0; // EBU True Peak (~0.89 linear)

  const result = calculateNormalizationGain(currentPeak, currentRms, 'peak', targetDb);
  assert.ok(result.gainMultiplier > 3.5 && result.gainMultiplier < 3.6, `Gain multiplier should be ~3.56, got ${result.gainMultiplier}`);
  assert.ok(result.gainPercentage > 350 && result.gainPercentage < 360);
  assert.ok(result.deltaDb > 10.5 && result.deltaDb < 11.5);
  assert.ok(!result.willClipWithoutLimiter); // Projected peak is -1 dBFS (< 1.0)
});

test('calculateNormalizationGain detects hot signals and warns about clipping when target exceeds 0 dBFS', () => {
  const currentPeak = 0.95;
  const currentRms = 0.70;
  // If target is boosted inappropriately
  const result = calculateNormalizationGain(currentPeak, currentRms, 'peak', 3.0); // +3 dBFS
  assert.ok(result.gainMultiplier > 1.3);
  assert.equal(result.willClipWithoutLimiter, true);
});

test('applySoftLimiter prevents digital clipping and keeps output bounded < 1.0', () => {
  // Input below threshold (0.92) is untouched
  assert.equal(applySoftLimiter(0.5), 0.5);
  assert.equal(applySoftLimiter(-0.5), -0.5);

  // Severe hot signal (e.g. +6dB or +12dB overshoot)
  const overshot1 = applySoftLimiter(1.5);
  assert.ok(overshot1 > 0.92 && overshot1 < 1.0, `Expected compressed value < 1.0, got ${overshot1}`);

  const overshot2 = applySoftLimiter(3.0);
  assert.ok(overshot2 < 1.0, `Extreme overshoot must be <= 1.0, got ${overshot2}`);

  const negativeOvershot = applySoftLimiter(-2.0);
  assert.ok(negativeOvershot > -1.0 && negativeOvershot < -0.92);
});

test('applyVolumeNormalization scales audio buffers and respects limiter', () => {
  const inputChannel = new Float32Array([0.1, 0.4, 0.5, -0.4]);
  // Multiply by 2.5 (hot boost)
  const normalized = applyVolumeNormalization([inputChannel], 2.5, true);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].length, 4);

  // 0.5 * 2.5 = 1.25 -> with limiter must be bounded < 1.0
  const peakOutput = calculatePeakLevel(normalized[0]);
  assert.ok(peakOutput < 1.0, `Normalized peak must stay below 1.0, got ${peakOutput}`);
});

test('NORMALIZATION_PRESETS contains standard industry audio targets', () => {
  assert.ok(NORMALIZATION_PRESETS.length >= 4);
  const truePeak = NORMALIZATION_PRESETS.find((p) => p.id === 'ebu_true_peak');
  assert.ok(truePeak);
  assert.equal(truePeak.targetDb, -1.0);
  assert.ok(truePeak.nameKm.length > 0);
});

test('sliceAudioBufferData slices single and stereo channels accurately with sample-precision', () => {
  const sampleRate = 1000; // 1000 samples/sec for easy arithmetic
  const channelLeft = new Float32Array(3000); // 3.0 seconds
  const channelRight = new Float32Array(3000);
  for (let i = 0; i < 3000; i++) {
    channelLeft[i] = i;
    channelRight[i] = -i;
  }

  // Slice from 1.0s to 2.5s (should yield 1500 samples: indices 1000 to 2500)
  const result = sliceAudioBufferData([channelLeft, channelRight], sampleRate, 1.0, 2.5);
  assert.equal(result.channels.length, 2);
  assert.equal(result.sampleCount, 1500);
  assert.equal(result.duration, 1.5);
  assert.equal(result.startSample, 1000);
  assert.equal(result.endSample, 2500);
  assert.equal(result.channels[0][0], 1000);
  assert.equal(result.channels[0][1499], 2499);
  assert.equal(result.channels[1][0], -1000);
});

test('sliceAudioBufferData handles boundary edge cases and clamps gracefully', () => {
  const sampleRate = 44100;
  const channel = new Float32Array(44100 * 2); // 2.0s
  channel.fill(0.5);

  // Negative start or reversed start/end
  const clamped = sliceAudioBufferData([channel], sampleRate, -1.0, 5.0);
  assert.equal(clamped.startSample, 0);
  assert.equal(clamped.endSample, 44100 * 2);
  assert.equal(clamped.duration, 2.0);

  // Inverted range (start >= end)
  const inverted = sliceAudioBufferData([channel], sampleRate, 1.5, 1.0);
  assert.ok(inverted.sampleCount > 0);
  assert.ok(inverted.startTime < inverted.endTime);
});

test('detectSilenceBoundaries detects speech onset and offset accurately', () => {
  const sampleRate = 1000;
  const channel = new Float32Array(3000); // 3 seconds of audio
  // 0s - 0.5s: silence
  // 0.5s - 2.2s: audio signal (amplitude 0.6)
  // 2.2s - 3.0s: silence
  for (let i = 500; i < 2200; i++) {
    channel[i] = 0.6 * Math.sin(i * 0.1);
  }

  const detected = detectSilenceBoundaries(channel, sampleRate, -30, 0.05);
  assert.equal(detected.detectedSilence, true);
  // Expected start around ~0.45s (0.50s - 0.05s padding)
  assert.ok(detected.start >= 0.40 && detected.start <= 0.50, `Start should be ~0.45, got ${detected.start}`);
  // Expected end around ~2.25s (2.20s + 0.05s padding)
  assert.ok(detected.end >= 2.15 && detected.end <= 2.30, `End should be ~2.25, got ${detected.end}`);
});

test('formatAudioSeconds formats durations properly', () => {
  assert.equal(formatAudioSeconds(4.2), '4.20s');
  assert.equal(formatAudioSeconds(65.5), '1:05.50');
  assert.equal(formatAudioSeconds(0), '0.00s');
});

