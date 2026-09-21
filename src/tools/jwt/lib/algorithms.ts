/**
 * The JWS algorithms this tool can actually do, mapped onto WebCrypto.
 *
 * Everything here runs in the browser: verifying a token never sends it
 * anywhere, and neither does signing one.
 */

export type JwsAlgorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'EdDSA';

export const SUPPORTED_ALGORITHMS: readonly JwsAlgorithm[] = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA',
];

export type KeyShape = 'secret' | 'asymmetric';

export const shapeOf = (algorithm: JwsAlgorithm): KeyShape =>
  algorithm.startsWith('HS') ? 'secret' : 'asymmetric';

export const isSupported = (algorithm: string): algorithm is JwsAlgorithm =>
  (SUPPORTED_ALGORITHMS as readonly string[]).includes(algorithm);

const hashFor = (algorithm: JwsAlgorithm): string => `SHA-${algorithm.slice(2)}`;

/** The `importKey` parameters for an algorithm. */
export const importParams = (
  algorithm: JwsAlgorithm,
): AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams => {
  if (algorithm === 'EdDSA') return { name: 'Ed25519' };
  if (algorithm.startsWith('HS')) return { name: 'HMAC', hash: hashFor(algorithm) };
  if (algorithm.startsWith('RS')) return { name: 'RSASSA-PKCS1-v1_5', hash: hashFor(algorithm) };
  if (algorithm.startsWith('PS')) return { name: 'RSA-PSS', hash: hashFor(algorithm) };

  // ES512 is P-521, not P-512 — the number in the name is the hash, not the curve.
  const curve = algorithm === 'ES256' ? 'P-256' : algorithm === 'ES384' ? 'P-384' : 'P-521';
  return { name: 'ECDSA', namedCurve: curve };
};

/** The `sign`/`verify` parameters, which differ from the import ones. */
export const operationParams = (
  algorithm: JwsAlgorithm,
): AlgorithmIdentifier | RsaPssParams | EcdsaParams => {
  if (algorithm === 'EdDSA') return { name: 'Ed25519' };
  if (algorithm.startsWith('HS')) return { name: 'HMAC' };
  if (algorithm.startsWith('RS')) return { name: 'RSASSA-PKCS1-v1_5' };
  // PSS salt length matches the hash length, which is what JWA mandates.
  if (algorithm.startsWith('PS')) {
    return { name: 'RSA-PSS', saltLength: Number(algorithm.slice(2)) / 8 };
  }
  return { name: 'ECDSA', hash: hashFor(algorithm) };
};
