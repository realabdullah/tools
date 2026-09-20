import { describe, expect, it } from 'vitest';
import { locateSyntaxError, parseJson, positionAt } from '../lib/parse';

const errorOf = (source: string) => {
  const result = parseJson(source);
  if (result.ok) throw new Error(`expected ${source} to be invalid`);
  return result.error;
};

describe('parseJson', () => {
  it('parses ordinary documents', () => {
    expect(parseJson('{"a":1,"b":[true,null]}')).toEqual({
      ok: true,
      value: { a: 1, b: [true, null] },
    });
  });

  it('parses every scalar at the top level', () => {
    expect(parseJson('42')).toEqual({ ok: true, value: 42 });
    expect(parseJson('"x"')).toEqual({ ok: true, value: 'x' });
    expect(parseJson('null')).toEqual({ ok: true, value: null });
    expect(parseJson('true')).toEqual({ ok: true, value: true });
  });

  it('keeps Unicode and escapes intact', () => {
    expect(parseJson('{"name":"Ada Løvelace 🧮","tab":"a\\tb"}')).toEqual({
      ok: true,
      value: { name: 'Ada Løvelace 🧮', tab: 'a\tb' },
    });
  });

  it('accepts deeply nested documents without recursing to death', () => {
    const deep = '['.repeat(2000) + ']'.repeat(2000);
    expect(parseJson(deep).ok).toBe(true);
  });
});

describe('syntax diagnostics', () => {
  it('names a trailing comma and points at the comma', () => {
    const error = errorOf('{\n  "a": 1,\n}');
    expect(error.message).toBe('Trailing comma before "}"');
    expect(error.line).toBe(2);
    expect(error.column).toBe(9);
  });

  it('names a trailing comma in an array', () => {
    expect(errorOf('[1, 2, ]').message).toBe('Trailing comma before "]"');
  });

  it('rejects single quotes with an explanation', () => {
    expect(errorOf("{'a': 1}").message).toBe('Property names must be wrapped in double quotes');
    expect(errorOf("['a']").message).toBe('Strings must be wrapped in double quotes');
  });

  it('rejects unquoted property names', () => {
    expect(errorOf('{a: 1}').message).toBe('Expected a property name in double quotes');
  });

  it('reports a missing colon', () => {
    expect(errorOf('{"a" 1}').message).toBe('Expected ":" after the property name');
  });

  it('reports a missing separator', () => {
    expect(errorOf('{"a":1 "b":2}').message).toBe('Expected "," or "}"');
    expect(errorOf('[1 2]').message).toBe('Expected "," or "]"');
  });

  it('reports an unclosed container at its opening brace', () => {
    const error = errorOf('{"a": {"b": 1}');
    expect(error.message).toMatch(/never closed/);
    expect(error.offset).toBe(0);
  });

  it('reports an unterminated string', () => {
    expect(errorOf('{"a": "oops}').message).toBe('Unterminated string');
  });

  it('rejects comments, which people paste from config files', () => {
    expect(errorOf('{\n  // note\n  "a": 1\n}').message).toBe('Comments are not allowed in JSON');
  });

  it('rejects JavaScript and Python literals by name', () => {
    expect(errorOf('{"a": undefined}').message).toBe('"undefined" is not valid in JSON');
    expect(errorOf('{"a": NaN}').message).toBe('"NaN" is not a valid JSON number');
    expect(errorOf('{"a": None}').message).toBe('Null is written "null"');
    expect(errorOf('{"a": True}').message).toBe('Booleans are written "true" and "false"');
  });

  it('rejects malformed numbers', () => {
    expect(errorOf('{"a": 01}').message).toBe('Numbers cannot have a leading zero');
    expect(errorOf('{"a": 1.}').message).toBe('Expected a digit after the decimal point');
    expect(errorOf('{"a": 1e}').message).toBe('Expected a digit in the exponent');
  });

  it('rejects bad escapes', () => {
    expect(errorOf('"\\q"').message).toBe('Invalid escape "\\q"');
    expect(errorOf('"\\u12"').message).toMatch(/four hex digits/);
  });

  it('reports content after the document ends', () => {
    expect(errorOf('{"a":1} trailing').message).toBe(
      'Unexpected content after the end of the JSON value',
    );
  });

  it('reports an empty document', () => {
    expect(errorOf('   ').message).toBe('Unexpected end of input');
  });

  it('considers valid documents valid', () => {
    expect(locateSyntaxError('{"a": [1, 2, {"b": null}]}')).toBeNull();
    expect(locateSyntaxError('  {"a":1}  ')).toBeNull();
  });
});

describe('positionAt', () => {
  it('converts an offset into a 1-based line and column', () => {
    const source = 'one\ntwo\nthree';
    expect(positionAt(source, 0)).toEqual({ line: 1, column: 1 });
    expect(positionAt(source, 4)).toEqual({ line: 2, column: 1 });
    expect(positionAt(source, 9)).toEqual({ line: 3, column: 2 });
  });

  it('clamps an offset past the end', () => {
    expect(positionAt('ab', 99)).toEqual({ line: 1, column: 3 });
  });
});
