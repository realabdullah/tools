import { describe, expect, it } from 'vitest';
import {
  decodeText,
  decodeToBytes,
  encodeText,
  looksLikeBase64,
  usesUrlAlphabet,
} from '../lib/base64';

describe('encodeText', () => {
  it('encodes ASCII', () => {
    expect(encodeText('hello')).toBe('aGVsbG8=');
  });

  it('round-trips an empty string', () => {
    expect(encodeText('')).toBe('');
    expect(decodeText('')).toEqual({ ok: true, value: '' });
  });

  it('encodes multi-byte UTF-8 rather than mangling it', () => {
    expect(encodeText('héllo wörld')).toBe('aMOpbGxvIHfDtnJsZA==');
    expect(encodeText('日本語')).toBe('5pel5pys6Kqe');
  });

  it('encodes emoji built from surrogate pairs', () => {
    const encoded = encodeText('🚀 ship it 👩‍💻');
    expect(decodeText(encoded)).toEqual({ ok: true, value: '🚀 ship it 👩‍💻' });
  });

  it('produces unpadded Base64URL on request', () => {
    const text = 'subjects?=/+~';
    expect(encodeText(text)).toBe('c3ViamVjdHM/PS8rfg==');
    expect(encodeText(text, 'url')).toBe('c3ViamVjdHM_PS8rfg');
  });

  it('handles input larger than one encoding chunk', () => {
    const text = 'ü'.repeat(60_000);
    expect(decodeText(encodeText(text))).toEqual({ ok: true, value: text });
  });
});

describe('decodeText', () => {
  it('decodes standard Base64', () => {
    expect(decodeText('aGVsbG8=')).toEqual({ ok: true, value: 'hello' });
  });

  it('accepts the URL-safe alphabet and missing padding', () => {
    expect(decodeText('c3ViamVjdHM_PS8rfg')).toEqual({ ok: true, value: 'subjects?=/+~' });
  });

  it('ignores whitespace and line breaks, as pasted from a terminal', () => {
    expect(decodeText('aGVs\nbG8 =')).toEqual({ ok: true, value: 'hello' });
  });

  it('reports characters outside the alphabet', () => {
    const result = decodeText('aGVsbG8*');
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'invalid-characters' });
  });

  it('reports a truncated group', () => {
    expect(decodeText('aGVsbG8AA')).toMatchObject({ ok: false, code: 'invalid-length' });
  });

  it('reports padding that appears mid-string', () => {
    expect(decodeText('aGVsbG8=A')).toMatchObject({ ok: false, code: 'invalid-characters' });
  });

  it('reports bytes that are not valid UTF-8', () => {
    // 0xFF is never a legal UTF-8 lead byte.
    expect(decodeText('/w==')).toMatchObject({ ok: false, code: 'not-utf8' });
  });

  it('still returns those bytes through the byte-level API', () => {
    expect(decodeToBytes('/w==')).toEqual({ ok: true, bytes: new Uint8Array([0xff]) });
  });
});

describe('detection helpers', () => {
  it('recognises plausible Base64 and rejects prose', () => {
    expect(looksLikeBase64('aGVsbG8gd29ybGQ=')).toBe(true);
    expect(looksLikeBase64('hello world!')).toBe(false);
    expect(looksLikeBase64('abc')).toBe(false);
  });

  it('spots the URL-safe alphabet', () => {
    expect(usesUrlAlphabet('a-b_c')).toBe(true);
    expect(usesUrlAlphabet('aGVsbG8=')).toBe(false);
  });
});
