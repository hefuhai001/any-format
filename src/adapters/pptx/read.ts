import { asBuffer, optionalImport } from '../loader.js';
import type { ConvertInput } from '../../core/types.js';

export interface PptxReadOptions {
  /** Include slide numbers when emitting text/markdown. Default `true`. */
  slideNumbers?: boolean;
  /** Also extract speaker notes (`ppt/notesSlides`). Default `false`. */
  notes?: boolean;
}

export interface SlideContent {
  index: number;
  lines: string[];
}

function slideOrder(a: string, b: string): number {
  const num = (value: string) => Number(/slide(\d+)\.xml/.exec(value)?.[1] ?? 0);
  return num(a) - num(b);
}

export function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Collect one string per `<a:p>` paragraph, joining its `<a:t>` runs. */
export function extractParagraphs(xml: string): string[] {
  const paragraphs: string[] = [];
  const paragraphRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphRe.exec(xml))) {
    const runs = [...match[1]!.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)].map((run) => decodeXml(run[1]!));
    const text = runs.join('').trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

export async function readSlides(input: ConvertInput, options: PptxReadOptions = {}): Promise<SlideContent[]> {
  const mod = await optionalImport('fflate', 'fflate unzips the .pptx OOXML container');
  const { unzipSync, strFromU8 } = mod.default ?? mod;
  const files = unzipSync(new Uint8Array(asBuffer(input, 'pptx'))) as Record<string, Uint8Array>;

  const pattern = options.notes ? /^ppt\/(slides|notesSlides)\/.*\.xml$/ : /^ppt\/slides\/.*\.xml$/;
  const keys = Object.keys(files).filter((key) => pattern.test(key)).sort(slideOrder);

  if (keys.length === 0) {
    throw new Error('No slides found — the input does not look like a valid .pptx file');
  }

  return keys.map((key, index) => ({
    index: index + 1,
    lines: extractParagraphs(strFromU8(files[key]!)),
  }));
}
