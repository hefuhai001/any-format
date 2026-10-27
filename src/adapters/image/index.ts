import type { ConvertInput, Converter } from '../../core/types.js';
import { convertImage, type ImageConvertOptions, type ImageFormat } from './convert.js';

export type { ImageConvertOptions, ImageFormat } from './convert.js';
export type { ImageInfo } from './read.js';
export { convertImage } from './convert.js';
export { readImageInfo } from './read.js';

/** Raster formats the `sharp` adapter reads and writes. */
export const IMAGE_FORMATS: readonly ImageFormat[] = ['png', 'jpeg', 'webp', 'avif', 'tiff', 'gif'];

/** Every read/write pair between {@link IMAGE_FORMATS}. Requires the optional `sharp` peer. */
export const imageConverters: Converter<ImageConvertOptions>[] = IMAGE_FORMATS.flatMap((from) =>
  IMAGE_FORMATS.filter((to) => to !== from).map((to) => ({
    from,
    to,
    name: `adapter:${from}->${to}`,
    convert: (input: ConvertInput, options: ImageConvertOptions = {}) => convertImage(input, to, options),
  })),
);
