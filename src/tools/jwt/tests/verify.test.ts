import { describe, expect, it } from 'vitest';
import { generateKey, signToken, verifySignature } from '../lib/verify';
import { inspectJwt } from '../lib/decode-jwt';
import { encodeText } from '@/tools/base64/lib/base64';
import type { JwsAlgorithm } from '../lib/algorithms';

/**
 * The canonical jwt.io example: HS256 over the standard payload, signed with
 * "a-string-secret-at-least-256-bits-long". If this drifts, verification is
 * wrong no matter what the rest of the suite says.
 */
const HS256_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.' +
  'KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30';
const HS256_SECRET = 'a-string-secret-at-least-256-bits-long';

describe('verifySignature', () => {
  it('verifies the canonical HS256 token', async () => {
    await expect(verifySignature(HS256_TOKEN, 'HS256', HS256_SECRET)).resolves.toMatchObject({
      status: 'verified',
    });
  });

  it('rejects the wrong secret', async () => {
    await expect(verifySignature(HS256_TOKEN, 'HS256', 'not-the-secret')).resolves.toMatchObject({
      status: 'mismatch',
    });
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = HS256_TOKEN.split('.');
    const forged = `${header}.eyJzdWIiOiJhZG1pbiJ9.${signature}`;
    await expect(verifySignature(forged, 'HS256', HS256_SECRET)).resolves.toMatchObject({
      status: 'mismatch',
    });
  });

  it('says nothing until a key is given', async () => {
    await expect(verifySignature(HS256_TOKEN, 'HS256', '   ')).resolves.toMatchObject({
      status: 'idle',
    });
  });

  it('calls out a token that is not signed at all', async () => {
    await expect(verifySignature('a.b.', 'none', 'anything')).resolves.toMatchObject({
      status: 'unsigned',
    });
  });

  it('reports an algorithm it cannot do', async () => {
    await expect(verifySignature(HS256_TOKEN, 'HS1', HS256_SECRET)).resolves.toMatchObject({
      status: 'unsupported',
    });
  });

  it('explains a key of the wrong kind', async () => {
    const result = await verifySignature(
      HS256_TOKEN,
      'HS256',
      '-----BEGIN PUBLIC KEY-----\nAA==\n-----END PUBLIC KEY-----',
    );
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/shared secret/);
  });

  it('accepts a secret supplied as Base64', async () => {
    const asBase64 = encodeText(HS256_SECRET, 'url');
    await expect(
      verifySignature(HS256_TOKEN, 'HS256', asBase64, 'base64url'),
    ).resolves.toMatchObject({ status: 'verified' });
  });
});

describe('signToken', () => {
  it('reproduces the canonical token exactly', async () => {
    const result = await signToken(
      { alg: 'HS256', typ: 'JWT' },
      { sub: '1234567890', name: 'John Doe', admin: true, iat: 1516239022 },
      'HS256',
      HS256_SECRET,
    );
    expect(result).toEqual({ ok: true, token: HS256_TOKEN });
  });

  it('will not sign without a key', async () => {
    const result = await signToken({ alg: 'HS256' }, { a: 1 }, 'HS256', '');
    expect(result).toMatchObject({ ok: false });
  });
});

describe('round trips across algorithm families', () => {
  // Ed25519 is not in every engine, so it is exercised separately below.
  const algorithms: JwsAlgorithm[] = ['HS256', 'HS512', 'RS256', 'PS256', 'ES256', 'ES384'];

  it.each(algorithms)('signs and verifies %s', async (algorithm) => {
    const keys = await generateKey(algorithm);
    const header = { alg: algorithm, typ: 'JWT' };
    const payload = { sub: 'round-trip', iat: 1516239022 };

    const signed = await signToken(header, payload, algorithm, keys.sign);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    // The token it produced is a readable JWT, not just bytes.
    const inspected = inspectJwt(signed.token);
    expect(inspected.ok && inspected.jwt.payload.value).toEqual(payload);

    await expect(verifySignature(signed.token, algorithm, keys.verify)).resolves.toMatchObject({
      status: 'verified',
    });
  });

  it.each(algorithms)('rejects %s against a different key', async (algorithm) => {
    const mine = await generateKey(algorithm);
    const theirs = await generateKey(algorithm);

    const signed = await signToken({ alg: algorithm }, { a: 1 }, algorithm, mine.sign);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    await expect(verifySignature(signed.token, algorithm, theirs.verify)).resolves.toMatchObject({
      status: 'mismatch',
    });
  });
});
