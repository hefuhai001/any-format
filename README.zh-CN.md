[English](./README.md) | **简体中文**

# any-format

轻量、可插拔的文档格式转换基础库。文本与表格转换零依赖，Office/PDF/图片按需加载引擎。

> npm 包名为 **`@hefuhai001/any-format`**，GitHub 仓库仍叫 `any-format`。

## 特性

- **任意互转**：`markdown` `html` `text` `csv` `tsv` `json` 全互通，`docx` `doc` `xlsx` `xls` `pptx` `pdf` 双向接入，`png` `jpeg` `webp` `avif` `tiff` `gif` 图片与 `wav` `mp3` `flac` `ogg` `aac` `m4a` 音频两两互转
- **自动中转**：没有直接转换器时按格式图 BFS 找最短路径，如 `docx → html → pdf`
- **零运行时依赖**：核心与文本/表格转换器为手写实现，Office/PDF 引擎懒加载
- **可扩展**：任何格式对都可通过 `registerConverter()` 注册，支持优先级与注销
- **ESM + CJS**：`import` 与 `require` 均可，自带 `.d.ts`

## 安装

```bash
# 从 npm 安装（推荐）
npm i @hefuhai001/any-format

# 或从 GitHub 安装并锁定 tag
npm i github:hefuhai001/any-format#v0.0.2

# 跟随主干
npm i github:hefuhai001/any-format
```

要求 Node.js >= 18。从 GitHub 安装时会执行 `prepare` 脚本自动构建。安装细节与其他分发方式见 **[分发与安装](./docs/distribution.md)**。

用到 Office/PDF/图片/音频时按需安装对应引擎，未安装只影响该格式：

```bash
npm i mammoth docx      # docx 读写
npm i xlsx              # xlsx / xls 读写
npm i fflate pptxgenjs  # pptx 读写
npm i pdf-parse pdfkit  # pdf 读写
npm i word-extractor    # 老式 .doc 读取
npm i sharp             # png / jpeg / webp / avif / tiff / gif 互转
npm i ffmpeg-static     # wav / mp3 / flac / ogg / aac / m4a（也可用系统 ffmpeg）
```

## 快速开始

```ts
import { convert } from '@hefuhai001/any-format';

const { data, path } = await convert('# Hello\n\n**world**', 'markdown', 'html');
// data: <h1>Hello</h1>\n\n<p><strong>world</strong></p>
// path: ['markdown', 'html']
```

链式转换自动中转：

```ts
const result = await convert(docxBuffer, 'docx', 'pdf');
result.path; // ['docx', 'html', 'pdf']
```

二进制格式传 `Buffer`/`Uint8Array`，输出 `Uint8Array`：

```ts
import { readFile, writeFile } from 'node:fs/promises';

const docx = await readFile('report.docx');            // 不要传 'utf8'
const { data } = await convert(docx, 'docx', 'markdown');

const pdf = await convert('# 报告', 'markdown', 'pdf');
await writeFile('out.pdf', pdf.data as Uint8Array);
```

## 格式支持

| 格式 | 读 | 写 | 依赖 |
| --- | --- | --- | --- |
| `markdown` `html` `text` `csv` `tsv` `json` | ✓ | ✓ | 无 |
| `docx` | ✓ | ✓ | `mammoth` / `docx` |
| `xlsx` / `xls` | ✓ | ✓ | `xlsx` |
| `pptx` | ✓ | ✓ | `fflate` / `pptxgenjs` |
| `pdf` | ✓（仅文本） | ✓ | `pdf-parse` / `pdfkit` |
| `doc` | ✓（仅文本） | ✗ | `word-extractor` |
| `png` `jpeg` `webp` `avif` `tiff` `gif` | ✓ | ✓ | `sharp` |
| `wav` `mp3` `flac` `ogg` `aac` `m4a` | ✓ | ✓ | `ffmpeg` |

完整矩阵、各格式选项与限制见 **[格式支持](./docs/formats.md)**。

## 常用 API

```ts
import { canConvert, convert, detectFormat, registerConverter } from '@hefuhai001/any-format';

// 转换；options 支持 converterOptions / via / maxHops / signal
await convert(input, 'markdown', 'text', { maxHops: 3 });

// 只查路径，不执行
canConvert('markdown', 'text');       // true

// 格式探测
detectFormat('# Title\n\n- a\n- b');  // { format: 'markdown', confidence: 0.95 }

// 注册自定义转换器，返回注销函数
const dispose = registerConverter({
  from: 'text',
  to: 'upper',
  convert: (input) => String(input).toUpperCase(),
});
```

图片除 `convert()` 外还提供两个直连辅助函数：

```ts
import { convertImage, readImageInfo } from '@hefuhai001/any-format';

// 等同 convert(png, 'png', 'webp', { converterOptions: { quality: 75 } })
const webp = await convertImage(pngBuffer, 'webp', { quality: 75 });
const { width, height, hasAlpha } = await readImageInfo(webp);
```

音频依赖 `ffmpeg` 可执行文件，解析顺序为 `converterOptions.ffmpegPath` → `FFMPEG_PATH` → 可选包 `ffmpeg-static` → `PATH`：

```ts
import { convertAudio, resolveFfmpeg } from '@hefuhai001/any-format';

const mp3 = await convertAudio(wavBuffer, 'mp3', { bitrate: 192, sampleRate: 44100 });
console.log(await resolveFfmpeg()); // 查看实际使用的 ffmpeg
```

完整签名、独立注册表、错误类型与全部导出见 **[API 参考](./docs/api.md)**。

## 文档

| 文档 | 内容 |
| --- | --- |
| [API 参考](./docs/api.md) | `convert` 选项、链式与取消、探测器、注册表、错误处理 |
| [格式支持](./docs/formats.md) | 矩阵、可选引擎、二进制用法、中文 PDF、已知限制 |
| [分发与安装](./docs/distribution.md) | GitHub 直装、tarball、本地联调、发版流程 |
| [开发指南](./docs/development.md) | 目录结构、设计要点、代码与测试约定、路线图 |
| [更新日志](./CHANGELOG.md) | 各版本的能力、API 变更与已知限制 |

## License

MIT
