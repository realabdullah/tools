import { entriesOf, isContainer, type JsonValue } from './types';

/**
 * Recursively orders object keys.
 *
 * Alphabetical order is what makes two documents comparable by eye, and it is
 * the one rewrite that changes nothing about what the document means. Arrays
 * keep their order, because in JSON that order is data.
 */
export const sortKeys = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isContainer(value)) return value;

  const sorted: Record<string, JsonValue> = {};
  for (const [key, child] of entriesOf(value).sort(([a], [b]) => a.localeCompare(b))) {
    sorted[key] = sortKeys(child);
  }
  return sorted;
};

/**
 * A document that is itself a JSON string containing JSON — what you get from
 * a log line or a webhook payload. `null` when there is nothing to unwrap.
 */
export const unwrapEncoded = (value: JsonValue): JsonValue | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return null;
  }
};
