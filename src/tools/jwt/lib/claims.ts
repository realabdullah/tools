/**
 * Registered-claim knowledge.
 *
 * The inspector never replaces a raw value with an interpretation — it adds
 * one alongside. Everything here is annotation.
 */

export const REGISTERED_CLAIMS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires at',
  nbf: 'Not valid before',
  iat: 'Issued at',
  jti: 'JWT ID',
  azp: 'Authorised party',
  scope: 'Scope',
  typ: 'Type',
  alg: 'Algorithm',
  kid: 'Key ID',
  cty: 'Content type',
};

export const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat', 'auth_time', 'updated_at']);

const SECONDS_CEILING = 1e11; // beyond this the value is almost certainly milliseconds

export type TimeClaim = {
  date: Date;
  iso: string;
  absolute: string;
  relative: string;
  /** The source value was in milliseconds, not the seconds a JWT should carry. */
  milliseconds: boolean;
};

const RELATIVE_UNITS = [
  { limit: 60, unit: 'second' as const, ms: 1000 },
  { limit: 3600, unit: 'minute' as const, ms: 60_000 },
  { limit: 86_400, unit: 'hour' as const, ms: 3_600_000 },
  { limit: 2_592_000, unit: 'day' as const, ms: 86_400_000 },
  { limit: 31_536_000, unit: 'month' as const, ms: 2_592_000_000 },
];

export const formatRelative = (date: Date, now: Date = new Date()): string => {
  const deltaMs = date.getTime() - now.getTime();
  const seconds = Math.abs(deltaMs) / 1000;
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  const match = RELATIVE_UNITS.find((entry) => seconds < entry.limit);
  if (!match) return format.format(Math.round(deltaMs / 31_536_000_000), 'year');
  return format.format(Math.round(deltaMs / match.ms), match.unit);
};

const absoluteFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

/** Interprets a numeric claim value as a point in time. `null` when it is not one. */
export const parseTimeClaim = (value: unknown, now: Date = new Date()): TimeClaim | null => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return null;

  const milliseconds = numeric >= SECONDS_CEILING;
  const date = new Date(milliseconds ? numeric : numeric * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return {
    date,
    iso: date.toISOString(),
    absolute: absoluteFormatter.format(date),
    relative: formatRelative(date, now),
    milliseconds,
  };
};

export type ValidityStatus = 'valid' | 'expired' | 'not-yet-valid' | 'unknown';

export type Validity = {
  status: ValidityStatus;
  /** Short sentence for the status chip. */
  detail: string;
};

/** Validity window only — this says nothing about whether the signature is good. */
export const evaluateValidity = (
  payload: Record<string, unknown> | null,
  now: Date = new Date(),
): Validity => {
  if (!payload) return { status: 'unknown', detail: 'No readable payload' };

  const exp = parseTimeClaim(payload['exp'], now);
  const nbf = parseTimeClaim(payload['nbf'], now);

  if (exp && exp.date.getTime() <= now.getTime()) {
    return { status: 'expired', detail: `Expired ${formatRelative(exp.date, now)}` };
  }
  if (nbf && nbf.date.getTime() > now.getTime()) {
    return { status: 'not-yet-valid', detail: `Valid ${formatRelative(nbf.date, now)}` };
  }
  if (exp) return { status: 'valid', detail: `Expires ${formatRelative(exp.date, now)}` };
  if (nbf) return { status: 'valid', detail: 'Within its validity window' };

  return { status: 'unknown', detail: 'No expiry claim' };
};
