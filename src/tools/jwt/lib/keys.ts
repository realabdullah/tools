import { decodeToBytes } from '@/tools/base64/lib/base64';
import { importParams, shapeOf, type JwsAlgorithm } from './algorithms';

/**
 * Key material, in whichever form it was pasted.
 *
 * You paste what you have — a shared secret, a PEM block, a JWK — and the
 * format is worked out from its shape rather than asked for in a dropdown.
 */
export type KeyFormat = 'secret' | 'pem' | 'jwk';

export const detectKeyFormat = (material: string): KeyFormat => {
  const trimmed = material.trim();
  if (trimmed.startsWith('{')) return 'jwk';
  if (trimmed.includes('-----BEGIN')) return 'pem';
  return 'secret';
};

export class KeyError extends Error {}

const PEM_BODY = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/;

type PemBlock = { label: string; bytes: Uint8Array<ArrayBuffer> };

const readPem = (material: string): PemBlock => {
  const match = PEM_BODY.exec(material.trim());
  if (!match) throw new KeyError('That PEM block is incomplete — check the BEGIN and END lines');

  const label = match[1] ?? '';
  const decoded = decodeToBytes((match[2] ?? '').replace(/\s+/g, ''));
  if (!decoded.ok) throw new KeyError('The PEM block is not valid Base64');

  return { label, bytes: decoded.bytes };
};

/**
 * WebCrypto cannot import an X.509 certificate, only the key inside one, and
 * pulling that out means walking the DER. Saying so is better than failing
 * with "invalid key data".
 */
const assertImportable = (label: string, usage: 'verify' | 'sign'): void => {
  if (label.includes('CERTIFICATE')) {
    throw new KeyError('Certificates are not supported — paste the public key it contains');
  }
  if (usage === 'verify' && label.includes('PRIVATE')) {
    throw new KeyError('That is a private key — verifying needs the public key');
  }
  if (usage === 'sign' && label.includes('PUBLIC')) {
    throw new KeyError('That is a public key — signing needs the private key');
  }
  if (label.includes('RSA PRIVATE KEY') || label.includes('RSA PUBLIC KEY')) {
    throw new KeyError('PKCS#1 keys are not supported — convert to PKCS#8 or SPKI');
  }
};

const asJwk = (material: string): JsonWebKey => {
  try {
    return JSON.parse(material) as JsonWebKey;
  } catch {
    throw new KeyError('That JWK is not valid JSON');
  }
};

/**
 * Turns pasted key material into a CryptoKey.
 *
 * `usage` decides which half of an asymmetric pair is expected, so the error
 * can say "that is a private key" rather than something about DER.
 */
export const importKey = async (
  material: string,
  algorithm: JwsAlgorithm,
  usage: 'verify' | 'sign',
): Promise<CryptoKey> => {
  const format = detectKeyFormat(material);
  const params = importParams(algorithm);

  if (shapeOf(algorithm) === 'secret') {
    if (format !== 'secret') {
      throw new KeyError(`${algorithm} uses a shared secret, not a key file`);
    }
    return crypto.subtle.importKey('raw', new TextEncoder().encode(material), params, false, [
      usage,
    ]);
  }

  if (format === 'secret') {
    throw new KeyError(`${algorithm} needs a PEM or JWK key, not a shared secret`);
  }

  try {
    if (format === 'jwk') {
      const jwk = asJwk(material);
      return await crypto.subtle.importKey('jwk', jwk, params, false, [usage]);
    }

    const { label, bytes } = readPem(material);
    assertImportable(label, usage);
    return await crypto.subtle.importKey(
      usage === 'sign' ? 'pkcs8' : 'spki',
      bytes,
      params,
      false,
      [usage],
    );
  } catch (error) {
    if (error instanceof KeyError) throw error;
    throw new KeyError(
      `That key could not be read as ${algorithm} material — check it matches the token's algorithm`,
    );
  }
};

/** A shared secret given as Base64URL rather than as literal characters. */
export const importBase64Secret = async (
  material: string,
  algorithm: JwsAlgorithm,
  usage: 'verify' | 'sign',
): Promise<CryptoKey> => {
  const decoded = decodeToBytes(material.trim());
  if (!decoded.ok) throw new KeyError('That secret is not valid Base64');

  return crypto.subtle.importKey('raw', decoded.bytes, importParams(algorithm), false, [usage]);
};
