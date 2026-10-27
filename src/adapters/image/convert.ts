import { asBuffer, optionalImport } from '../loader.js';
import type { ConvertInput } from '../../core/types.js';
import type { Sharp } from 'sharp';

/** Raster formats the image adapter can read and write. */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff' | 'gif';

export interface ImageConvertOptions {
  /** Lossy quality, 1–100. Used by jpeg/webp/avif (and tiff unless `lossless`). Default `82`. */
  quality?: number;
  /** Lossless encoding for webp/avif/tiff. Ignored by png (always lossless) and gif. */
  lossless?: boolean;
  /** Colour used to flatten transparency when the target cannot store alpha. Default `#ffffff`. */
  background?: string;
  /** Keep every frame of animated input; only effective for `gif`/`webp` targets. Default `false`. */
  animated?: boolean;
}

/** Targets without an alpha channel: transparency must be flattened first. */
const OPAQUE_TARGETS = new Set<ImageFormat>(['jpeg']);

/** Targets that can store more than one frame. */
const ANIMATED_TARGETS = new Set<ImageFormat>(['gif', 'webp']);

/**
 * Convert a raster image between formats with the optional `sharp` peer.
 * EXIF orientation is applied, so rotated camera images come out upright.
 */
export async function convertImage(
  input: ConvertInput,
  to: ImageFormat,
  options: ImageConvertOptions = {},
): Promise<Uint8Array> {
  const mod = await optionalImport('sharp', 'sharp converts between image formats');
  const sharp = (mod.default ?? mod) as (input: Buffer, options?: Record<string, unknown>) => Sharp;

  const animated = (options.animated ?? false) && ANIMATED_TARGETS.has(to);
  let image = sharp(asBuffer(input, 'image'), { animated, failOn: 'error' }).rotate();

  if (OPAQUE_TARGETS.has(to) && (await image.metadata()).hasAlpha) {
    image = image.flatten({ background: options.background ?? '#ffffff' });
  }

  const buffer = await encode(image, to, options);
  return new Uint8Array(buffer);
}

function encode(image: Sharp, to: ImageFormat, options: ImageConvertOptions): Promise<Buffer> {
  const quality = normalizeQuality(options.quality);
  const lossless = options.lossless ?? false;

  switch (to) {
    case 'jpeg':
      return image.jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'png':
      return image.png({ compressionLevel: 9 }).toBuffer();
    case 'webp':
      return image.webp({ quality, lossless }).toBuffer();
    case 'avif':
      return image.avif({ quality, lossless }).toBuffer();
    case 'tiff':
      return (lossless ? image.tiff({ compression: 'lzw' }) : image.tiff({ quality })).toBuffer();
    case 'gif':
      return image.gif().toBuffer();
    default:
      throw new TypeError(`Unsupported image target format "${to as string}"`);
  }
}

function normalizeQuality(quality: number | undefined): number {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) return 82;
  return Math.max(1, Math.min(100, Math.round(quality)));
}
