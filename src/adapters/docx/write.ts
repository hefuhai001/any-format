import { optionalImport } from '../loader.js';
import { parseInlineRuns, parseMarkdownBlocks, textToBlocks, type Block } from '../blocks/index.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface DocxWriteOptions {
  /** Document title metadata. */
  title?: string;
  /** Base font size in half-points. Default `22` (11pt). */
  fontSize?: number;
}

export async function writeDocx(blocks: Block[], options: DocxWriteOptions = {}): Promise<Uint8Array> {
  const mod = await optionalImport('docx', 'the docx package generates .docx files');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = mod;

  const fontSize = options.fontSize ?? 22;
  const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  const runs = (text: string) =>
    parseInlineRuns(text).map(
      (run) =>
        new TextRun({
          text: run.text,
          bold: run.bold,
          italics: run.italic,
          ...(run.code ? { font: 'Consolas' } : {}),
          size: fontSize,
        }),
    );

  const children = blocks.flatMap((block) => {
    switch (block.type) {
      case 'heading':
        return [
          new Paragraph({
            children: runs(block.text),
            heading: headingLevels[Math.min(block.level, 6) - 1] ?? HeadingLevel.HEADING_6,
          }),
        ];
      case 'paragraph':
        return [new Paragraph({ children: runs(block.text), spacing: { after: 160 } })];
      case 'list':
        return block.items.map(
          (item) =>
            new Paragraph({
              children: runs(item),
              bullet: block.ordered ? undefined : { level: 0 },
              numbering: block.ordered ? { reference: 'ordered-list', level: 0 } : undefined,
              spacing: { after: 60 },
            }),
        );
      case 'code':
        return block.text.split('\n').map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Consolas', size: Math.max(fontSize - 2, 16) })],
              shading: { type: 'clear', fill: 'F2F2F2' },
            }),
        );
      case 'quote':
        return [
          new Paragraph({
            children: runs(block.text),
            indent: { left: 480 },
            italics: true,
            alignment: AlignmentType.LEFT,
          }),
        ];
      case 'hr':
        return [new Paragraph({ text: '—'.repeat(20), alignment: AlignmentType.CENTER })];
      default:
        return [];
    }
  });

  const document = new Document({
    title: options.title ?? 'Document',
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });

  return new Uint8Array(await Packer.toBuffer(document));
}

export function makeWriteConverters(): Converter<any>[] {
  return [
    {
      from: 'markdown',
      to: 'docx',
      name: 'adapter:markdown->docx',
      convert: (input: ConvertInput, options: DocxWriteOptions = {}) =>
        writeDocx(parseMarkdownBlocks(String(input)), options),
    },
    {
      from: 'text',
      to: 'docx',
      name: 'adapter:text->docx',
      convert: (input: ConvertInput, options: DocxWriteOptions = {}) => writeDocx(textToBlocks(String(input)), options),
    },
    {
      from: 'html',
      to: 'docx',
      name: 'adapter:html->docx',
      async convert(input: ConvertInput, options: DocxWriteOptions = {}) {
        const { htmlToMarkdown } = await import('../../converters/html-to-markdown/index.js');
        const markdown = htmlToMarkdown.convert(String(input), {}, {} as never) as string;
        return writeDocx(parseMarkdownBlocks(markdown), options);
      },
    },
  ];
}
