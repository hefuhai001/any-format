import { asBuffer, optionalImport } from '../loader.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface DocxReadOptions {
  /** Mammoth style map entries, e.g. `['p[style-name="Code"] => pre:separator("\n")']`. */
  styleMap?: string[];
}

interface MammothImage {
  contentType: string;
  readAsBase64String: () => Promise<string>;
}

export async function readDocxHtml(input: ConvertInput, options: DocxReadOptions = {}): Promise<string> {
  const mod = await optionalImport('mammoth', 'mammoth converts .docx to HTML');
  const mammoth = mod.default ?? mod;
  const buffer = asBuffer(input, 'docx');

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      ...(options.styleMap ? { styleMap: options.styleMap } : {}),
      convertImage: mammoth.images.imgElement(async (image: MammothImage) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    },
  );

  return String(result.value ?? '');
}

export function makeReadConverters(): Converter<any>[] {
  return [
    {
      from: 'docx',
      to: 'html',
      name: 'adapter:docx->html',
      convert: (input: ConvertInput, options: DocxReadOptions = {}) => readDocxHtml(input, options),
    },
    {
      from: 'docx',
      to: 'markdown',
      name: 'adapter:docx->markdown',
      async convert(input: ConvertInput, options: DocxReadOptions = {}) {
        const { htmlToMarkdown } = await import('../../converters/html-to-markdown/index.js');
        return htmlToMarkdown.convert(await readDocxHtml(input, options), {}, {} as never) as string;
      },
    },
    {
      from: 'docx',
      to: 'text',
      name: 'adapter:docx->text',
      async convert(input: ConvertInput, options: DocxReadOptions = {}) {
        const { htmlToText } = await import('../../converters/html-to-text.js');
        return htmlToText.convert(await readDocxHtml(input, options), {}, {} as never) as string;
      },
    },
  ];
}
