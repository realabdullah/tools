import { describe, expect, it } from 'vitest';
import { decodeToBytes, encodeBytes } from '../lib/base64';
import {
  decodeToFile,
  extensionFor,
  parseDataUri,
  sniffMediaType,
  toDataUri,
  wrapLines,
} from '../lib/files';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('wrapLines', () => {
  it('splits at the given width', () => {
    expect(wrapLines('abcdefgh', 3)).toBe('abc\ndef\ngh');
  });

  it('leaves short input alone', () => {
    expect(wrapLines('abc', 76)).toBe('abc');
    expect(wrapLines('abc', 0)).toBe('abc');
  });

  it('rejoins to exactly the original', () => {
    const value = encodeBytes(bytes(...Array.from({ length: 200 }, (_, i) => i % 256)));
    expect(wrapLines(value, 76).split('\n').join('')).toBe(value);
  });
});

describe('data URIs', () => {
  const png = { name: 'a.png', type: 'image/png', size: 4, bytes: bytes(0x89, 0x50, 0x4e, 0x47) };

  it('builds one from a file', () => {
    expect(toDataUri(png)).toBe(`data:image/png;base64,${encodeBytes(png.bytes)}`);
  });

  it('reads one back', () => {
    expect(parseDataUri('data:image/png;base64,iVBOR')).toEqual({
      mediaType: 'image/png',
      base64: 'iVBOR',
    });
  });

  it('keeps a media type with parameters', () => {
    expect(parseDataUri('data:text/plain;charset=utf-8;base64,aGk=')).toMatchObject({
      mediaType: 'text/plain',
      base64: 'aGk=',
    });
  });

  it('defaults a missing media type', () => {
    expect(parseDataUri('data:;base64,aGk=')?.mediaType).toBe('application/octet-stream');
  });

  it('is null for anything that is not a base64 data URI', () => {
    expect(parseDataUri('data:text/plain,hello')).toBeNull();
    expect(parseDataUri('aGVsbG8=')).toBeNull();
    expect(parseDataUri('https://example.com')).toBeNull();
  });

  it('round-trips a file through a data URI', () => {
    const decoded = decodeToFile(toDataUri(png));
    expect(decoded?.mediaType).toBe('image/png');
    expect(decoded?.bytes).toEqual(png.bytes);
  });
});

describe('decodeToFile', () => {
  it('accepts bare Base64 as well as a data URI', () => {
    const expected = decodeToBytes('aGVsbG8=');
    expect(expected.ok).toBe(true);

    const decoded = decodeToFile('aGVsbG8=');
    expect(decoded?.mediaType).toBe('application/octet-stream');
    expect(decoded?.bytes).toEqual(expected.ok ? expected.bytes : null);
  });

  it('is null for input that is not Base64', () => {
    expect(decodeToFile('not base64!!')).toBeNull();
  });
});

describe('sniffMediaType', () => {
  it('recognises the formats worth naming', () => {
    expect(sniffMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d))).toBe('image/png');
    expect(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMediaType(bytes(0x47, 0x49, 0x46, 0x38, 0x39))).toBe('image/gif');
    expect(sniffMediaType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf');
    expect(sniffMediaType(bytes(0x50, 0x4b, 0x03, 0x04))).toBe('application/zip');
  });

  it('recognises WEBP inside a RIFF container', () => {
    const webp = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(sniffMediaType(webp)).toBe('image/webp');
  });

  it('says nothing about bytes it does not recognise', () => {
    expect(sniffMediaType(bytes(1, 2, 3, 4))).toBeNull();
    expect(sniffMediaType(bytes())).toBeNull();
  });
});

describe('extensionFor', () => {
  it('maps known types and falls back to bin', () => {
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('application/x-unknown')).toBe('bin');
  });
});
