import { optionalImport } from '../loader.js';
import { cleanInline, parseMarkdownBlocks, textToBlocks, type Block } from '../blocks/index.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface PdfWriteOptions {
  /** Path to a TTF/OTF font; required for CJK text (built-in fonts are Latin-only). */
  fontPath?: string;
  /** Page size. Default `A4`. */
  size?: 'A4' | 'A3' | 'LETTER' | 'LEGAL';
  /** Page margin in points. Default `56`. */
  margin?: number;
  /** Default font size. Default `11`. */
  fontSize?: number;
  title?: string;
  author?: string;
}

export async function writePdf(blocks: Block[], options: PdfWriteOptions = {}): Promise<Uint8Array> {
  const mod = await optionalImport('pdfkit', 'pdfkit generates PDF files');
  const PDFDocument = mod.default ?? mod;

  const doc = new PDFDocument({
    size: options.size ?? 'A4',
    margin: options.margin ?? 56,
    info: { Title: options.title ?? 'Document', Author: options.author ?? 'any-format' },
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });

  const base = options.fontSize ?? 11;
  if (options.fontPath) doc.registerFont('custom', options.fontPath).font('custom');
  const font = (name: string) => (options.fontPath ? 'custom' : name);

  for (const block of blocks) {
    switch (block.type) {
      case 'heading': {
        const size = [24, 20, 17, 15, 13, 12][Math.min(block.level, 6) - 1] ?? 12;
        doc.font(font('Helvetica-Bold')).fontSize(size).text(cleanInline(block.text), { paragraphGap: 8 });
        break;
      }
      case 'paragraph':
        doc.font(font('Helvetica')).fontSize(base).text(cleanInline(block.text), { paragraphGap: 6, align: 'left' });
        break;
      case 'list':
        block.items.forEach((item, index) => {
          const marker = block.ordered ? `${index + 1}.` : '•';
          doc.font(font('Helvetica')).fontSize(base).text(`${marker} ${cleanInline(item)}`, { indent: 12, paragraphGap: 3 });
        });
        break;
      case 'code':
        doc.font(options.fontPath ? 'custom' : 'Courier')
          .fontSize(Math.max(base - 1, 7))
          .text(block.text, { paragraphGap: 8, fillColor: '#333333' });
        doc.fillColor('#000000');
        break;
      case 'quote':
        doc.font(font('Helvetica-Oblique')).fontSize(base).text(cleanInline(block.text), { indent: 18, paragraphGap: 8 });
        break;
      case 'hr':
        doc.moveDown(0.5).fontSize(base);
        break;
      default:
        break;
    }
  }

  doc.end();
  await finished;

  return new Uint8Array(Buffer.concat(chunks));
}

export function makeWriteConverters(): Converter<any>[] {
  return [
    {
      from: 'markdown',
      to: 'pdf',
      name: 'adapter:markdown->pdf',
      convert: (input: ConvertInput, options: PdfWriteOptions = {}) => writePdf(parseMarkdownBlocks(String(input)), options),
    },
    {
      from: 'text',
      to: 'pdf',
      name: 'adapter:text->pdf',
      convert: (input: ConvertInput, options: PdfWriteOptions = {}) => writePdf(textToBlocks(String(input)), options),
    },
    {
      from: 'html',
      to: 'pdf',
      name: 'adapter:html->pdf',
      async convert(input: ConvertInput, options: PdfWriteOptions = {}) {
        const { htmlToMarkdown } = await import('../../converters/html-to-markdown/index.js');
        const markdown = htmlToMarkdown.convert(String(input), {}, {} as never) as string;
        return writePdf(parseMarkdownBlocks(markdown), options);
      },
    },
  ];
}
