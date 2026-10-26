import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConversionError,
  InvalidInputError,
  UnsupportedConversionError,
  isConversionError,
} from '../../src/core/errors.js';

describe('ConversionError', () => {
  it('exposes code, name and cause', () => {
    const cause = new Error('underlying');
    const error = new ConversionError('failed', 'CONVERTER_FAILED', { cause });

    assert.equal(error.name, 'ConversionError');
    assert.equal(error.code, 'CONVERTER_FAILED');
    assert.equal(error.message, 'failed');
    assert.equal(error.cause, cause);
    assert.ok(error instanceof Error);
  });

  it('works without a cause', () => {
    const error = new ConversionError('nope', 'ABORTED');
    assert.equal(error.cause, undefined);
  });
});

describe('InvalidInputError', () => {
  it('uses the INVALID_INPUT code', () => {
    const error = new InvalidInputError('bad payload');
    assert.equal(error.code, 'INVALID_INPUT');
    assert.equal(error.name, 'InvalidInputError');
    assert.equal(error.message, 'bad payload');
  });
});

describe('UnsupportedConversionError', () => {
  it('mentions the options when a via filter was supplied', () => {
    const error = new UnsupportedConversionError('a', 'b', 'no path through the allowed intermediate formats');
    assert.match(error.message, /allowed intermediate formats/);
  });

  it('is a ConversionError', () => {
    assert.ok(new UnsupportedConversionError('a', 'b') instanceof ConversionError);
  });
});

describe('isConversionError', () => {
  it('narrows library errors', () => {
    assert.equal(isConversionError(new ConversionError('x', 'ABORTED')), true);
    assert.equal(isConversionError(new UnsupportedConversionError('a', 'b')), true);
    assert.equal(isConversionError(new InvalidInputError('x')), true);
  });

  it('rejects foreign values', () => {
    assert.equal(isConversionError(new Error('x')), false);
    assert.equal(isConversionError('x'), false);
    assert.equal(isConversionError(null), false);
    assert.equal(isConversionError(undefined), false);
  });
});
