export interface HtmlToMarkdownOptions {
  /** Heading style for `<h1>`-`<h6>`. Default `atx` (`#`). */
  headingStyle?: 'atx' | 'setext';
  /** Bullet marker for unordered lists. Default `-`. */
  bullet?: '-' | '*' | '+';
  /** Wrap the output at this column; `0` disables wrapping. Default `0`. */
  wrap?: number;
}

export const DEFAULT_BULLET = '-';
