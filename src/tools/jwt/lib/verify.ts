import { decodeToBytes, encodeBytes, encodeText } from '@/tools/base64/lib/base64';
import { isSupported, operationParams, shapeOf, type JwsAlgorithm } from './algorithms';
import { importBase64Secret, importKey, KeyError } from './keys';
import { normaliseToken } from './decode-jwt';

/**
 * Signature verification, in the browser.
 *
 * The earlier version of this workspace said "decoding is not verification"
 * and stopped there, which is true but unhelpful: WebCrypto can check every
 * algorithm in common use without the token leaving the tab. The disclaimer
 * belongs on the *unverified* state, not on the whole tool.
 */

export type VerificationStatus =
  'idle' | 'verified' | 'mismatch' | 'unsupported' | 'error' | 'unsigned';

export type Verification = {
  status: VerificationStatus;
  message: string;
};

export type SecretEncoding = 'utf-8' | 'base64url';

const IDLE: Verification = { status: 'idle', message: 'Add a key to check the signature' };

export const verifySignature = async (
  token: string,
  algorithm: string | null,
  keyMaterial: string,
  secretEncoding: SecretEncoding = 'utf-8',
): Promise<Verification> => {
  if (keyMaterial.trim() === '') return IDLE;

  if (algorithm === null) {
    return { status: 'error', message: 'The header has no "alg", so there is nothing to check' };
  }
  if (algorithm.toLowerCase() === 'none') {
    return { status: 'unsigned', message: 'alg is "none" — this token carries no signature' };
  }
  if (!isSupported(algorithm)) {
    return { status: 'unsupported', message: `${algorithm} is not supported here` };
  }

  const parts = normaliseToken(token).split('.');
  const [header, payload, signature] = parts;
  if (parts.length !== 3 || !header || !payload || !signature) {
    return { status: 'error', message: 'A signature needs all three segments' };
  }

  const signatureBytes = decodeToBytes(signature);
  if (!signatureBytes.ok) {
    return { status: 'error', message: 'The signature is not valid Base64URL' };
  }

  try {
    const key =
      shapeOf(algorithm) === 'secret' && secretEncoding === 'base64url'
        ? await importBase64Secret(keyMaterial, algorithm, 'verify')
        : await importKey(keyMaterial, algorithm, 'verify');

    const ok = await crypto.subtle.verify(
      operationParams(algorithm),
      key,
      signatureBytes.bytes,
      new TextEncoder().encode(`${header}.${payload}`),
    );

    return ok
      ? { status: 'verified', message: 'Signature verified' }
      : { status: 'mismatch', message: 'Signature does not match this key' };
  } catch (error) {
    if (error instanceof KeyError) return { status: 'error', message: error.message };
    // A browser without Ed25519 rejects the import rather than the signature.
    if (algorithm === 'EdDSA') {
      return { status: 'unsupported', message: 'This browser cannot do Ed25519' };
    }
    return { status: 'error', message: 'That key could not be used to verify this token' };
  }
};

export type SignResult = { ok: true; token: string } | { ok: false; message: string };

/** Builds and signs a token from a header and payload. */
export const signToken = async (
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  algorithm: JwsAlgorithm,
  keyMaterial: string,
  secretEncoding: SecretEncoding = 'utf-8',
): Promise<SignResult> => {
  const signingInput = `${encodeText(JSON.stringify(header), 'url')}.${encodeText(
    JSON.stringify(payload),
    'url',
  )}`;

  if (keyMaterial.trim() === '') return { ok: false, message: 'Add a key to sign with' };

  try {
    const key =
      shapeOf(algorithm) === 'secret' && secretEncoding === 'base64url'
        ? await importBase64Secret(keyMaterial, algorithm, 'sign')
        : await importKey(keyMaterial, algorithm, 'sign');

    const signature = await crypto.subtle.sign(
      operationParams(algorithm),
      key,
      new TextEncoder().encode(signingInput),
    );

    return { ok: true, token: `${signingInput}.${encodeBytes(new Uint8Array(signature), 'url')}` };
  } catch (error) {
    if (error instanceof KeyError) return { ok: false, message: error.message };
    return { ok: false, message: `Could not sign with this ${algorithm} key` };
  }
};

/** Generates a key pair (or secret) for trying things out. */
export const generateKey = async (
  algorithm: JwsAlgorithm,
): Promise<{ sign: string; verify: string }> => {
  if (shapeOf(algorithm) === 'secret') {
    const secret = encodeBytes(crypto.getRandomValues(new Uint8Array(32)), 'url');
    return { sign: secret, verify: secret };
  }

  const pair = (await crypto.subtle.generateKey(generationParams(algorithm), true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;

  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);

  return {
    sign: JSON.stringify(privateJwk, null, 2),
    verify: JSON.stringify(publicJwk, null, 2),
  };
};

/** Generation needs the modulus length and exponent that import does not. */
const generationParams = (
  algorithm: JwsAlgorithm,
): RsaHashedKeyGenParams | EcKeyGenParams | AlgorithmIdentifier => {
  if (algorithm === 'EdDSA') return { name: 'Ed25519' };
  if (algorithm.startsWith('ES')) {
    const curve = algorithm === 'ES256' ? 'P-256' : algorithm === 'ES384' ? 'P-384' : 'P-521';
    return { name: 'ECDSA', namedCurve: curve };
  }
  return {
    name: algorithm.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: `SHA-${algorithm.slice(2)}`,
  };
};
