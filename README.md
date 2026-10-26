# format-conversion

轻量、可插拔的文档格式转换基础库。零运行时依赖，ESM + CJS 双产出，自带 TypeScript 类型。

## 特性

- **插件式架构**：任何格式对都可以通过 `registerConverter()` 注册，无侵入扩展
- **自动中转**：没有直接转换器时，按格式图 BFS 找最短路径（如 `docx → html → pdf`）
- **零运行时依赖**：核心与文本/表格转换器为手写实现；Office/PDF 引擎按需安装为可选 peer
- **Office/PDF 全链路**：`docx`/`doc`/`xlsx`/`xls`/`pptx`/`pdf` 与文本族任意互转
- **格式探测**：按内容、文件扩展名或 MIME 类型推断格式
- **可取消 / 可组合**：支持 `AbortSignal`，可自建独立 `ConverterRegistry`
- **ESM + CJS**：`import` 与 `require` 均可，含 `.d.ts`

## 安装

```bash
npm i format-conversion
```

要求 Node.js >= 18。

## 快速开始

```ts
import { convert } from 'format-conversion';

const { data, path } = await convert('# Hello\n\n**world**', 'markdown', 'html');
console.log(data); // <h1>Hello</h1>\n\n<p><strong>world</strong></p>
console.log(path); // ['markdown', 'html']
```

链式转换（无需显式声明，自动中转）：

```ts
const { data, path } = await convert('# Title\n\nHello', 'markdown', 'text');
console.log(path); // ['markdown', 'html', 'text']
console.log(data); // # Title\n\nHello
```

## 格式支持矩阵

「读」= 可解析为该格式，「写」= 可生成为该格式。表格族与文本族为纯 JS 实现，Office/PDF 依赖可选 peer。

| 格式 | 读 | 写 | 依赖 |
| --- | --- | --- | --- |
| `markdown` | ✓ | ✓ | 无 |
| `html` | ✓ | ✓ | 无 |
| `text` | ✓ | ✓ | 无 |
| `csv` / `tsv` | ✓ | ✓ | 无 |
| `json` | ✓ | ✓ | 无 |
| `docx` | ✓ | ✓ | `mammoth` / `docx` |
| `xlsx` | ✓ | ✓ | `xlsx` |
| `xls` | ✓ | ✓ | `xlsx` |
| `pptx` | ✓ | ✓ | `fflate` / `pptxgenjs` |
| `pdf` | ✓（文本） | ✓ | `pdf-parse` / `pdfkit` |
| `doc` | ✓（文本） | ✗ | `word-extractor` |

任意两种格式之间都可 `convert()`：没有直接转换器时自动中转，最多 2 跳。

```ts
await convert(csvText, 'csv', 'xlsx');       // 表格 -> Excel
await convert(xlsxBuffer, 'xlsx', 'json');   // Excel -> JSON
await convert(docxBuffer, 'docx', 'pdf');    // docx -> html -> pdf
await convert('# 标题\n\n要点', 'markdown', 'pptx'); // 每页一个标题
```

### 安装可选依赖

核心包零依赖。按需安装所需格式的引擎：

```bash
# Word
npm i mammoth          # docx 读取
npm i docx             # docx 生成
npm i word-extractor   # 老式 .doc 读取

# Excel
npm i xlsx             # xlsx/xls 读写（SheetJS）

# PowerPoint
npm i fflate pptxgenjs # pptx 读取 / 生成

# PDF
npm i pdf-parse        # pdf 文本提取
npm i pdfkit           # pdf 生成
```

未安装时调用会抛出明确错误，提示需要执行的安装命令，不影响其他格式。

### 二进制用法

二进制格式的输入是 `Buffer`/`Uint8Array`，输出是 `Uint8Array`：

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { convert } from 'format-conversion';

const docx = await readFile('report.docx');            // 不要用 'utf8'
const { data } = await convert(docx, 'docx', 'markdown');
console.log(data);                                     // string

const pdf = await convert('# 报告', 'markdown', 'pdf');
await writeFile('report.pdf', pdf.data as Uint8Array);
```

> 中文 PDF：`pdfkit` 内置字体仅支持拉丁字符，转中文需指定 TTF 字体路径：
> `convert(md, 'markdown', 'pdf', { converterOptions: { fontPath: './fonts/SourceHanSans.ttf' } })`

### 老式二进制格式说明

- `.doc`（Word 97-2003）：**只读**。二进制格式在纯 JS 中没有可靠的写入实现，需要 LibreOffice 等外部后端。
- `.xls`（Excel 97-2003）：SheetJS 支持读写，已覆盖。
- `.ppt`（PowerPoint 97-2003）：不支持，请先转为 `.pptx`。

## API

### `convert(input, from, to, options?): Promise<ConvertResult>`

```ts
interface ConvertOptions {
  converterOptions?: unknown;      // 透传给命中的转换器
  via?: string[] | false;          // 允许的中转格式；false 禁用链式
  maxHops?: number;                // 最大跳数，默认 2
  signal?: AbortSignal;
}
```

返回 `{ data, from, to, path }`。文本格式 `data` 为 `string`，二进制格式预留 `Uint8Array`。

### `canConvert(from, to, options?): boolean`

判断是否存在直接或链式转换路径，不执行转换。

### `detectFormat(sample, options?)`

```ts
detectFormat('{"a":1}');            // { format: 'json', confidence: 1 }
detectFromFileName('a/b/doc.md');   // 'markdown'
detectFromMimeType('text/html');    // 'html'
```

### `registerConverter(converter)`

```ts
import { registerConverter } from 'format-conversion';

