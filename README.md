**English** | [简体中文](./README.zh-CN.md)

# any-format

A lightweight, plugin-based document conversion library. Text and table conversions have zero runtime dependencies; Office/PDF/image engines are loaded on demand.

> Published as **`@hefuhai001/any-format`** on npm; the GitHub repo is still `any-format`.

## Features

- **Any-to-any**: `markdown` `html` `text` `csv` `tsv` `json` interoperate freely; `docx` `doc` `xlsx` `xls` `pptx` `pdf` are wired in both directions; `png` `jpeg` `webp` `avif` `tiff` `gif` images and `wav` `mp3` `flac` `ogg` `aac` `m4a` audio convert pairwise
- **Automatic chaining**: when no direct converter exists, a BFS over the format graph finds the shortest route, e.g. `docx → html → pdf`
- **Zero runtime dependencies**: core plus text/table converters are hand-written; Office/PDF engines are lazy-loaded
- **Extensible**: any format pair can be added with `registerConverter()`, with priorities and disposal
- **ESM + CJS**: works with both `import` and `require`, ships `.d.ts`

## Install

```bash
# From npm (recommended)
npm i @hefuhai001/any-format

# Or straight from GitHub, pinned to a tag
npm i github:hefuhai001/any-format#v0.0.2

# Or track the main branch
npm i github:hefuhai001/any-format
```

Node.js >= 18 is required. When installing from GitHub a `prepare` script builds the package on install. See **[Distribution](./docs/distribution.md)** for other options (install details are in Chinese).

Office/PDF/image/audio formats need their engine installed on demand — a missing engine only affects that format:

```bash
npm i mammoth docx      # docx read / write
npm i xlsx              # xlsx / xls read / write
npm i fflate pptxgenjs  # pptx read / write
npm i pdf-parse pdfkit  # pdf read / write
npm i word-extractor    # legacy .doc read
npm i sharp             # png / jpeg / webp / avif / tiff / gif
npm i ffmpeg-static     # wav / mp3 / flac / ogg / aac / m4a (or a system ffmpeg)
```

## Quick start

```ts
import { convert } from '@hefuhai001/any-format';

const { data, path } = await convert('# Hello\n\n**world**', 'markdown', 'html');
// data: <h1>Hello</h1>\n\n<p><strong>world</strong></p>
// path: ['markdown', 'html']
```

Chained conversions are resolved automatically:

```ts
const result = await convert(docxBuffer, 'docx', 'pdf');
result.path; // ['docx', 'html', 'pdf']
```

Binary formats take a `Buffer`/`Uint8Array` and return a `Uint8Array`:

```ts
import { readFile, writeFile } from 'node:fs/promises';

const docx = await readFile('report.docx');            // do not pass 'utf8'
const { data } = await convert(docx, 'docx', 'markdown');

const pdf = await convert('# Report', 'markdown', 'pdf');
await writeFile('out.pdf', pdf.data as Uint8Array);
```

## Supported formats

| Format | Read | Write | Dependency |
| --- | --- | --- | --- |
| `markdown` `html` `text` `csv` `tsv` `json` | ✓ | ✓ | none |
| `docx` | ✓ | ✓ | `mammoth` / `docx` |
| `xlsx` / `xls` | ✓ | ✓ | `xlsx` |
| `pptx` | ✓ | ✓ | `fflate` / `pptxgenjs` |
| `pdf` | ✓ (text only) | ✓ | `pdf-parse` / `pdfkit` |
| `doc` | ✓ (text only) | ✗ | `word-extractor` |
| `png` `jpeg` `webp` `avif` `tiff` `gif` | ✓ | ✓ | `sharp` |
| `wav` `mp3` `flac` `ogg` `aac` `m4a` | ✓ | ✓ | `ffmpeg` |

See **[Formats](./docs/formats.md)** for the full matrix, per-format options and limitations (in Chinese).

## Common API

```ts
import { canConvert, convert, detectFormat, registerConverter } from '@hefuhai001/any-format';

// Convert; options accept converterOptions / via / maxHops / signal
await convert(input, 'markdown', 'text', { maxHops: 3 });

// Check the route without running it
canConvert('markdown', 'text');       // true

// Format sniffing
detectFormat('# Title\n\n- a\n- b');  // { format: 'markdown', confidence: 0.95 }

// Register a custom converter; returns a disposer
const dispose = registerConverter({
  from: 'text',
  to: 'upper',
  convert: (input) => String(input).toUpperCase(),
});
```

Images also ship two direct helpers alongside `convert()`:

```ts
import { convertImage, readImageInfo } from '@hefuhai001/any-format';

// Same as convert(png, 'png', 'webp', { converterOptions: { quality: 75 } })
const webp = await convertImage(pngBuffer, 'webp', { quality: 75 });
const { width, height, hasAlpha } = await readImageInfo(webp);
```

Audio uses the `ffmpeg` binary, resolved from `converterOptions.ffmpegPath`, then `FFMPEG_PATH`, then the optional `ffmpeg-static` package, then `PATH`:

```ts
import { convertAudio, resolveFfmpeg } from '@hefuhai001/any-format';

const mp3 = await convertAudio(wavBuffer, 'mp3', { bitrate: 192, sampleRate: 44100 });
console.log(await resolveFfmpeg()); // which ffmpeg will be used
```

See **[API reference](./docs/api.md)** for full signatures, standalone registries, error types and every export (in Chinese).

## Docs

| Doc | Contents |
| --- | --- |
| [API reference](./docs/api.md) | `convert` options, chaining and cancellation, detectors, registry, errors |
| [Formats](./docs/formats.md) | Matrix, optional engines, binary usage, CJK PDF, known limits |
| [Distribution](./docs/distribution.md) | GitHub install, tarball, local linking, release flow |
| [Development](./docs/development.md) | Layout, design notes, code and test conventions, roadmap |
| [Changelog](./CHANGELOG.md) | Per-release highlights, API changes and known limits |

## License

MIT
