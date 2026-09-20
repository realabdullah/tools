import { describe, expect, it } from 'vitest';
import { byteLength, formatBytes } from '../bytes';

describe('byteLength', () => {
  it('counts UTF-8 bytes, not code units', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('é')).toBe(2);
    expect(byteLength('🚀')).toBe(4);
  });
});

describe('formatBytes', () => {
  it('scales to a readable unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5_242_880)).toBe('5.0 MB');
  });
});
