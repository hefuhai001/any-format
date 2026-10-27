import type { Format } from './types.js';

/** Well-known spellings that share one canonical format identifier. */
const ALIASES: Record<string, Format> = {
  jpg: 'jpeg',
  jpe: 'jpeg',
  tif: 'tiff',
};

/** Canonical form of a format identifier: trimmed, lower-case, aliases folded. */
export function normalizeFormat(format: Format): Format {
  const normalized = String(format).trim().toLowerCase();
  return ALIASES[normalized] ?? normalized;
}
