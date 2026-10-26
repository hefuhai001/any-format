export interface MarkdownToHtmlOptions {
  /** Wrap the output in a full `<!doctype html>` document. Default `false`. */
  document?: boolean;
  /** Escape raw HTML found in the source. Default `false`. */
  escapeHtml?: boolean;
}
