import { optionalImport } from '../loader.js';
import { cleanInline, parseMarkdownBlocks, textToBlocks, type Block } from '../blocks/index.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface PptxWriteOptions {
  /** Layout preset. Default `LAYOUT_16x9`. */
  layout?: 'LAYOUT_16x9' | 'LAYOUT_4x3' | 'LAYOUT_WIDE';
  /** Title font size in points. Default `28`. */
  titleSize?: number;
  /** Body font size in points. Default `16`. */
  bodySize?: number;
  /** Font face used for every run. Default `Arial`. */
  fontFace?: string;
  /** Presentation title metadata. */
  title?: string;
}

interface SlidePlan {
  title: string;
  body: string[];
}

/** Group blocks into slides: H1 and horizontal rules start a new slide. */
export function blocksToSlides(blocks: Block[]): SlidePlan[] {
  const slides: SlidePlan[] = [];
  let current: SlidePlan | undefined;

  const ensure = (): SlidePlan => {
    if (!current) {
      current = { title: 'Untitled', body: [] };
      slides.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    if (block.type === 'hr' || (block.type === 'heading' && block.level <= 1)) {
      current = { title: block.type === 'hr' ? '' : cleanInline(block.text), body: [] };
      slides.push(current);
      continue;
    }

    const slide = ensure();

    if (block.type === 'heading') {
      if (slide.body.length === 0 && slide.title === 'Untitled') slide.title = cleanInline(block.text);
      else slide.body.push(cleanInline(block.text));
      continue;
    }

    // The first paragraph of an untitled slide becomes its title.
    if (slide.title === 'Untitled' && slide.body.length === 0 && block.type === 'paragraph') {
      slide.title = cleanInline(block.text).slice(0, 120);
      continue;
    }

    switch (block.type) {
      case 'paragraph':
        slide.body.push(cleanInline(block.text));
        break;
      case 'list':
        slide.body.push(
          ...block.items.map((item, i) => (block.ordered ? `${i + 1}. ${cleanInline(item)}` : cleanInline(item))),
        );
        break;
      case 'code':
        slide.body.push(...block.text.split('\n').slice(0, 12));
        break;
      case 'quote':
        slide.body.push(`"${cleanInline(block.text)}"`);
        break;
      default:
        break;
    }
  }

  return slides.filter((slide) => slide.title || slide.body.length > 0);
}

export async function writePptx(blocks: Block[], options: PptxWriteOptions = {}): Promise<Uint8Array> {
  const mod = await optionalImport('pptxgenjs', 'pptxgenjs generates .pptx files');
  const PptxGenJS = mod.default ?? mod;

  const pptx = new PptxGenJS();
  pptx.layout = options.layout ?? 'LAYOUT_16x9';
  if (options.title) pptx.title = options.title;
  pptx.author = 'any-format';

  const fontFace = options.fontFace ?? 'Arial';
  const titleSize = options.titleSize ?? 28;
  const bodySize = options.bodySize ?? 16;

  for (const content of blocksToSlides(blocks)) {
    const slide = pptx.addSlide();
    if (content.title) {
      slide.addText(content.title, { x: 0.5, y: 0.4, w: 9, h: 1, fontSize: titleSize, bold: true, fontFace });
    }
    if (content.body.length > 0) {
      slide.addText(
        content.body.map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
        { x: 0.6, y: 1.5, w: 8.8, h: 4.2, fontSize: bodySize, fontFace, color: '333333' },
      );
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return new Uint8Array(out as Buffer);
}

export function makeWriteConverters(): Converter<any>[] {
  return [
    {
      from: 'markdown',
      to: 'pptx',
      name: 'adapter:markdown->pptx',
      convert: (input: ConvertInput, options: PptxWriteOptions = {}) =>
        writePptx(parseMarkdownBlocks(String(input)), options),
    },
    {
      from: 'text',
      to: 'pptx',
      name: 'adapter:text->pptx',
      convert: (input: ConvertInput, options: PptxWriteOptions = {}) => writePptx(textToBlocks(String(input)), options),
    },
  ];
}
