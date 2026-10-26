import { ConversionError, InvalidInputError } from './errors.js';
import { assertPath, normalizeFormat, type ConverterRegistry } from './registry.js';
import type { ConvertContext, ConvertInput, ConvertOptions, ConvertResult, Format } from './types.js';

const DEFAULT_MAX_HOPS = 2;

export async function runConversion(
  registry: ConverterRegistry,
  input: ConvertInput,
  from: Format,
  to: Format,
  options: ConvertOptions = {},
): Promise<ConvertResult> {
  assertInput(input);

  const source = normalizeFormat(from);
  const target = normalizeFormat(to);
  const path = assertPath(registry, source, target, { via: options.via, maxHops: options.maxHops ?? DEFAULT_MAX_HOPS });

  let current: ConvertInput = input;

  for (let index = 0; index < path.length - 1; index += 1) {
    const stepFrom = path[index]!;
    const stepTo = path[index + 1]!;
    const converter = registry.find(stepFrom, stepTo);
    if (!converter) {
      // Path came from the registry, so this only happens if it changed mid-flight.
      throw new ConversionError(`Converter "${stepFrom}->${stepTo}" disappeared during conversion`, 'UNSUPPORTED_CONVERSION');
    }

    const ctx: ConvertContext = {
      from: stepFrom,
      target,
      signal: options.signal,
      throwIfAborted: () => {
        if (options.signal?.aborted) {
          throw new ConversionError(`Conversion to "${target}" aborted`, 'ABORTED', { cause: options.signal.reason });
        }
      },
    };

    ctx.throwIfAborted();

    try {
      current = await converter.convert(current, options.converterOptions, ctx);
    } catch (error) {
      if (error instanceof ConversionError) throw error;
      throw new ConversionError(
        `Converter "${converter.name ?? `${stepFrom}->${stepTo}`}" failed: ${error instanceof Error ? error.message : String(error)}`,
        'CONVERTER_FAILED',
        { cause: error },
      );
    }

    assertInput(current);
  }

  return { data: current, from: source, to: target, path };
}

export function canConvert(registry: ConverterRegistry, from: Format, to: Format, options?: { via?: Format[] | false; maxHops?: number }): boolean {
  return registry.findPath(from, to, options) !== undefined;
}

function assertInput(input: unknown): asserts input is ConvertInput {
  const ok = typeof input === 'string' || input instanceof Uint8Array;
  if (!ok) {
    throw new InvalidInputError(
      `Input must be a string or Uint8Array, received ${input === null ? 'null' : typeof input}`,
    );
  }
}
