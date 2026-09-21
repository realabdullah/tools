import { queryJson } from './query';
import { isContainer, kindOf, type JsonValue } from './types';

/**
 * Filter, sort and pick — as a form, not a query language.
 *
 * A query language is the honest answer for arbitrary reshaping, and the wrong
 * first answer: nearly everything anyone does to a list of records is "keep the
 * ones where X", "order by Y", "I only care about these fields". Those are
 * three controls, they compose, and they need no syntax to learn.
 *
 * Every field is a path, so `user.name` reaches into nested records.
 */

export type FilterOperator =
  '==' | '!=' | '<' | '<=' | '>' | '>=' | 'contains' | 'startsWith' | 'endsWith';

export const FILTER_OPERATORS: readonly { value: FilterOperator; label: string }[] = [
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
];

export type TransformSpec = {
  filter: { field: string; operator: FilterOperator; value: string } | null;
  sort: { field: string; direction: 'asc' | 'desc' } | null;
  /** Keys to keep. An empty list means "keep everything". */
  pick: readonly string[];
};

export const EMPTY_TRANSFORM: TransformSpec = { filter: null, sort: null, pick: [] };

export const isEmptyTransform = (spec: TransformSpec): boolean =>
  spec.filter === null && spec.sort === null && spec.pick.length === 0;

/** Reads a field out of one record, by path. */
const fieldOf = (item: JsonValue, field: string): JsonValue | undefined => {
  if (field.trim() === '') return item;
  const result = queryJson(item, field);
  return result.ok ? result.matches[0]?.value : undefined;
};

/** Compares as numbers when both sides are numeric, and as text otherwise. */
const compareValues = (left: JsonValue | undefined, right: string): number => {
  const leftNumber =
    typeof left === 'number' ? left : Number(left === undefined ? NaN : asText(left));
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && right.trim() !== '') {
    return leftNumber - rightNumber;
  }
  return (left === undefined ? '' : asText(left)).localeCompare(right);
};

const matches = (item: JsonValue, filter: NonNullable<TransformSpec['filter']>): boolean => {
  const actual = fieldOf(item, filter.field);
  const text = (actual === undefined ? '' : asText(actual)).toLowerCase();
  const wanted = filter.value.toLowerCase();

  switch (filter.operator) {
    case '==':
      // Compared as text so "2" matches 2 — the value came from a text field.
      return text === wanted;
    case '!=':
      return text !== wanted;
    case 'contains':
      return text.includes(wanted);
    case 'startsWith':
      return text.startsWith(wanted);
    case 'endsWith':
      return text.endsWith(wanted);
    case '<':
      return compareValues(actual, filter.value) < 0;
    case '<=':
      return compareValues(actual, filter.value) <= 0;
    case '>':
      return compareValues(actual, filter.value) > 0;
    case '>=':
      return compareValues(actual, filter.value) >= 0;
  }
};

const RANK: Record<string, number> = {
  number: 0,
  string: 1,
  boolean: 2,
  null: 3,
  array: 4,
  object: 5,
};

/** Containers have no useful text form, so they are compared by their JSON. */
const asText = (value: JsonValue): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '');

const order = (left: JsonValue | undefined, right: JsonValue | undefined): number => {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;

  const kindLeft = kindOf(left);
  const kindRight = kindOf(right);
  if (kindLeft !== kindRight) return (RANK[kindLeft] ?? 9) - (RANK[kindRight] ?? 9);

  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return asText(left).localeCompare(asText(right));
};

const pickFrom = (item: JsonValue, keys: readonly string[]): JsonValue => {
  if (keys.length === 0 || !isContainer(item) || Array.isArray(item)) return item;

  const picked: Record<string, JsonValue> = {};
  for (const key of keys) {
    if (Object.hasOwn(item, key)) picked[key] = item[key] as JsonValue;
  }
  return picked;
};

/**
 * Applies a transform. Arrays are filtered, sorted and projected; an object
 * can only be projected, since there is nothing to order or filter.
 */
export const applyTransform = (value: JsonValue, spec: TransformSpec): JsonValue => {
  if (isEmptyTransform(spec)) return value;

  if (!Array.isArray(value)) {
    return spec.pick.length > 0 ? pickFrom(value, spec.pick) : value;
  }

  let items = value;

  const filter = spec.filter;
  if (filter && filter.field.trim() !== '') {
    items = items.filter((item) => matches(item, filter));
  }

  const sort = spec.sort;
  if (sort) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const left = fieldOf(a, sort.field);
      const right = fieldOf(b, sort.field);
      // Records missing the field sink either way, as in the table view.
      if (left === undefined || right === undefined) {
        if (left === undefined && right === undefined) return 0;
        return left === undefined ? 1 : -1;
      }
      return order(left, right) * direction;
    });
  }

  return spec.pick.length > 0 ? items.map((item) => pickFrom(item, spec.pick)) : items;
};

/** The keys available to filter, sort and pick on — the union across records. */
export const fieldsOf = (value: JsonValue): string[] => {
  const source = Array.isArray(value) ? value : [value];
  const fields: string[] = [];

  for (const item of source.slice(0, 100)) {
    if (!isContainer(item) || Array.isArray(item)) continue;
    for (const key of Object.keys(item)) {
      if (!fields.includes(key)) fields.push(key);
    }
  }

  return fields;
};
