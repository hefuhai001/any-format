import type { ConvertInput, Converter } from '../../core/types.js';
import { convertAudio, type AudioConvertOptions, type AudioFormat } from './convert.js';

export type { AudioConvertOptions, AudioFormat } from './convert.js';
export { buildAudioArgs, convertAudio } from './convert.js';
export { resolveFfmpeg } from './run.js';

/** Audio containers the `ffmpeg` adapter reads and writes. */
export const AUDIO_FORMATS: readonly AudioFormat[] = ['wav', 'mp3', 'flac', 'ogg', 'aac', 'm4a'];

/** Every read/write pair between {@link AUDIO_FORMATS}. Requires `ffmpeg` on the machine. */
export const audioConverters: Converter<AudioConvertOptions>[] = AUDIO_FORMATS.flatMap((from) =>
  AUDIO_FORMATS.filter((to) => to !== from).map((to) => ({
    from,
    to,
    name: `adapter:${from}->${to}`,
    convert: (input: ConvertInput, options: AudioConvertOptions = {}) => convertAudio(input, to, options),
  })),
);
