#!/usr/bin/env node
/**
 * 发布 Gitee 发行版：创建 Release 并把 `npm pack` 产物作为附件上传。
 *
 *   GITEE_TOKEN=xxxx node scripts/gitee-release.mjs
 *   node scripts/gitee-release.mjs --tag v0.0.2 --dry-run
 *
 * 参数：--tag / --file / --notes-file / --token / --dry-run
 * 环境变量：GITEE_TOKEN（必需）、GITEE_OWNER、GITEE_REPO
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Blob } from 'node:buffer';

const API = 'https://gitee.com/api/v5';
const OWNER = process.env.GITEE_OWNER ?? 'hefuhai001';
const REPO = process.env.GITEE_REPO ?? 'any-format';
const TOKEN = process.env.GITEE_TOKEN ?? '';

const args = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));

/** `@scope/name` → `name`；npm pack 会把作用域前缀从文件名里去掉。 */
const packPrefix = String(pkg.name).replace(/^@[^/]+\//, '').replace(/\//g, '-');

const tag = String(args.tag ?? `v${pkg.version}`);
const notesFile = String(args['notes-file'] ?? join('docs', 'releases', `${tag}.md`));
const tarball = String(args.file ?? `${packPrefix}-${pkg.version}.tgz`);
const token = args.token ? String(args.token) : TOKEN;

if (!existsSync(tarball)) {
  fail(`找不到 ${tarball}，请先执行 \`npm run build && npm pack\``);
}

const notes = existsSync(notesFile) ? await readFile(notesFile, 'utf8') : `Release ${tag}`;

if (args['dry-run']) {
  console.log(`[dry-run] ${OWNER}/${REPO} ${tag}`);
  console.log(`[dry-run] notes: ${existsSync(notesFile) ? notesFile : '(未找到，使用默认说明)'} (${notes.length} 字符)`);
  console.log(`[dry-run] asset: ${basename(tarball)}`);
  process.exit(0);
}

if (!token) {
  console.warn('未设置 GITEE_TOKEN，跳过 Gitee 发行版发布。设置令牌后重新运行：GITEE_TOKEN=xxx npm run release:gitee');
  process.exit(0);
}

const release = await ensureRelease();
await uploadAsset(release);
console.log(`完成：https://gitee.com/${OWNER}/${REPO}/releases/tag/${tag}`);

/** 已存在同 tag 的发行版时直接复用，并把版本说明同步为当前文件内容。 */
async function ensureRelease() {
  try {
    const created = await request(`/repos/${OWNER}/${REPO}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        tag_name: tag,
        name: tag,
        body: notes,
        target_commitish: 'master',
        prerelease: false,
      }),
    });
    console.log(`已创建发行版 ${tag}（id=${created.id}）`);
    return created;
  } catch (error) {
    if (!/already|exists|重复|409|400/i.test(error.message)) throw error;
    console.log(`发行版 ${tag} 已存在，改为更新说明`);
    const existing = await request(`/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(tag)}?access_token=${encodeURIComponent(token)}`);
    const patched = await request(`/repos/${OWNER}/${REPO}/releases/${existing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, tag_name: tag, name: tag, body: notes, prerelease: false }),
    });
    return { ...existing, ...patched };
  }
}

async function uploadAsset(release) {
  const name = basename(tarball);
  if (Array.isArray(release.assets) && release.assets.some((asset) => asset?.name === name)) {
    console.log(`附件 ${name} 已存在，跳过上传`);
    return;
  }

  const bytes = await readFile(tarball);
  const form = new FormData();
  form.append('access_token', token);
  form.append('file', new Blob([bytes], { type: 'application/gzip' }), name);

  const asset = await request(`/repos/${OWNER}/${REPO}/releases/${release.id}/attach_files`, {
    method: 'POST',
    body: form,
  });
  console.log(`已上传附件 ${name}（${(bytes.byteLength / 1024).toFixed(1)} KB）→ ${asset?.browser_download_url ?? 'ok'}`);
}

async function request(pathname, init) {
  const response = await fetch(`${API}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : undefined;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const tokenArg = argv[index];
    if (!tokenArg?.startsWith('--')) continue;
    const key = tokenArg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
