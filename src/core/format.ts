import type { Format } from './types.js';

/** Canonical form of a format identifier: trimmed, lower-case. */
export function normalizeFormat(format: Format): Format {
  return String(format).trim().toLowerCase();
}
