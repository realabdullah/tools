export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export const kindOf = (value: JsonValue): JsonKind => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
};

export const isContainer = (
  value: JsonValue,
): value is JsonValue[] | { [key: string]: JsonValue } =>
  value !== null && typeof value === 'object';

/** Number of direct children. Zero for primitives. */
export const childCount = (value: JsonValue): number => {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === 'object') return Object.keys(value).length;
  return 0;
};

export const entriesOf = (
  value: JsonValue[] | { [key: string]: JsonValue },
): [string, JsonValue][] =>
  Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
