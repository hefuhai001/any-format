# 分发与安装

当前**不发布到 npm registry**，通过 GitHub 仓库直接安装。

## 从 GitHub 安装

```bash
# 跟随主干最新提交
npm i github:hefuhai001/any-format

# 锁定 tag（推荐用于生产）
npm i github:hefuhai001/any-format#v0.0.1

# 锁定到某个 commit
npm i github:hefuhai001/any-format#a1b2c3d
```

在 `package.json` 中的写法：

```json
{
  "dependencies": {
    "any-format": "github:hefuhai001/any-format#v0.0.1"
  }
}
```

pnpm / yarn 同样支持：

```bash
pnpm add github:hefuhai001/any-format#v0.0.1
yarn add github:hefuhai001/any-format#v0.0.1
```

## 安装时会发生什么

GitHub 直装依赖 `prepare` 脚本，npm 会：

1. 克隆仓库到缓存目录
2. 安装 `devDependencies`（tsup、typescript 等）
3. 执行 `prepare` → `npm run build`，生成 `dist/`
4. 按 `files` 之外的实际目录结构链接进 `node_modules/any-format`

因此仓库必须保留 `src/`、`tsconfig.json`、`tsup.config.ts` 和 `package.json`——`files` 白名单只影响 `npm publish` 的内容，不影响 git 安装。

**代价**：消费方安装时需要一次本地构建（几秒），且需要能访问 npm registry 下载 devDependencies。

## 消费方注意事项

- **ESM 与 CJS 都可用**：`import` 走 `dist/index.js`，`require` 走 `dist/index.cjs`
- **可选引擎仍需自行安装**：GitHub 直装不会带上 `mammoth`、`xlsx`、`pdfkit` 等 peer 依赖，用到哪种格式就装哪个（见[格式支持](./formats.md)）
- **TypeScript 无需额外配置**：类型随包提供，`exports` 已声明 `types` 条件
- **升级**：`npm i github:hefuhai001/any-format#v0.0.2`；GitHub 直装不参与 semver 自动升级，版本号需手动改

## 其他分发方式

| 方式 | 命令 | 适用场景 |
| --- | --- | --- |
| tarball | `npm pack` → `npm i ./any-format-0.0.1.tgz` | 内网、离线、交付给无法访问 GitHub 的同学 |
| 本地联调 | `npm link`（仓库内）→ `npm link any-format`（项目中） | 边改边用，无需发版 |
| git submodule / monorepo | workspace 内直接引用路径 | 同一仓库多包协作 |
| 私有 registry | Verdaccio，`npm publish --registry http://localhost:4873` | 团队统一源与缓存 |

## 发版流程

1. 写版本说明：`docs/releases/v<version>.md`（Release 正文），并同步 `CHANGELOG.md`
2. 升版本号并打附注 tag，tag 说明直接复用同一份文件
3. 推送提交与 tag

```bash
npm version patch --no-git-tag-version        # 或 minor / major
git add -A && git commit -m "chore: release v%s"
git tag -a v0.0.2 -F docs/releases/v0.0.2.md
git push --follow-tags
```

`.github/workflows/release.yml` 监听 `v*` tag：类型检查 → 测试 → 构建 → `publint` 校验 → `npm pack` → **自动创建 GitHub Release**。正文取 `docs/releases/<tag>.md`，文件不存在时退化为按提交自动生成的说明；`any-format-<version>.tgz` 作为 Release 附件上传，同时保留 90 天的 workflow artifact，可下载后离线分发。

**不会发布到 npm**：`npm publish` 步骤以注释形式保留在 workflow 里，将来需要时取消注释并配置 `NPM_TOKEN`（或 Trusted Publisher）即可。

### 若将来要发布到 npm

1. 确认包名可用：`npm view any-format version` 应返回 404
2. `npm run typecheck && npm test && npx publint`
3. `npm publish`（scoped 包需加 `--access public`，`publishConfig.access` 已配好）
4. 首次发布后可在 npmjs.com 绑定 Trusted Publisher，后续交给 CI

`prepublishOnly` 会在发布前自动重跑构建与测试。
