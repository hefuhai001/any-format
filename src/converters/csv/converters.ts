import { parseCsv, rowsToRecords, type CsvParseOptions } from './parse.js';
import { serializeCsv, type CsvSerializeOptions } from './serialize.js';
import type { Converter } from '../../core/types.js';

function toJson(input: string, options: CsvParseOptions): string {
  return JSON.stringify(rowsToRecords(parseCsv(input, options), options), null, 2);
}

export const csvToJsonConverter: Converter<CsvParseOptions> = {
  from: 'csv',
  to: 'json',
  name: 'builtin:csv->json',
  convert: (input, options = {}) => toJson(String(input), options),
};

export const csvToTsv: Converter<CsvParseOptions & CsvSerializeOptions> = {
  from: 'csv',
  to: 'tsv',
  name: 'builtin:csv->tsv',
  convert(input, options = {}) {
    const records = rowsToRecords(parseCsv(String(input), options), options);
    return serializeCsv(records, { ...options, delimiter: '\t' });
  },
};

export const tsvToCsv: Converter<CsvParseOptions & CsvSerializeOptions> = {
  from: 'tsv',
  to: 'csv',
  name: 'builtin:tsv->csv',
  convert(input, options = {}) {
    const records = rowsToRecords(parseCsv(String(input), { ...options, delimiter: '\t' }), options);
    return serializeCsv(records, { ...options, delimiter: ',' });
  },
};

export const tsvToJson: Converter<CsvParseOptions> = {
  from: 'tsv',
  to: 'json',
  name: 'builtin:tsv->json',
  convert: (input, options = {}) => toJson(String(input), { ...options, delimiter: '\t' }),
};

export const csvConverters: Converter<any>[] = [csvToJsonConverter, csvToTsv, tsvToCsv, tsvToJson];
