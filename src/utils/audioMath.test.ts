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
