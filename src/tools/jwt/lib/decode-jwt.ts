import { decodeText } from '@/tools/base64/lib/base64';

/**
 * JWT inspection core.
 *
 * Decoding only. Nothing here verifies a signature, and nothing here should
 * ever be read as evidence that a token is authentic.
 */

export type SegmentKind = 'header' | 'payload';

export type JwtSegment = {
  kind: SegmentKind;
  raw: string;
  /** Pretty-printed JSON when parseable, otherwise the decoded text. */
  text: string | null;
  value: Record<string, unknown> | null;
  error: string | null;
};

export type JwtInspection = {
  segments: JwtSegment[];
  header: JwtSegment;
  payload: JwtSegment;
  signature: string;
  /** `alg` from the header, when the header parsed and carried a string alg. */
  algorithm: string | null;
  /** True when `alg` is `none` — a token that carries no signature at all. */
  unsecured: boolean;
  /** Blocking problems: the token could not be read as a JWT. */
  errors: string[];
  /** Readable but unusual. Shown, not fatal. */
  warnings: string[];
};

export type JwtResult = { ok: true; jwt: JwtInspection } | { ok: false; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeSegment = (kind: SegmentKind, raw: string): JwtSegment => {
  const base: JwtSegment = { kind, raw, text: null, value: null, error: null };

  if (raw === '') return { ...base, error: `The ${kind} segment is empty` };

  const decoded = decodeText(raw);
  if (!decoded.ok) {
    return { ...base, error: `The ${kind} is not valid Base64URL — ${decoded.message}` };
  }

  try {
    const parsed: unknown = JSON.parse(decoded.value);
    if (!isRecord(parsed)) {
      return {
        ...base,
        text: decoded.value,
        error: `The ${kind} decoded to ${Array.isArray(parsed) ? 'an array' : typeof parsed}, not a JSON object`,
      };
    }
    return { ...base, text: JSON.stringify(parsed, null, 2), value: parsed };
  } catch {
    return { ...base, text: decoded.value, error: `The ${kind} is not valid JSON` };
  }
};

/** Strips whitespace and a leading `Bearer `, which is how tokens are usually copied. */
export const normaliseToken = (input: string): string =>
  input
    .trim()
    .replace(/^bearer\s+/i, '')
    .replace(/\s+/g, '');

export const inspectJwt = (input: string): JwtResult => {
  const token = normaliseToken(input);
  if (token === '') return { ok: false, errors: ['Paste a token to inspect it'] };

  const parts = token.split('.');
  if (parts.length < 2) {
    return {
      ok: false,
      errors: ['Not a JWT — expected three dot-separated segments, found one'],
    };
  }
  if (parts.length > 3) {
    return {
      ok: false,
      errors: [
        `Not a JWT — expected three dot-separated segments, found ${String(parts.length)}. JWE tokens (five segments) are not supported.`,
      ],
    };
  }

  const header = decodeSegment('header', parts[0] ?? '');
  const payload = decodeSegment('payload', parts[1] ?? '');
  const signature = parts[2] ?? '';

  const algorithmValue = header.value?.['alg'];
  const algorithm = typeof algorithmValue === 'string' ? algorithmValue : null;
  const unsecured = algorithm?.toLowerCase() === 'none';

  const warnings: string[] = [];
  if (parts.length === 2) warnings.push('The token has no signature segment');
  else if (signature === '' && !unsecured) warnings.push('The signature segment is empty');
  if (unsecured) warnings.push('Header declares alg "none" — this token is unsigned');
  if (header.value && algorithm === null) warnings.push('Header has no "alg" claim');

  const errors = [header.error, payload.error].filter((error): error is string => error !== null);

  return {
    ok: true,
    jwt: {
      segments: [header, payload],
      header,
      payload,
      signature,
      algorithm,
      unsecured,
      errors,
      warnings,
    },
  };
};

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]*$/;

/**
 * Cheap shape test used by the registry's intent detection.
 *
 * Stricter than `inspectJwt`, on purpose: detection has to survive ordinary
 * strings like "file.name.txt", so it insists on the "eyJ" prefix every JWS
 * header carries (it is how `{"` encodes in Base64URL). Anything looser
 * claims input that is not a token.
 */
export const looksLikeJwt = (input: string): boolean => {
  const parts = normaliseToken(input).split('.');
  if (parts.length < 2 || parts.length > 3) return false;
  if (!parts.every((part) => BASE64URL_SEGMENT.test(part))) return false;
  return /^eyJ/.test(parts[0] ?? '') && (parts[1]?.length ?? 0) >= 2;
};