const dispose = registerConverter<string>({
  from: 'text',
  to: 'upper',
  name: 'uppercase',
  priority: 10, // 同一 from/to 有多实现时数值大者优先
  convert: (input, options, ctx) => {
    ctx.throwIfAborted();
    return String(input).toUpperCase();
  },
});

await convert('abc', 'text', 'upper'); // data === 'ABC'
dispose(); // 注销
```

### 独立注册表

服务端多租户或测试场景可用自己的实例，避免污染全局：

```ts
import { ConverterRegistry, runConversion, markdownToHtml } from 'format-conversion';

const registry = new ConverterRegistry();
registry.register(markdownToHtml);
await runConversion(registry, '# hi', 'markdown', 'html');
```

### 错误处理

```ts
import { isConversionError, UnsupportedConversionError } from 'format-conversion';

try {
  await convert('x', 'docx', 'markdown');
} catch (error) {
  if (error instanceof UnsupportedConversionError) {
    console.log(error.from, error.to); // 'docx' 'markdown'
  }
}
```

错误码：`UNSUPPORTED_CONVERSION` / `CONVERTER_FAILED` / `INVALID_INPUT` / `ABORTED`。

## 设计说明

- **输入契约**：转换器输入输出均为 `string | Uint8Array`，二进制重格式（docx/pdf/xlsx）通过适配器接入，用可选 peer 依赖 + 动态 `import()` 加载，不进主包体积。
- **中转策略**：`maxHops` 默认 2，避免不经意的多级丢信息转换；需要精确控制时用 `via` 白名单。
- **转换器可异步**：适配器可以懒加载依赖而不影响核心 API。

## 路线图

- [x] 表格族内置转换：`csv ↔ tsv ↔ json ↔ markdown table ↔ html table`
- [x] `docx` / `xlsx` / `xls` / `pptx` / `pdf` / `doc` 适配器
- [ ] `.ppt`（老版 PowerPoint）支持
- [ ] 可选 LibreOffice 后端，覆盖 `.doc` 写入与高保真互转
- [ ] 流式 API（`convertStream()`）处理大文件
- [ ] 内置转换器的 CommonMark 一致性测试套件

## 目录结构

```
src/
├── index.ts                  # 公共 API 门面：只做导出与薄封装
├── registry.ts               # 默认注册表 + 内置/适配器装配
├── core/
│   ├── types.ts              # 全部公开类型契约
│   ├── format.ts             # 格式名规范化
│   ├── path.ts               # 格式图 BFS 路径搜索
│   ├── registry.ts           # 转换器注册表
│   ├── convert.ts            # 转换调度、错误包装、取消
│   ├── errors.ts             # 错误类型与错误码
│   └── detect/               # content.ts（内容探测器） / rules.ts（扩展名与 MIME）
├── converters/               # 纯 JS、零运行时依赖
│   ├── escape.ts             # HTML 转义
│   ├── entities.ts           # HTML 实体解码
│   ├── markdown/             # types / inline / blocks —— markdown → html
│   ├── html-to-markdown/     # types / inline / blocks
│   ├── csv/                  # parse / serialize / converters
│   ├── table/                # markdown-table / html-table / records / converters
│   └── html-to-text.ts · text-to-html.ts · text-to-markdown.ts
└── adapters/                 # 可选引擎，全部懒加载
    ├── loader.ts             # 动态 import + 二进制输入校验
    ├── blocks/               # types / parse / inline / text —— 供 docx·pdf·pptx 复用
    ├── docx/                 # read（mammoth） / write（docx）
    ├── pdf/                  # read（pdf-parse） / write（pdfkit）
    ├── pptx/                 # read（fflate） / serialize / write（pptxgenjs）
    ├── xlsx/                 # read / write（SheetJS）
    └── doc.ts                # 老式 .doc 只读
```

拆分约定：

- 单文件目标 ≤150 行，超出的按**输入 / 输出 / 序列化**分治
- 每个目录用 `index.ts` 做 barrel，内部文件重排不影响对外 API
- 共用能力（转义、实体、块模型、表格渲染）抽到独立模块，避免适配器互相依赖
- 目录结构调整不改变 `package.json` 的 `exports`，发布产物仍是单一的 `dist/index.js`

## 开发

```bash
npm install
npm run dev            # 监听构建
npm test               # node:test + tsx
npm run test:coverage  # 覆盖率报告
npm run typecheck
npm run build
```

测试按层组织，与 `src` 目录一一对应：

```
test/
├── core/          # 注册表、路径搜索、调度、探测、错误
├── converters/    # markdown / html / csv / table / text 纯 JS 转换器
├── adapters/      # 懒加载、docx / xlsx / pptx / pdf / doc
└── integration.test.ts   # 格式矩阵、真实链路往返、扩展性
```

约定：

- 纯函数优先直测，格式转换走公共 API `convert()`，确保契约与实现同时被覆盖
- Office/PDF 用例会真实生成并回读文件（校验 ZIP/OLE2/`%PDF-` 文件头），而不是 mock
- 边界优先：空输入、畸形输入、错误分支、取消信号、选项传递

## License

MIT
