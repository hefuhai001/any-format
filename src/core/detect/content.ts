import { normalizeFormat } from '../format.js';
import type { DetectResult, FormatDetector } from '../types.js';

const detectors: FormatDetector[] = [
  {
    format: 'html',
    score(sample) {
      const trimmed = sample.trimStart().slice(0, 200).toLowerCase();
      if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return 1;
      const tags = sample.match(/<\/?(div|p|span|a|ul|table|h[1-6])\b/gi)?.length ?? 0;
      return tags >= 2 ? 0.7 : tags === 1 ? 0.3 : 0;
    },
  },
  {
    format: 'markdown',
    score(sample) {
      const nonEmpty = sample.split(/\r?\n/).slice(0, 200).length > 0;
      let hits = 0;
      if (/^#{1,6}\s+\S/m.test(sample)) hits += 1;
      if (/^```/m.test(sample)) hits += 1;
      if (/^\s*[-*+]\s+\S/m.test(sample)) hits += 1;
      if (/^\s*\d+\.\s+\S/m.test(sample)) hits += 1;
      if (/\[[^\]]+\]\([^)]+\)/.test(sample)) hits += 1;
      if (/^>\s+\S/m.test(sample)) hits += 1;
      if (/\*\*[^*]+\*\*/.test(sample)) hits += 1;
      return Math.min(1, hits / 3) * 0.9 + (nonEmpty ? 0.05 : 0);
    },
  },
  {
    format: 'json',
    score(sample) {
      const trimmed = sample.trim();
      const looksLikeJson =
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));
      if (!looksLikeJson) return 0;
      try {
        JSON.parse(trimmed);
        return 1;
      } catch {
        return 0.2;
      }
    },
  },
  {
    format: 'csv',
    score(sample) {
      const lines = sample.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 10);
      if (lines.length < 2) return 0;
      const counts = lines.map((line) => line.split(',').length);
      return counts.every((count) => count > 1 && count === counts[0]) ? 0.6 : 0;
    },
  },
  {
    format: 'xml',
    score(sample) {
      return /^<\?xml/i.test(sample.trimStart()) ? 1 : 0;
    },
  },
  {
    format: 'text',
    score(sample) {
      return /<[^>]+>/.test(sample) ? 0.1 : 0.2;
    },
  },
];

/**
 * Guess the format of a text sample. Returns the highest scoring detector,
 * defaulting to `text` when nothing scores above `minConfidence`.
 */
export function detectFormat(sample: string, options: { minConfidence?: number } = {}): DetectResult {
  if (typeof sample !== 'string') {
    throw new TypeError('detectFormat() expects a string sample');
  }
  const minConfidence = options.minConfidence ?? 0;

  let best: DetectResult = { format: 'text', confidence: 0 };
  for (const detector of detectors) {
    const confidence = Math.max(0, Math.min(1, detector.score(sample)));
    if (confidence > best.confidence) best = { format: normalizeFormat(detector.format), confidence };
  }

  return best.confidence < minConfidence ? { format: 'text', confidence: 0 } : best;
}

/** Register a custom detector; it participates in `detectFormat()`. Returns a disposer. */
export function registerDetector(detector: FormatDetector): () => void {
  detectors.push(detector);
  return () => {
    const index = detectors.indexOf(detector);
    if (index !== -1) detectors.splice(index, 1);
  };
}

export function listDetectors(): readonly FormatDetector[] {
  return [...detectors];
}
