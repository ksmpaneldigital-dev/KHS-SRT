/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mp3Encoder } from '@breezystack/lamejs';
import { encodeWAV } from './audioMath';

/**
 * Converts Float32Array channel samples (-1.0 to 1.0) into 16-bit signed PCM Int16Array (-32768 to 32767).
 */
export function float32ToInt16(channel: Float32Array): Int16Array {
  const len = channel.length;
  const int16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]));
    int16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return int16;
}

/**
 * Encodes multi-channel Float32 audio data into an authentic MPEG-1 Layer 3 (MP3)
 * binary stream using the LAMEjs encoder.
 *
 * @param channels Array of Float32Array buffers, 1 for mono, 2 for stereo.
 * @param sampleRate Sampling frequency in Hz (e.g. 44100, 48000, 24000).
 * @param bitrate Encoding bitrate in kbps (e.g. 128, 192, 320).
 * @returns Uint8Array containing complete MP3 file bytes with standard frame sync headers.
 */
export function encodeMP3(
  channels: Float32Array[],
  sampleRate: number = 44100,
  bitrate: number = 192
): Uint8Array {
  if (!channels || channels.length === 0 || channels[0].length === 0) {
    return new Uint8Array(0);
  }

  const numChannels = Math.min(2, Math.max(1, channels.length));
  // Valid standard LAME bitrates
  const validBitrates = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const safeBitrate = validBitrates.includes(bitrate) ? bitrate : 192;

  // Initialize LAME MP3 Encoder instance
  const encoder = new Mp3Encoder(numChannels, sampleRate, safeBitrate);

  const leftInt16 = float32ToInt16(channels[0]);
  const rightInt16 = numChannels === 2 && channels[1] ? float32ToInt16(channels[1]) : null;

  // Standard MPEG-1 Layer 3 frame chunk size
  const sampleBlockSize = 1152;
  const mp3DataChunks: Uint8Array[] = [];
  const numSamples = leftInt16.length;

  for (let i = 0; i < numSamples; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let chunk: Uint8Array;
    if (rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      chunk = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      chunk = encoder.encodeBuffer(leftChunk);
    }
    if (chunk && chunk.length > 0) {
      mp3DataChunks.push(chunk);
    }
  }

  // Flush internal buffer to capture trailing audio samples
  const flushChunk = encoder.flush();
  if (flushChunk && flushChunk.length > 0) {
    mp3DataChunks.push(flushChunk);
  }

  // Concatenate all MP3 frame chunks into a single contiguous Uint8Array
  const totalLength = mp3DataChunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3DataChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

/**
 * Encodes audio channel data and returns an MP3 Blob with 'audio/mp3' mime-type.
 */
export function encodeMP3Blob(
  channels: Float32Array[],
  sampleRate: number = 44100,
  bitrate: number = 192
): Blob {
  const bytes = encodeMP3(channels, sampleRate, bitrate);
  return new Blob([bytes as unknown as BlobPart], { type: 'audio/mp3' });
}

/**
 * Universal audio exporter helper: returns Blob and Object URL for either MP3 (via LAMEjs)
 * or WAV (via RIFF PCM 16-bit encoder).
 */
export function exportAudioBuffer(
  channels: Float32Array[],
  format: 'wav' | 'mp3',
  sampleRate: number = 44100,
  bitrate: number = 192
): { blob: Blob; url: string; sizeFormatted: string } {
  if (format === 'mp3') {
    const mp3Bytes = encodeMP3(channels, sampleRate, bitrate);
    const blob = new Blob([mp3Bytes as unknown as BlobPart], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const kb = Math.round(mp3Bytes.length / 1024);
    return { blob, url, sizeFormatted: `${kb} KB` };
  } else {
    const wavBytes = encodeWAV(channels, sampleRate);
    const blob = new Blob([wavBytes as unknown as BlobPart], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const kb = Math.round(wavBytes.length / 1024);
    return { blob, url, sizeFormatted: `${kb} KB` };
  }
}

/**
 * Decodes an arbitrary audio Blob using the browser's Web Audio API and re-encodes
 * to authentic MP3 (via LAMEjs) or WAV with requested parameters.
 */
export async function convertBlobFormat(
  sourceBlob: Blob,
  targetFormat: 'wav' | 'mp3',
  sampleRate: number = 44100,
  bitrate: number = 192,
  channelsPreference: 'mono' | 'stereo' = 'mono'
): Promise<{ blob: Blob; url: string }> {
  if (typeof window === 'undefined') {
    throw new Error('convertBlobFormat requires browser Web Audio context');
  }

  const arrayBuffer = await sourceBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channels: Float32Array[] = [];

    if (channelsPreference === 'stereo' && audioBuffer.numberOfChannels >= 2) {
      channels.push(audioBuffer.getChannelData(0));
      channels.push(audioBuffer.getChannelData(1));
    } else {
      channels.push(audioBuffer.getChannelData(0));
    }

    if (targetFormat === 'mp3') {
      const mp3Bytes = encodeMP3(channels, sampleRate, bitrate);
      const blob = new Blob([mp3Bytes as unknown as BlobPart], { type: 'audio/mp3' });
      return { blob, url: URL.createObjectURL(blob) };
    } else {
      const wavBytes = encodeWAV(channels, sampleRate);
      const blob = new Blob([wavBytes as unknown as BlobPart], { type: 'audio/wav' });
      return { blob, url: URL.createObjectURL(blob) };
    }
  } finally {
    audioCtx.close().catch(() => {});
  }
}
