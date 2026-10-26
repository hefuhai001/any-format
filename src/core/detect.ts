import { normalizeFormat } from './registry.js';
import type { DetectResult, FormatDetector } from './types.js';

const EXTENSION_MAP: Record<string, string> = {
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  txt: 'text',
  text: 'text',
  json: 'json',
  csv: 'csv',
  tsv: 'tsv',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  docx: 'docx',
  doc: 'doc',
  pdf: 'pdf',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xls',
  pptx: 'pptx',
  ppt: 'ppt',
  epub: 'epub',
};

const MIME_MAP: Record<string, string> = {
  'text/markdown': 'markdown',
  'text/html': 'html',
  'text/plain': 'text',
  'application/json': 'json',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/epub+zip': 'epub',
};

/** Resolve a format from a file extension or MIME type. */
export function detectFromFileName(filePath: string): string | undefined {
  const clean = filePath.split(/[?#]/)[0] ?? filePath;
  const dot = clean.lastIndexOf('.');
  if (dot === -1 || dot === clean.length - 1) return undefined;
  return EXTENSION_MAP[clean.slice(dot + 1).toLowerCase()];
}

export function detectFromMimeType(mimeType: string): string | undefined {
  const clean = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return MIME_MAP[clean];
}

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
      const lines = sample.split(/\r?\n/).slice(0, 200);
      let hits = 0;
      if (/^#{1,6}\s+\S/m.test(sample)) hits += 1;
      if (/^```/m.test(sample)) hits += 1;
      if (/^\s*[-*+]\s+\S/m.test(sample)) hits += 1;
      if (/^\s*\d+\.\s+\S/m.test(sample)) hits += 1;
      if (/\[[^\]]+\]\([^)]+\)/.test(sample)) hits += 1;
      if (/^>\s+\S/m.test(sample)) hits += 1;
      if (/\*\*[^*]+\*\*/.test(sample)) hits += 1;
      return Math.min(1, hits / 3) * 0.9 + (lines.length > 0 ? 0.05 : 0);
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
      const trimmed = sample.trimStart();
      return /^<\?xml/i.test(trimmed) ? 1 : 0;
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
 * defaulting to `text` when nothing scores above zero.
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
