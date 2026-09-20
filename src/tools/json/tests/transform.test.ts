import { describe, expect, it } from 'vitest';
import { sortKeys, unwrapEncoded } from '../lib/transform';

describe('sortKeys', () => {
  it('orders object keys alphabetically, at every level', () => {
    const sorted = sortKeys({ zebra: 1, alpha: { nested: true, beta: 2 } });
    expect(JSON.stringify(sorted)).toBe('{"alpha":{"beta":2,"nested":true},"zebra":1}');
  });

  it('leaves array order alone, because there it is data', () => {
    expect(sortKeys([3, 1, 2])).toEqual([3, 1, 2]);
    expect(sortKeys({ list: [{ b: 1, a: 2 }] })).toEqual({ list: [{ a: 2, b: 1 }] });
  });

  it('passes primitives through untouched', () => {
    expect(sortKeys('x')).toBe('x');
    expect(sortKeys(null)).toBeNull();
  });
});

describe('unwrapEncoded', () => {
  it('parses a document that is a JSON string containing JSON', () => {
    expect(unwrapEncoded('{"a":1}')).toEqual({ a: 1 });
    expect(unwrapEncoded('  [1,2] ')).toEqual([1, 2]);
  });

  it('leaves an ordinary string alone', () => {
    expect(unwrapEncoded('hello')).toBeNull();
    expect(unwrapEncoded('{not json')).toBeNull();
  });

  it('has nothing to unwrap in a document that is already structured', () => {
    expect(unwrapEncoded({ a: 1 })).toBeNull();
    expect(unwrapEncoded(42)).toBeNull();
  });
});
