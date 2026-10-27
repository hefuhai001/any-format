/** Format lookup by file extension or MIME type. */

const EXTENSION_MAP: Record<string, string> = {
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  txt: 'text',
  text: 'text',
  json: 'json',
  csv: 'csv',
  tsv: 'tsv',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  docx: 'docx',
  doc: 'doc',
  pdf: 'pdf',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xls',
  pptx: 'pptx',
  ppt: 'ppt',
  epub: 'epub',
  png: 'png',
  jpg: 'jpeg',
  jpeg: 'jpeg',
  jpe: 'jpeg',
  webp: 'webp',
  avif: 'avif',
  tif: 'tiff',
  tiff: 'tiff',
  gif: 'gif',
};

const MIME_MAP: Record<string, string> = {
  'text/markdown': 'markdown',
  'text/html': 'html',
  'text/plain': 'text',
  'application/json': 'json',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/x-yaml': 'yaml',
  'text/yaml': 'yaml',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/epub+zip': 'epub',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/tiff': 'tiff',
  'image/gif': 'gif',
};

/** Resolve a format from a file path or name. */
export function detectFromFileName(filePath: string): string | undefined {
  const clean = filePath.split(/[?#]/)[0] ?? filePath;
  const dot = clean.lastIndexOf('.');
  if (dot === -1 || dot === clean.length - 1) return undefined;
  return EXTENSION_MAP[clean.slice(dot + 1).toLowerCase()];
}

export function detectFromMimeType(mimeType: string): string | undefined {
  const clean = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return MIME_MAP[clean];
}
