# 格式支持

## 矩阵

「读」= 可解析，「写」= 可生成。文本/表格族为纯 JS 实现，Office/PDF 依赖可选引擎。

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
| `pdf` | ✓（仅文本） | ✓ | `pdf-parse` / `pdfkit` |
| `doc` | ✓（仅文本） | ✗ | `word-extractor` |

常见的两跳链路：

```ts
await convert(docxBuffer, 'docx', 'pdf');        // docx → html → pdf
await convert(xlsxBuffer, 'xlsx', 'markdown');   // 直接命中
await convert(csvText, 'csv', 'xlsx');           // 直接命中
await convert(pptxBuffer, 'pptx', 'docx');       // pptx → markdown → docx
await convert(pdfBuffer, 'pdf', 'markdown');     // pdf → text → markdown
```

`canConvert(from, to, { maxHops: 3 })` 可查询是否可达。

## 可选引擎

核心包零运行时依赖。按需安装所需格式的引擎：

```bash
# Word
npm i mammoth          # docx 读取
npm i docx             # docx 生成
npm i word-extractor   # 老式 .doc 读取

# Excel
npm i xlsx             # xlsx / xls 读写（SheetJS）

# PowerPoint
npm i fflate pptxgenjs # pptx 读取 / 生成

# PDF
npm i pdf-parse        # pdf 文本提取
npm i pdfkit           # pdf 生成
```

这些包声明为 `peerDependencies` 且全部 `optional: true`。未安装时只有对应格式的转换会失败，并抛出带安装命令的错误，其他格式不受影响。

## 二进制用法

二进制格式输入 `Buffer`/`Uint8Array`，输出 `Uint8Array`：

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { convert } from 'anyformat';

const docx = await readFile('report.docx');   // 不要传 'utf8'
const { data } = await convert(docx, 'docx', 'markdown');  // string

const pdf = await convert('# 报告', 'markdown', 'pdf');
await writeFile('report.pdf', pdf.data as Uint8Array);
```

传字符串给二进制格式会抛 `InvalidInputError`，提示改用 `fs.readFile()`。

### 中文 PDF

`pdfkit` 内置字体只覆盖拉丁字符，输出中文需指定 TTF/OTF 字体：

```ts
await convert(md, 'markdown', 'pdf', {
  converterOptions: { fontPath: './fonts/SourceHanSans.ttf' },
});
```

## 各格式的转换器选项

### docx

```ts
// 读取
{ styleMap?: string[] }              // mammoth 样式映射
// 写入
{ title?: string; fontSize?: number }
```

### xlsx / xls

```ts
// 读取
{ sheet?: string | number; header?: boolean }   // 工作表名或索引
// 写入
{ sheetName?: string }
```

### pptx

```ts
// 读取
{ slideNumbers?: boolean; notes?: boolean }
// 写入
{ layout?: 'LAYOUT_16x9' | 'LAYOUT_4x3' | 'LAYOUT_WIDE'; titleSize?: number; bodySize?: number; fontFace?: string }
```

写入时按 `#` 一级标题与 `---` 分页，每页首段作为标题。

### pdf

```ts
// 读取
{ pages?: number[] }                                  // 1-based 页码
// 写入
{ fontPath?: string; size?: 'A4' | 'A3' | 'LETTER' | 'LEGAL'; margin?: number; fontSize?: number; title?: string }
```

### 文本族

```ts
// markdown -> html
{ document?: boolean; escapeHtml?: boolean }
// html -> markdown
{ headingStyle?: 'atx' | 'setext'; bullet?: '-' | '*' | '+'; wrap?: number }
// html -> text
{ preserveLineBreaks?: boolean; collapseWhitespace?: boolean }
// text -> html
{ document?: boolean; paragraphs?: boolean; title?: string }
// csv 解析 / 序列化
{ delimiter?: string; header?: boolean; quote?: string; trim?: boolean }
{ eol?: string; quoteAll?: boolean }
// 表格对齐
{ align?: 'left' | 'center' | 'right' }
```

## 已知限制

- **`.doc` 只读**：OLE2/BIFF 二进制在纯 JS 中没有可靠的写入实现。需要 `.doc` 输出时用 `docx` 或 LibreOffice（`libreoffice --headless --convert-to doc`）
- **`.ppt` 不支持**：请先转为 `.pptx`
- **`.pdf` 只提取文本**：不还原表格、图片与版式；`pdf → xlsx` 这类结构性重建不可达
- **`markdown → html` 是子集实现**：覆盖标题、列表、引用、栅栏代码块、表格、链接/图片、粗斜体/删除线。需要完整 CommonMark 时用 `registerConverter()` 接入 `marked` / `remark`
- **升级优先级**：同一格式对有多实现时按 `priority` 取最高者，可用 `findAll()` 查看全部
