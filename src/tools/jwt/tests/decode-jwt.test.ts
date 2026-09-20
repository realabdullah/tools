import { describe, expect, it } from 'vitest';
import { encodeText } from '@/tools/base64/lib/base64';
import { inspectJwt, looksLikeJwt, normaliseToken } from '../lib/decode-jwt';

const seg = (value: unknown) => encodeText(JSON.stringify(value), 'url');
const token = (header: unknown, payload: unknown, signature = 'c2ln') =>
  `${seg(header)}.${seg(payload)}.${signature}`;

const HS256 = { alg: 'HS256', typ: 'JWT' };

describe('inspectJwt', () => {
  it('decodes header and payload of an ordinary token', () => {
    const result = inspectJwt(token(HS256, { sub: '1234567890', name: 'Ada', iat: 1516239022 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.jwt.header.value).toEqual(HS256);
    expect(result.jwt.payload.value).toMatchObject({ sub: '1234567890', name: 'Ada' });
    expect(result.jwt.algorithm).toBe('HS256');
    expect(result.jwt.signature).toBe('c2ln');
    expect(result.jwt.errors).toEqual([]);
  });

  it('pretty-prints the decoded segments', () => {
    const result = inspectJwt(token(HS256, { a: 1 }));
    expect(result.ok && result.jwt.payload.text).toBe('{\n  "a": 1\n}');
  });

  it('handles Unicode payloads', () => {
    const result = inspectJwt(token(HS256, { name: 'Ada Løvelace 🧮', city: '東京' }));
    expect(result.ok && result.jwt.payload.value).toMatchObject({
      name: 'Ada Løvelace 🧮',
      city: '東京',
    });
  });

  it('accepts a pasted Authorization header value', () => {
    expect(normaliseToken('  Bearer  abc.def.ghi ')).toBe('abc.def.ghi');
    expect(inspectJwt(`Bearer ${token(HS256, { a: 1 })}`).ok).toBe(true);
  });

  it('accepts Base64URL segments that need padding', () => {
    // "{"a":"bcde"}" encodes to a length that is not a multiple of four.
    const result = inspectJwt(token(HS256, { a: 'bcde' }));
    expect(result.ok && result.jwt.payload.value).toEqual({ a: 'bcde' });
  });

  it('rejects input that is not three segments', () => {
    expect(inspectJwt('notatoken')).toMatchObject({ ok: false });
    expect(inspectJwt('a.b.c.d.e')).toMatchObject({ ok: false });
  });

  it('rejects empty input with a prompt rather than an error', () => {
    expect(inspectJwt('   ')).toMatchObject({ ok: false, errors: ['Paste a token to inspect it'] });
  });

  it('reads a token whose signature segment is missing', () => {
    const result = inspectJwt(`${seg(HS256)}.${seg({ a: 1 })}`);
    expect(result.ok).toBe(true);
    expect(result.ok && result.jwt.warnings).toContain('The token has no signature segment');
  });

  it('flags an unsecured alg "none" token', () => {
    const result = inspectJwt(`${seg({ alg: 'none' })}.${seg({ a: 1 })}.`);
    expect(result.ok && result.jwt.unsecured).toBe(true);
    expect(result.ok && result.jwt.warnings).toContain(
      'Header declares alg "none" — this token is unsigned',
    );
  });

  it('surfaces a payload that is not valid Base64URL', () => {
    const result = inspectJwt(`${seg(HS256)}.****.sig`);
    expect(result.ok).toBe(true);
    expect(result.ok && result.jwt.payload.error).toMatch(/not valid Base64URL/);
  });

  it('surfaces a payload that is not JSON, keeping the decoded text', () => {
    const result = inspectJwt(`${seg(HS256)}.${encodeText('plain text', 'url')}.sig`);
    expect(result.ok && result.jwt.payload.error).toBe('The payload is not valid JSON');
    expect(result.ok && result.jwt.payload.text).toBe('plain text');
  });

  it('surfaces a payload that is JSON but not an object', () => {
    const result = inspectJwt(`${seg(HS256)}.${encodeText('[1,2]', 'url')}.sig`);
    expect(result.ok && result.jwt.payload.error).toMatch(/an array/);
  });

  it('keeps reading the payload when the header is broken', () => {
    const result = inspectJwt(`${encodeText('nope', 'url')}.${seg({ a: 1 })}.sig`);
    expect(result.ok && result.jwt.header.error).toBe('The header is not valid JSON');
    expect(result.ok && result.jwt.payload.value).toEqual({ a: 1 });
  });
});

describe('looksLikeJwt', () => {
  it('matches token-shaped strings only', () => {
    expect(looksLikeJwt(token(HS256, { a: 1 }))).toBe(true);
    expect(looksLikeJwt('Bearer ' + token(HS256, { a: 1 }))).toBe(true);
    expect(looksLikeJwt('hello.world')).toBe(false);
    expect(looksLikeJwt('a.b.c.d')).toBe(false);
    // Would otherwise be token-shaped: three Base64URL-legal segments.
    expect(looksLikeJwt('file.name.txt')).toBe(false);
  });
});
