# 开发指南

## 本地准备

```bash
git clone git@github.com:hefuhai001/any-format.git
cd any-format
npm install        # prepare 钩子会自动构建一次
```

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | tsup 监听构建 |
| `npm run build` | 产出 ESM + CJS + `.d.ts` |
| `npm test` | node:test + tsx |
| `npm run test:coverage` | 覆盖率报告 |
| `npm run typecheck` | `tsc --noEmit` |

要求 Node.js >= 18。

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
│   └── detect/               # content.ts（内容探测器）/ rules.ts（扩展名与 MIME）
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
    ├── docx/                 # read（mammoth）/ write（docx）
    ├── pdf/                  # read（pdf-parse）/ write（pdfkit）
    ├── image/                # convert / read（sharp）
    ├── audio/                # convert / run（ffmpeg）
    ├── pptx/                 # read（fflate）/ serialize / write（pptxgenjs）
    ├── xlsx/                 # read / write（SheetJS）
    └── doc.ts                # 老式 .doc 只读
```

## 设计要点

- **输入契约统一**：转换器输入输出均为 `string | Uint8Array`。二进制格式靠适配器接入，用可选 peer + 动态 `import()` 加载，不进主包体积
- **中转策略保守**：`maxHops` 默认 2，避免不经意的多级丢信息转换；需要精确控制时用 `via` 白名单
- **转换器可异步**：懒加载依赖不会拖慢冷启动，也不会阻塞核心 API
- **注册零成本**：`registry.registerAll(officeConverters)` 只登记元数据，不加载任何模块

## 代码约定

- 单文件目标 ≤150 行，超出的按**输入 / 输出 / 序列化**分治
- 每个目录用 `index.ts` 做 barrel，内部文件重排不影响对外 API
- 共用能力（转义、实体、块模型、表格渲染）抽到独立模块，避免适配器互相依赖
- 类型与实现同文件，跨模块只引用具体路径，不依赖别人的 barrel

## 测试

测试按层组织，与 `src` 目录一一对应：

```
test/
├── core/          # 注册表、路径搜索、调度、探测、错误
├── converters/    # markdown / html / csv / table / text
├── adapters/      # 懒加载、docx / xlsx / pptx / pdf / doc / image / audio
└── integration.test.ts   # 格式矩阵、真实链路往返、扩展性
```

约定：

- 纯函数直测，格式转换走公共 API `convert()`，让契约与实现同时被覆盖
- Office/PDF 用例真实生成并回读文件（校验 ZIP / OLE2 / `%PDF-` 文件头），不使用 mock
- 边界优先：空输入、畸形输入、错误分支、取消信号、选项传递

当前 301 项用例，行覆盖率约 88%。

## 路线图

- [x] 表格族内置转换：`csv ↔ tsv ↔ json ↔ markdown table ↔ html table`
- [x] `docx` / `xlsx` / `xls` / `pptx` / `pdf` / `doc` 适配器
- [x] 图片互转：`png` / `jpeg` / `webp` / `avif` / `tiff` / `gif`（`sharp` 引擎）
- [x] 音频互转：`wav` / `mp3` / `flac` / `ogg` / `aac` / `m4a`（`ffmpeg` 引擎）
- [ ] `.ppt`（老版 PowerPoint）支持
- [ ] 可选 LibreOffice 后端，覆盖 `.doc` 写入与高保真互转
- [ ] 流式 API（`convertStream()`）处理大文件
- [ ] 内置 markdown 渲染器的 CommonMark 一致性套件
