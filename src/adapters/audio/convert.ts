import { asBuffer } from '../loader.js';
import { resolveFfmpeg, runFfmpeg, runFfmpegToFile } from './run.js';
import type { ConvertInput } from '../../core/types.js';

/** Audio containers the ffmpeg adapter can read and write. */
export type AudioFormat = 'wav' | 'mp3' | 'flac' | 'ogg' | 'aac' | 'm4a';

export interface AudioConvertOptions {
  /**
   * Target bitrate in kbps for lossy targets. Default `192`.
   * `ogg` is Vorbis and only supports VBR, so the value is mapped onto `-q:a`.
   */
  bitrate?: number;
  /** Resample the output, e.g. `44100`. Default keeps the input rate. */
  sampleRate?: number;
  /** Channel count, e.g. `1` for mono. Default keeps the input layout. */
  channels?: number;
  /** FLAC compression level, 0–12. Higher is slower and smaller. Default `5`. */
  compressionLevel?: number;
  /** Path to the ffmpeg executable; overrides `FFMPEG_PATH` and `ffmpeg-static`. */
  ffmpegPath?: string;
}

interface Encoder {
  /** ffmpeg muxer for the container. */
  readonly muxer: string;
  readonly codec: string;
  /** Lossy targets honour `bitrate`. */
  readonly lossy?: boolean;
  /** Vorbis only accepts a VBR quality, so `bitrate` is mapped onto `-q:a`. */
  readonly vbr?: boolean;
}

const ENCODERS: Record<AudioFormat, Encoder> = {
  wav: { muxer: 'wav', codec: 'pcm_s16le' },
  mp3: { muxer: 'mp3', codec: 'libmp3lame', lossy: true },
  ogg: { muxer: 'ogg', codec: 'libvorbis', lossy: true, vbr: true },
  flac: { muxer: 'flac', codec: 'flac' },
  aac: { muxer: 'adts', codec: 'aac', lossy: true },
  m4a: { muxer: 'ipod', codec: 'aac', lossy: true },
};

/** Muxers that need a seekable output; they cannot write to a pipe. */
const NEEDS_SEEKABLE_OUTPUT = new Set<AudioFormat>(['m4a']);

/** Build the ffmpeg argument list for one conversion; exported for tests and debugging. */
export function buildAudioArgs(to: AudioFormat, options: AudioConvertOptions = {}, output = 'pipe:1'): string[] {
  const encoder = ENCODERS[to];
  const args = ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', '-f', encoder.muxer, '-acodec', encoder.codec];

  if (encoder.lossy) {
    const bitrate = clamp(options.bitrate ?? 192, 8, 512);
    if (encoder.vbr) args.push('-q:a', String(vorbisQuality(bitrate)));
    else args.push('-b:a', `${bitrate}k`);
  }
  if (options.sampleRate) args.push('-ar', String(clamp(options.sampleRate, 8000, 192000)));
  if (options.channels) args.push('-ac', String(clamp(options.channels, 1, 8)));
  if (to === 'flac') args.push('-compression_level', String(clamp(options.compressionLevel ?? 5, 0, 12)));

  args.push(output);
  return args;
}

/**
 * Transcode audio with the external `ffmpeg` binary. Input always arrives on
 * stdin; output comes back from stdout, except for muxers that need to seek
 * (m4a), which briefly use a temporary file.
 */
export async function convertAudio(
  input: ConvertInput,
  to: AudioFormat,
  options: AudioConvertOptions = {},
): Promise<Uint8Array> {
  const buffer = asBuffer(input, 'audio');
  const binary = await resolveFfmpeg(options.ffmpegPath);

  if (NEEDS_SEEKABLE_OUTPUT.has(to)) {
    const output = await runFfmpegToFile({
      binary,
      input: buffer,
      extension: to,
      buildArgs: (path) => buildAudioArgs(to, options, path),
    });
    return new Uint8Array(output);
  }

  const output = await runFfmpeg({ binary, args: buildAudioArgs(to, options), input: buffer });
  return new Uint8Array(to === 'wav' ? patchWavSizes(output) : output);
}

/**
 * ffmpeg writes WAV to a pipe in streaming mode, leaving the RIFF and `data`
 * sizes as `0xFFFFFFFF`. Fill them in so the result is a well-formed file.
 */
function patchWavSizes(buffer: Buffer): Buffer {
  if (buffer.byteLength < 44) return buffer;

  const patched = Buffer.from(buffer);
  patched.writeUInt32LE(patched.byteLength - 8, 4);

  let offset = 12;
  while (offset + 8 <= patched.byteLength) {
    const id = patched.toString('latin1', offset, offset + 4);
    const size = patched.readUInt32LE(offset + 4);
    if (id === 'data') {
      patched.writeUInt32LE(patched.byteLength - offset - 8, offset + 4);
      break;
    }
    if (size === 0xffffffff) break;
    offset += 8 + size + (size % 2);
  }

  return patched;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Map a nominal stereo bitrate (kbps) onto the libvorbis quality scale (-1..10). */
function vorbisQuality(bitrate: number): number {
  return clamp(bitrate / 32 - 1, -1, 10);
}
