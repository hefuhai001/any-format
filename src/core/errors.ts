import type { Format } from './types.js';

export type ErrorCode =
  | 'UNSUPPORTED_CONVERSION'
  | 'CONVERTER_FAILED'
  | 'INVALID_INPUT'
  | 'ABORTED';

/** Base error for every failure thrown by this library. */
export class ConversionError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ConversionError';
    this.code = code;
  }
}

export class UnsupportedConversionError extends ConversionError {
  readonly from: Format;
  readonly to: Format;

  constructor(from: Format, to: Format, detail?: string) {
    super(
      `Cannot convert "${from}" to "${to}"${detail ? `: ${detail}` : ''}. ` +
        `Use listConverters() to inspect registered paths, or registerConverter() to add one.`,
      'UNSUPPORTED_CONVERSION',
    );
    this.name = 'UnsupportedConversionError';
    this.from = from;
    this.to = to;
  }
}

export class InvalidInputError extends ConversionError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 'INVALID_INPUT', options);
    this.name = 'InvalidInputError';
  }
}

export function isConversionError(error: unknown): error is ConversionError {
  return error instanceof ConversionError;
}
