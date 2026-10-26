import { ConversionError, InvalidInputError } from '../core/errors.js';
import type { ConvertInput } from '../core/types.js';

/**
 * Dynamically import an optional peer dependency. Adapters stay out of the
 * core bundle; nothing is loaded until a conversion actually needs it.
 */
export async function optionalImport<T = any>(specifier: string, hint?: string): Promise<T> {
  try {
    return (await import(/* @vite-ignore */ specifier)) as T;
  } catch (error) {
    const message =
      `Missing optional dependency "${specifier}", required for this conversion. ` +
      `Install it with \`npm i ${specifier}\`${hint ? ` — ${hint}` : ''}.`;
    throw new ConversionError(message, 'CONVERTER_FAILED', { cause: error });
  }
}

/** Normalize binary converter output/input, validating the shape. */
export function asBuffer(input: ConvertInput, format: string): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  throw new InvalidInputError(
    `"${format}" conversions require binary input (Buffer/Uint8Array); received ${typeof input}. ` +
      'Read the file with fs.readFile() instead of fs.readFile(path, "utf8").',
  );
}

/** Ensure a converter produced text before handing it to a text-based step. */
export function asText(value: unknown, format: string): string {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  throw new ConversionError(`Converter output for "${format}" is not textual`, 'CONVERTER_FAILED');
}
