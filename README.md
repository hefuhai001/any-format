# format-conversion

轻量、可插拔的文档格式转换基础库。零运行时依赖，ESM + CJS 双产出，自带 TypeScript 类型。

## 特性

- **插件式架构**：任何格式对都可以通过 `registerConverter()` 注册，无侵入扩展
- **自动中转**：没有直接转换器时，按格式图 BFS 找最短路径（如 `markdown → html → text`）
- **零运行时依赖**：内置转换器均为手写实现，安装体积小
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

## 内置格式

| from | to | 说明 |
| --- | --- | --- |
| `markdown` | `html` | 标题、列表、引用、围栏代码块、链接/图片、粗体/斜体/删除线 |
| `html` | `text` | 剥离标签，保留段落与列表结构，解码实体 |
| `text` | `html` | 按空行分段转 `<p>`，自动转义 |

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

- [ ] `adapters/`：`docx → html`（mammoth）、`html → pdf`（puppeteer/playwright）、`xlsx ↔ csv`
- [ ] 表格族内置转换：`csv ↔ json ↔ markdown table`
- [ ] 流式 API（`convertStream()`）处理大文件
- [ ] 内置转换器的 CommonMark 一致性测试套件

## 开发

```bash
npm install
npm run dev        # 监听构建
npm test           # node:test + tsx
npm run typecheck
npm run build
```

## License

MIT
