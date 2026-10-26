# API 参考

## convert(input, from, to, options?)

```ts
const { data, path } = await convert('# Hi', 'markdown', 'html');
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `input` | `string \| Uint8Array` | 文本格式传 `string`，二进制格式传 `Buffer`/`Uint8Array` |
| `from` / `to` | `string` | 格式名，大小写与首尾空格会被规范化 |
| `options` | `ConvertOptions` | 见下 |

```ts
interface ConvertOptions {
  converterOptions?: unknown;   // 透传给命中的转换器（逐跳传递）
  via?: string[] | false;       // 允许的中转格式白名单；false 禁用链式
  maxHops?: number;             // 最大跳数，默认 2
  signal?: AbortSignal;         // 取消信号
}
```

返回 `ConvertResult`：

```ts
interface ConvertResult {
  data: string | Uint8Array;    // 文本格式为 string，二进制为 Uint8Array
  from: string;
  to: string;
  path: string[];               // 实际走的路径，如 ['docx', 'html', 'pdf']
}
```

### 链式转换

没有直接转换器时，按格式图做 BFS 找最短路径：

```ts
const result = await convert(docxBuffer, 'docx', 'pdf');
result.path; // ['docx', 'html', 'pdf']
```

控制中转行为：

```ts
// 只允许经由 html 中转
await convert(md, 'markdown', 'text', { via: ['html'] });

// 完全禁用链式，只接受直接转换器
await convert(md, 'markdown', 'html', { via: false });

// 允许更长的链路（默认 2 跳）
await convert(text, 'text', 'json', { maxHops: 3 });
```

### 取消

```ts
const controller = new AbortController();
const promise = convert(bigDocx, 'docx', 'html', { signal: controller.signal });
controller.abort();
```

转换器内部可通过 `ctx.throwIfAborted()` 响应取消；每一跳之间也会检查一次。

## canConvert(from, to, options?)

判断是否存在直接或链式路径，不执行转换：

```ts
canConvert('markdown', 'html');                  // true
canConvert('markdown', 'text', { via: false });  // false
canConvert('text', 'json', { maxHops: 3 });      // true
```

## 格式探测

```ts
import { detectFormat, detectFromFileName, detectFromMimeType } from 'anyformat';

detectFormat('{"a":1}');              // { format: 'json', confidence: 1 }
detectFormat('# Title\n\n- a\n- b');  // { format: 'markdown', confidence: 0.95 }
detectFromFileName('docs/a.MD');      // 'markdown'
detectFromMimeType('text/html; charset=utf-8'); // 'html'
```

`detectFormat()` 支持 `{ minConfidence }`；低于阈值时返回 `{ format: 'text', confidence: 0 }`。

注册自定义探测器：

```ts
import { registerDetector } from 'anyformat';

const dispose = registerDetector({
  format: 'toml',
  score: (sample) => (sample.includes('[package]') ? 1 : 0),
});

detectFormat('[package]\nname = "x"').format; // 'toml'
dispose();
```

`score` 返回 0–1，超出范围会被截断。

## registerConverter(converter)

```ts
import { registerConverter } from 'anyformat';

const dispose = registerConverter({
  from: 'text',
  to: 'upper',
  name: 'uppercase',
  priority: 10,   // 同一 from/to 有多实现时数值大者优先
  convert: (input, options, ctx) => {
    ctx.throwIfAborted();
    return String(input).toUpperCase();
  },
});

await convert('abc', 'text', 'upper'); // data === 'ABC'
dispose();                             // 注销，可重复调用
```

`convert` 可以返回 `Promise`，用于懒加载重型依赖。

> 注册时只登记元数据，不会加载任何模块。真正执行时才 `import()` 依赖。

## 独立注册表

默认注册表是模块级单例。多租户服务或测试可用独立实例，互不影响：

```ts
import { ConverterRegistry, runConversion, markdownToHtml } from 'anyformat';

const registry = new ConverterRegistry();
registry.register(markdownToHtml);
registry.registerAll([...]);         // 批量注册，返回统一 disposer

await runConversion(registry, '# hi', 'markdown', 'html');
```

注册表方法：

| 方法 | 说明 |
| --- | --- |
| `register(converter)` | 注册并返回 disposer |
| `registerAll(converters)` | 批量注册 |
| `find(from, to)` | 优先级最高的转换器 |
| `findAll(from, to)` | 该格式对的全部转换器，按优先级降序 |
| `has(from, to)` | 是否存在直接转换器 |
| `targets(from)` | 一跳可达的目标格式 |
| `findPath(from, to, options)` | BFS 路径，找不到返回 `undefined` |
| `entries()` / `list()` | 全部转换器 / 带元数据的列表 |
| `edges()` | 缓存的邻接表 |
| `clear()` | 清空 |

## 错误处理

```ts
import { isConversionError, UnsupportedConversionError } from 'anyformat';

try {
  await convert('x', 'unknown', 'markdown');
} catch (error) {
  if (error instanceof UnsupportedConversionError) {
    console.log(error.from, error.to);  // 'unknown' 'markdown'
  }
}
```

| 错误类 | 错误码 | 场景 |
| --- | --- | --- |
| `UnsupportedConversionError` | `UNSUPPORTED_CONVERSION` | 无可用路径 |
| `ConversionError` | `CONVERTER_FAILED` | 转换器抛错、可选依赖缺失 |
| `InvalidInputError` | `INVALID_INPUT` | 输入不是 `string`/`Uint8Array` |
| `ConversionError` | `ABORTED` | 信号已取消 |

`ConversionError.cause` 保留原始异常；`isConversionError()` 用于跨包（副本）判断。

## 其他导出

```ts
import {
  registry,            // 默认注册表
  builtinConverters,   // 纯 JS 转换器数组
  officeConverters,    // 适配器转换器数组
  listFormats,         // 已知格式名
  listConverters,      // { from, to, name, priority }[]
  READ_ONLY_FORMATS,   // ['doc', 'pdf']
  normalizeFormat,
} from 'anyformat';
```

单独使用某个转换器（跳过调度）：

```ts
import { markdownToHtml, parseCsv, serializeCsv, renderMarkdownTable } from 'anyformat';

markdownToHtml.convert('# Hi', {}, { throwIfAborted: () => {} });
```

`Converter["convert"]` 的第三个参数是 `ConvertContext`（含 `from`、`target`、`signal`、`throwIfAborted`），直接调用时传一个空实现即可。
