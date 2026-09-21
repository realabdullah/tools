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
 * Parses text that is structured JSON, or returns `null`.
 *
 * Only objects and arrays count: a bare `42` or `"hi"` is valid JSON but there
 * is nothing to lay out, so treating it as a document would be noise.
 */
export const parseIfJson = (text: string): JsonValue | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return null;
  }
};

/**
 * A document that is itself a JSON string containing JSON — what you get from
 * a log line or a webhook payload. `null` when there is nothing to unwrap.
 */
export const unwrapEncoded = (value: JsonValue): JsonValue | null =>
  typeof value === 'string' ? parseIfJson(value) : null;
