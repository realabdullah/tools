import { describe, expect, it } from 'vitest';
import { tokenizeJson } from '../json-tokens';

const render = (source: string) =>
  tokenizeJson(source)
    .map((token) => token.value)
    .join('');

describe('tokenizeJson', () => {
  it('never loses or alters characters', () => {
    const source = JSON.stringify({ a: 1, b: [true, null, 'x'], 'c d': -1.5e10 }, null, 2);
    expect(render(source)).toBe(source);
  });

  it('separates keys from string values', () => {
    const tokens = tokenizeJson('{"name": "Ada"}');
    expect(tokens.find((token) => token.value === '"name"')?.type).toBe('key');
    expect(tokens.find((token) => token.value === '"Ada"')?.type).toBe('string');
  });

  it('round-trips markup inside values without altering it', () => {
    const source = JSON.stringify({ x: '<script>alert(1)</script>' }, null, 2);
    expect(render(source)).toBe(source);
  });

  it('handles escaped quotes inside strings', () => {
    const source = '{"q": "he said \\"hi\\""}';
    expect(render(source)).toBe(source);
  });
});
