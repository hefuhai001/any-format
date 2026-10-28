# 更新日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)，发布说明同时归档在 [`docs/releases/`](./docs/releases)。

## [0.0.2] - 2026-10-27

首个功能完整版本：在 0.0.1 的文本 / 表格 / Office / PDF 基础上，补齐图片与音频两条格式族，并把包名统一为 `any-format`。

### 新增：图片格式互转（`sharp` 引擎）

- 支持 `png` `jpeg` `webp` `avif` `tiff` `gif` 任意两两互转，6 × 5 = 30 条直达边，无需中转
- 新 API：`convertImage(input, to, options?)`、`readImageInfo(input)`
- 转换选项：`quality`（1–100，默认 82）、`lossless`（webp/avif/tiff）、`background`（目标无 alpha 通道时的底色）、`animated`（gif/webp 多帧）
- 透明图转 `jpeg` 时自动按 `background` 压平；编码前按 EXIF 方向自动摆正
- 新导出：`IMAGE_FORMATS`、`imageConverters`、类型 `ImageConvertOptions` / `ImageFormat` / `ImageInfo`

### 新增：音频格式互转（`ffmpeg` 引擎）

- 支持 `wav` `mp3` `flac` `ogg` `aac` `m4a` 任意两两互转，同样 30 条直达边
- 新 API：`convertAudio(input, to, options?)`、`buildAudioArgs()`、`resolveFfmpeg()`
- 转换选项：`bitrate`（kbps，默认 192）、`sampleRate`、`channels`、`compressionLevel`（flac 0–12）、`ffmpegPath`
- ffmpeg 解析顺序：`converterOptions.ffmpegPath` → 环境变量 `FFMPEG_PATH` → 可选包 `ffmpeg-static` → `PATH`
- 输入走 stdin、输出走 stdout，不落临时文件；`m4a`（ipod/mp4 复用器要求可 seek）使用临时文件并自动清理
- WAV 输出会补齐 ffmpeg 流式写入留下的 `0xFFFFFFFF` 长度占位符，生成标准文件头
- `ogg` 固定为 Vorbis，只支持 VBR，`bitrate` 会自动换算成 `-q:a` 质量档

### 新增：格式探测

- 扩展名：新增 `png` `jpg` `jpeg` `jpe` `webp` `avif` `tif` `tiff` `gif` 与 `wav` `wave` `mp3` `flac` `ogg` `oga` `aac` `m4a`
- MIME：新增 7 个 `image/*` 与 12 个 `audio/*` 映射
- `normalizeFormat()` 支持别名归一：`jpg` / `jpe` → `jpeg`，`tif` → `tiff`，转换器按规范名注册与查找

### 变更

- **导入名统一为 `@hefuhai001/any-format`**：npm 上 `any-format` 已被其他项目占用，因此以作用域包名发布；仓库名仍为 `any-format`
- 仓库地址同步为 `github.com/hefuhai001/any-format`，README 与文档中的安装、克隆命令全部更新
- CI 增加 npm 发布步骤（`NPM_TOKEN` 注入，版本已存在时自动跳过）
- README 双语化：`README.md` 为英文默认，`README.zh-CN.md` 为中文，顶部可互相切换
- PDF / PPTX 写入的默认作者元数据改为 `any-format`
- `package.json` 关键词补充 `image` / `png` / `jpeg` / `webp` / `audio` / `mp3` / `wav` / `flac`

### 测试与校验

- 301 项用例全部通过（0.0.1 为 273 项）
- 新增 `test/adapters/image.test.ts`（13 项）与 `test/adapters/audio.test.ts`（13 项），均为真实编码解码，不使用 mock：校验容器头、往返时长、FLAC 逐样本无损、码率对体积的影响、透明背景压平、临时文件清理
- `npm run typecheck`、`npm run build`、`npx publint` 均通过
- 发布包体积 152 kB（解压 640 kB），共 10 个文件

### 依赖说明

- 图片转换需安装可选 peer `sharp`
- 音频转换需可用的 `ffmpeg` 可执行文件，推荐 `npm i ffmpeg-static`
- 其余格式仍按需加载 `mammoth` / `docx` / `xlsx` / `fflate` / `pptxgenjs` / `pdf-parse` / `pdfkit` / `word-extractor`

### 已知限制

- 图片只做像素级转码，不提供裁剪 / 缩放 / 滤镜；`bmp` / `heic` / `svg` 未登记为格式
- 音频不处理视频轨，整个文件读入内存，暂无流式 API
- `doc` 只读、`ppt` 不支持、`pdf` 仅提取文本

### 安装

```bash
npm i @hefuhai001/any-format          # npm
npm i github:hefuhai001/any-format#v0.0.2   # GitHub 直装
```

## [0.0.1] - 2026-10-27

首个可运行版本。

- 纯 JS 文本族互转：`markdown` `html` `text` `csv` `tsv` `json`
- 表格族互转：CSV / TSV / JSON / Markdown 表格 / HTML 表格
- Office / PDF 适配器：`docx`（mammoth / docx）、`xlsx` / `xls`（SheetJS）、`pptx`（fflate / pptxgenjs）、`pdf`（pdf-parse / pdfkit）、`doc` 只读（word-extractor）
- 格式图 BFS 自动中转（`docx → html → pdf`）、`registerConverter()` 扩展、可取消转换、独立注册表
- 273 项用例

[0.0.2]: https://github.com/hefuhai001/any-format/releases/tag/v0.0.2
[0.0.1]: https://github.com/hefuhai001/any-format/releases/tag/v0.0.1
