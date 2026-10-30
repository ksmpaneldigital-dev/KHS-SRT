/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { float32ToInt16, encodeMP3, exportAudioBuffer } from './mp3Encoder';
import { encodeWAV } from './audioMath';

describe('LAMEjs MP3 Encoder Integration', () => {
  it('float32ToInt16 accurately converts -1.0 to 1.0 into 16-bit signed integers', () => {
    const input = new Float32Array([0, 1.0, -1.0, 0.5, -0.5, 2.0, -2.0]);
    const output = float32ToInt16(input);

    assert.strictEqual(output.length, input.length);
    assert.strictEqual(output[0], 0);
    assert.strictEqual(output[1], 32767); // Clamped max
    assert.strictEqual(output[2], -32768); // Clamped min
    assert.ok(Math.abs(output[3] - 16384) <= 1);
    assert.ok(Math.abs(output[4] - -16384) <= 1);
    assert.strictEqual(output[5], 32767); // Out of bounds clamped to 1.0
    assert.strictEqual(output[6], -32768); // Out of bounds clamped to -1.0
  });

  it('encodeMP3 produces valid MPEG Audio frame sync header (0xFFFB / 0xFFF3)', () => {
    const sampleRate = 44100;
    const durationSec = 1.0;
    const numSamples = Math.floor(sampleRate * durationSec);
    const channel = new Float32Array(numSamples);

    // 440 Hz sine wave
    for (let i = 0; i < numSamples; i++) {
      channel[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.75;
    }

    const mp3Bytes = encodeMP3([channel], sampleRate, 192);

    assert.ok(mp3Bytes.length > 0, 'MP3 bytes must not be empty');
    // First two bytes must be MPEG audio frame sync (11 bits of 1s: 0xFF followed by 0xE0-0xFF)
    assert.strictEqual(mp3Bytes[0], 0xff, 'First byte must be 0xFF');
    assert.ok((mp3Bytes[1] & 0xe0) === 0xe0, 'Second byte high 3 bits must be 111 (frame sync)');

    // Compare with uncompressed WAV size: 44100 samples * 2 bytes = 88,244 bytes.
    // 192kbps MP3 should be ~24KB (192,000 / 8 = 24,000 bytes)
    const wavBytes = encodeWAV([channel], sampleRate);
    assert.ok(
      mp3Bytes.length < wavBytes.length * 0.4,
      `MP3 size (${mp3Bytes.length}) should be much smaller than WAV (${wavBytes.length})`
    );
  });

  it('encodeMP3 encodes stereo audio at 48kHz with 320kbps master quality', () => {
    const sampleRate = 48000;
    const numSamples = 48000;
    const left = new Float32Array(numSamples);
    const right = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      left[i] = Math.sin((2 * Math.PI * 523.25 * i) / sampleRate) * 0.6; // C5
      right[i] = Math.sin((2 * Math.PI * 659.25 * i) / sampleRate) * 0.6; // E5
    }

    const mp3Stereo = encodeMP3([left, right], sampleRate, 320);

    assert.ok(mp3Stereo.length > 0);
    assert.strictEqual(mp3Stereo[0], 0xff);
    assert.ok((mp3Stereo[1] & 0xe0) === 0xe0);
  });

  it('encodeMP3 handles multiple bitrate presets (128kbps, 192kbps, 320kbps)', () => {
    const sampleRate = 44100;
    const numSamples = 44100; // 1 second
    const channel = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      channel[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.5;
    }

    const mp3_128 = encodeMP3([channel], sampleRate, 128);
    const mp3_192 = encodeMP3([channel], sampleRate, 192);
    const mp3_320 = encodeMP3([channel], sampleRate, 320);

    assert.ok(mp3_128.length > 0);
    assert.ok(mp3_192.length > 0);
    assert.ok(mp3_320.length > 0);

    // Higher bitrates yield larger encoded sizes for the same input audio
    assert.ok(
      mp3_128.length <= mp3_192.length,
      `128kbps (${mp3_128.length}) should be <= 192kbps (${mp3_192.length})`
    );
    assert.ok(
      mp3_192.length <= mp3_320.length,
      `192kbps (${mp3_192.length}) should be <= 320kbps (${mp3_320.length})`
    );
  });

  it('exportAudioBuffer dispatches to MP3 or WAV properly', () => {
    const channel = new Float32Array(22050); // 0.5s at 44.1kHz
    for (let i = 0; i < channel.length; i++) {
      channel[i] = 0.2;
    }

    // Mock URL.createObjectURL for node test
    const originalCreateObjectURL = (globalThis as any).URL.createObjectURL;
    (globalThis as any).URL.createObjectURL = () => 'blob:mock-url';

    try {
      const wavExport = exportAudioBuffer([channel], 'wav', 44100, 192);
      assert.strictEqual(wavExport.blob.type, 'audio/wav');
      assert.ok(wavExport.sizeFormatted.includes('KB'));

      const mp3Export = exportAudioBuffer([channel], 'mp3', 44100, 192);
      assert.strictEqual(mp3Export.blob.type, 'audio/mp3');
      assert.ok(mp3Export.sizeFormatted.includes('KB'));
    } finally {
      (globalThis as any).URL.createObjectURL = originalCreateObjectURL;
    }
  });

  it('encodeMP3 handles empty or invalid channels gracefully', () => {
    const emptyResult = encodeMP3([], 44100, 192);
    assert.strictEqual(emptyResult.length, 0);

    const emptyChannel = encodeMP3([new Float32Array(0)], 44100, 192);
    assert.strictEqual(emptyChannel.length, 0);
  });
});
