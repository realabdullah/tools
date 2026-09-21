import { joinPath } from './query';
import { isContainer, kindOf, type JsonValue } from './types';

/**
 * Arrays of objects, as a table.
 *
 * Records — log lines, rows from an API, fixtures — are the shape JSON is most
 * often used for and the shape a tree reads worst. Columns are the union of
 * the keys, in the order they are first seen, so the document's own ordering
 * survives.
 */

export type TableRow = {
  path: string;
  index: number;
  cells: (JsonValue | undefined)[];
};

export type TableModel = {
  columns: string[];
  rows: TableRow[];
  /** Rows beyond the render cap. */
  hidden: number;
};

const isPlainObject = (value: JsonValue): value is Record<string, JsonValue> =>
  isContainer(value) && !Array.isArray(value);

/** `null` when this value is not a table — which is most values. */
export const isTabular = (value: JsonValue): value is Record<string, JsonValue>[] =>
  Array.isArray(value) && value.length > 0 && value.every(isPlainObject);

export type SortDirection = 'asc' | 'desc';
export type TableSort = { column: string; direction: SortDirection } | null;

const RANK: Record<string, number> = {
  number: 0,
  string: 1,
  boolean: 2,
  null: 3,
  array: 4,
  object: 5,
};

/** Orders values of mixed type predictably. */
const compare = (a: JsonValue, b: JsonValue): number => {
  const kindA = kindOf(a);
  const kindB = kindOf(b);
  if (kindA !== kindB) return (RANK[kindA] ?? 9) - (RANK[kindB] ?? 9);

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return 0;
};

export const toTable = (
  value: JsonValue,
  options: { limit?: number; sort?: TableSort; rootPath?: string } = {},
): TableModel | null => {
  if (!isTabular(value)) return null;

  const limit = options.limit ?? 200;
  const rootPath = options.rootPath ?? '$';

  const columns: string[] = [];
  for (const record of value) {
    for (const key of Object.keys(record)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  let rows: TableRow[] = value.map((record, index) => ({
    path: joinPath(rootPath, String(index), true),
    index,
    cells: columns.map((column) => (Object.hasOwn(record, column) ? record[column] : undefined)),
  }));

  const sort = options.sort;
  if (sort) {
    const column = columns.indexOf(sort.column);
    if (column !== -1) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const left = a.cells[column];
        const right = b.cells[column];
        // A row that simply lacks the column sinks to the bottom either way:
        // reversing the sort should not promote missing data to the top.
        if (left === undefined || right === undefined) {
          if (left === undefined && right === undefined) return 0;
          return left === undefined ? 1 : -1;
        }
        return compare(left, right) * direction;
      });
    }
  }

  return {
    columns,
    rows: rows.slice(0, limit),
    hidden: Math.max(0, rows.length - limit),
  };
};
