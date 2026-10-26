/**
 * Public type contracts for the conversion pipeline.
 */

/** Canonical format identifier, lower-case, e.g. `md`, `html`, `text`, `docx`. */
export type Format = string;

/** Text payload carried between converters. */
export type TextInput = string;

/** Binary payload, used by adapters dealing with office/PDF formats. */
export type BinaryInput = Uint8Array;

export type ConvertInput = TextInput | BinaryInput;

export interface ConvertContext {
  /** The format the caller asked for. In a chained conversion this stays constant. */
  readonly target: Format;
  /** Format of the value passed to the current converter. */
  readonly from: Format;
  /** Aborted when the caller's signal fires. */
  readonly signal?: AbortSignal;
  /** Abort early when the caller cancels. */
  readonly throwIfAborted: () => void;
}

export interface Converter<O = Record<string, unknown>> {
  /** Source format this converter accepts. */
  readonly from: Format;
  /** Destination format this converter produces. */
  readonly to: Format;
  /** Optional human readable name, used in errors and `listConverters()`. */
  readonly name?: string;
  /** Higher wins when several converters share the same `from`/`to` pair. */
  readonly priority?: number;
  /** Perform the conversion. May be async (e.g. dynamic import of a peer dependency). */
  readonly convert: (input: ConvertInput, options: O, ctx: ConvertContext) => string | BinaryInput | Promise<string | BinaryInput>;
}

export interface ConvertOptions {
  /** Options forwarded to the matched converter. */
  readonly converterOptions?: unknown;
  /** Intermediate formats allowed when no direct converter exists. `false` disables chaining. */
  readonly via?: Format[] | false;
  /** Max number of hops when chaining. Default `2`. */
  readonly maxHops?: number;
  /** Cancellation support. */
  readonly signal?: AbortSignal;
  /** Abort (throw) when the input/target pair cannot be converted. Default `true`. */
  readonly strict?: boolean;
}

export interface ConvertResult {
  /** Output payload; text formats yield `string`, binary formats yield `Uint8Array`. */
  readonly data: string | BinaryInput;
  readonly from: Format;
  readonly to: Format;
  /** Converter path actually used, e.g. `['md', 'html', 'text']`. */
  readonly path: readonly Format[];
}

export interface DetectResult {
  readonly format: Format;
  readonly confidence: number;
}

export interface FormatDetector {
  readonly format: Format;
  readonly extensions?: readonly string[];
  readonly mimeTypes?: readonly string[];
  /** Score 0..1 for the given sample; return 0 when the sample is clearly not this format. */
  readonly score: (sample: string) => number;
}
