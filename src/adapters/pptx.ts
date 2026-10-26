import { asBuffer, optionalImport } from './loader.js';
import { cleanInline, parseMarkdownBlocks, type Block } from './markdown-blocks.js';
import type { ConvertInput, Converter } from '../core/types.js';

export interface PptxReadOptions {
  /** Include slide numbers when emitting text/markdown. Default `true`. */
  slideNumbers?: boolean;
  /** Also extract speaker notes (`ppt/notesSlides`). Default `false`. */
  notes?: boolean;
}

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

interface SlideContent {
  index: number;
  lines: string[];
}

function slideOrder(a: string, b: string): number {
  const num = (value: string) => Number(/slide(\d+)\.xml/.exec(value)?.[1] ?? 0);
  return num(a) - num(b);
}

function extractParagraphs(xml: string): string[] {
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

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function readSlides(input: ConvertInput, options: PptxReadOptions): Promise<SlideContent[]> {
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

function slidesToText(slides: SlideContent[], options: PptxReadOptions): string {
  const numbering = options.slideNumbers ?? true;
  return slides
    .map((slide) => {
      const header = numbering ? `[Slide ${slide.index}]` : '';
      return [header, ...slide.lines].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function slidesToMarkdown(slides: SlideContent[], options: PptxReadOptions): string {
  const numbering = options.slideNumbers ?? true;
  return slides
    .map((slide) => {
      const [title, ...rest] = slide.lines;
      const heading = `## ${numbering ? `${slide.index}. ` : ''}${title ?? 'Untitled'}`;
      return [heading, ...rest.map((line) => `- ${line}`)].join('\n');
    })
    .join('\n\n---\n\n');
}

/** Group blocks into slides: H1 and horizontal rules start a new slide. */
function blocksToSlides(blocks: Block[]): Array<{ title: string; body: string[] }> {
  const slides: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } | undefined;

  const ensure = () => {
    if (!current) {
      current = { title: 'Untitled', body: [] };
      slides.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    if (block.type === 'hr' || (block.type === 'heading' && block.level <= 1)) {
      current = { title: block.type === 'hr' ? '' : block.text, body: [] };
      slides.push(current);
      continue;
    }
    const slide = ensure();
    if (block.type === 'heading') {
      if (slide.body.length === 0 && slide.title === 'Untitled') slide.title = cleanInline(block.text);
      else slide.body.push(cleanInline(block.text));
      continue;
    }
    if (slide.title === 'Untitled' && slide.body.length === 0 && block.type === 'paragraph') {
      slide.title = cleanInline(block.text).slice(0, 120);
      continue;
    }
    switch (block.type) {
      case 'paragraph':
        slide.body.push(cleanInline(block.text));
        break;
      case 'list':
        slide.body.push(...block.items.map((item, i) => (block.ordered ? `${i + 1}. ${cleanInline(item)}` : cleanInline(item))));
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

async function writePptx(blocks: Block[], options: PptxWriteOptions): Promise<Uint8Array> {
  const mod = await optionalImport('pptxgenjs', 'pptxgenjs generates .pptx files');
  const PptxGenJS = mod.default ?? mod;

  const pptx = new PptxGenJS();
  pptx.layout = options.layout ?? 'LAYOUT_16x9';
  if (options.title) pptx.title = options.title;
  pptx.author = 'format-conversion';

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

export const pptxConverters: Converter<any>[] = [
  {
    from: 'pptx',
    to: 'text',
    name: 'adapter:pptx->text',
    async convert(input: ConvertInput, options: PptxReadOptions = {}) {
      return slidesToText(await readSlides(input, options), options);
    },
  },
  {
    from: 'pptx',
    to: 'markdown',
    name: 'adapter:pptx->markdown',
    async convert(input: ConvertInput, options: PptxReadOptions = {}) {
      return slidesToMarkdown(await readSlides(input, options), options);
    },
  },
  {
    from: 'pptx',
    to: 'html',
    name: 'adapter:pptx->html',
    async convert(input: ConvertInput, options: PptxReadOptions = {}) {
      const slides = await readSlides(input, options);
      return slides
        .map((slide) => {
          const [title, ...rest] = slide.lines;
          const body = rest.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
          return `<section class="slide">\n<h2>${escapeHtml(title ?? '')}</h2>\n${body ? `<ul>${body}</ul>` : ''}\n</section>`;
        })
        .join('\n');
    },
  },
  {
    from: 'markdown',
    to: 'pptx',
    name: 'adapter:markdown->pptx',
    convert: (input: ConvertInput, options: PptxWriteOptions = {}) => writePptx(parseMarkdownBlocks(String(input)), options),
  },
  {
    from: 'text',
    to: 'pptx',
    name: 'adapter:text->pptx',
    convert: (input: ConvertInput, options: PptxWriteOptions = {}) => {
      const blocks: Block[] = String(input)
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => ({ type: 'paragraph', text: chunk.replace(/\n/g, ' ') }) as Block);
      return writePptx(blocks, options);
    },
  },
];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
