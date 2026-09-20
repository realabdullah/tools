/**
 * Base64 transformation core.
 *
 * Pure functions over strings; no DOM beyond `atob`/`btoa` and the encoding
 * APIs, which exist in every target and in jsdom. Failures are returned, never
 * thrown: both directions of the workspace render errors inline.
 */

export type Base64Variant = 'standard' | 'url';

export type Base64ErrorCode = 'invalid-characters' | 'invalid-length' | 'not-utf8';

export type DecodeResult =
  { ok: true; value: string } | { ok: false; code: Base64ErrorCode; message: string };

const CHUNK = 0x8000;

const binaryFromBytes = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return binary;
};

const toUrlAlphabet = (value: string): string =>
  value.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/** UTF-8 text -> Base64. `url` produces unpadded Base64URL (RFC 4648 §5). */
export const encodeText = (text: string, variant: Base64Variant = 'standard'): string => {
  if (text === '') return '';
  const standard = btoa(binaryFromBytes(new TextEncoder().encode(text)));
  return variant === 'url' ? toUrlAlphabet(standard) : standard;
};

/** Strips whitespace and normalises Base64URL to the standard alphabet. */
const normalise = (value: string): string =>
  value.replace(/\s+/g, '').replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/, '');

const BASE64_BODY = /^[A-Za-z0-9+/]*$/;

/** Base64 or Base64URL -> bytes. Padding is optional; whitespace is ignored. */
export const decodeToBytes = (
  value: string,
): { ok: true; bytes: Uint8Array } | { ok: false; code: Base64ErrorCode; message: string } => {
  const body = normalise(value);
  if (body === '') return { ok: true, bytes: new Uint8Array() };

  if (!BASE64_BODY.test(body)) {
    if (body.includes('=')) {
      return {
        ok: false,
        code: 'invalid-characters',
        message: 'Padding “=” appears before the end of the input',
      };
    }
    const offender = [...body].find((char) => !BASE64_BODY.test(char));
    return {
      ok: false,
      code: 'invalid-characters',
      message: `Not Base64 — unexpected character ${JSON.stringify(offender ?? '')}`,
    };
  }

  // A 4-char group carries 3 bytes; a remainder of 1 cannot encode anything.
  if (body.length % 4 === 1) {
    return { ok: false, code: 'invalid-length', message: 'Truncated — incomplete Base64 group' };
  }

  const padded = body.padEnd(Math.ceil(body.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { ok: true, bytes };
};

/** Base64 (either alphabet) -> UTF-8 text. */
export const decodeText = (value: string): DecodeResult => {
  const decoded = decodeToBytes(value);
  if (!decoded.ok) return decoded;

  try {
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(decoded.bytes) };
  } catch {
    return {
      ok: false,
      code: 'not-utf8',
      message: 'Decodes to bytes that are not valid UTF-8 text',
    };
  }
};

/** True when the string could plausibly be Base64 of *something*. */
export const looksLikeBase64 = (value: string): boolean => {
  const body = normalise(value);
  return body.length >= 8 && body.length % 4 !== 1 && BASE64_BODY.test(body);
};

/** Does this Base64 use characters exclusive to the URL-safe alphabet? */
export const usesUrlAlphabet = (value: string): boolean => /[-_]/.test(value);
