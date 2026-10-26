import { asBuffer, optionalImport } from '../loader.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface PdfReadOptions {
  /** Only extract these 1-based page numbers. Default: all pages. */
  pages?: number[];
}

export async function readPdfText(input: ConvertInput, options: PdfReadOptions = {}): Promise<string> {
  const mod = await optionalImport('pdf-parse', 'pdf-parse extracts text from PDF files');
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse ?? mod.default;
  const data = new Uint8Array(asBuffer(input, 'pdf'));

  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText(options.pages ? { partial: options.pages } : {});
    return String(result.text ?? '')
      .replace(/\r\n?/g, '\n')
      // pdf-parse inserts "-- 1 of 3 --" page markers; drop them for clean text.
      .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    await parser.destroy?.();
  }
}

export function makeReadConverters(): Converter<any>[] {
  return [
    {
      from: 'pdf',
      to: 'text',
      name: 'adapter:pdf->text',
      convert: (input: ConvertInput, options: PdfReadOptions = {}) => readPdfText(input, options),
    },
  ];
}
