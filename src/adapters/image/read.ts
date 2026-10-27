import { asBuffer, optionalImport } from '../loader.js';
import type { ConvertInput } from '../../core/types.js';

/** Metadata reported by {@link readImageInfo}. */
export interface ImageInfo {
  /** Container/codec name as detected by sharp, e.g. `png`, `jpeg`, `gif`. */
  format?: string;
  width: number;
  height: number;
  /** Number of colour channels per pixel (3 = RGB, 4 = RGBA). */
  channels: number;
  hasAlpha: boolean;
  /** Pixel colour space, e.g. `srgb`, `b-w`. */
  space?: string;
  /** Pixels per inch, when the file declares it. */
  density?: number;
  /** Frame count for animated gif/webp/tiff. */
  pages?: number;
}

interface RawMetadata {
  format?: string;
  width?: number;
  height?: number;
  channels?: number;
  hasAlpha?: boolean;
  space?: string;
  density?: number;
  pages?: number;
}

/** Read image metadata without decoding pixels. Requires the optional `sharp` peer. */
export async function readImageInfo(input: ConvertInput): Promise<ImageInfo> {
  const mod = await optionalImport('sharp', 'sharp reads image metadata');
  const sharp = (mod.default ?? mod) as (input: Buffer) => { metadata(): Promise<RawMetadata> };
  const meta = await sharp(asBuffer(input, 'image')).metadata();

  return {
    format: meta.format,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    channels: meta.channels ?? 0,
    hasAlpha: Boolean(meta.hasAlpha),
    space: meta.space,
    density: meta.density,
    pages: meta.pages,
  };
}
