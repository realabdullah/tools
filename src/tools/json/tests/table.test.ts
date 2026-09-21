import { describe, expect, it } from 'vitest';
import { isTabular, toTable } from '../lib/table';
import type { JsonValue } from '../lib/types';

const RECORDS: JsonValue = [
  { id: 2, name: 'Grace', active: false },
  { id: 1, name: 'Ada', active: true, extra: 'x' },
];

describe('isTabular', () => {
  it('accepts an array of objects', () => {
    expect(isTabular(RECORDS)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isTabular([])).toBe(false);
    expect(isTabular([1, 2])).toBe(false);
    expect(isTabular([{ a: 1 }, 2])).toBe(false);
    expect(isTabular([[1], [2]])).toBe(false);
    expect(isTabular({ a: 1 })).toBe(false);
  });
});

describe('toTable', () => {
  it('builds columns from the union of keys, in first-seen order', () => {
    expect(toTable(RECORDS)?.columns).toEqual(['id', 'name', 'active', 'extra']);
  });

  it('leaves absent cells undefined rather than null', () => {
    const table = toTable(RECORDS);
    expect(table?.rows[0]?.cells).toEqual([2, 'Grace', false, undefined]);
  });

  it('gives every row the path it came from', () => {
    expect(toTable(RECORDS)?.rows.map((row) => row.path)).toEqual(['$[0]', '$[1]']);
  });

  it('keeps document order until asked to sort', () => {
    expect(toTable(RECORDS)?.rows.map((row) => row.index)).toEqual([0, 1]);
  });

  it('sorts by a column in both directions', () => {
    const ascending = toTable(RECORDS, { sort: { column: 'id', direction: 'asc' } });
    expect(ascending?.rows.map((row) => row.index)).toEqual([1, 0]);

    const descending = toTable(RECORDS, { sort: { column: 'id', direction: 'desc' } });
    expect(descending?.rows.map((row) => row.index)).toEqual([0, 1]);
  });

  it('sorts strings, and puts absent cells last either way', () => {
    const ascending = toTable(RECORDS, { sort: { column: 'extra', direction: 'asc' } });
    expect(ascending?.rows.map((row) => row.index)).toEqual([1, 0]);

    const descending = toTable(RECORDS, { sort: { column: 'extra', direction: 'desc' } });
    expect(descending?.rows[1]?.index).toBe(0);
  });

  it('caps the rows it returns and reports the remainder', () => {
    const many: JsonValue = Array.from({ length: 500 }, (_, index) => ({ index }));
    const table = toTable(many, { limit: 10 });
    expect(table?.rows).toHaveLength(10);
    expect(table?.hidden).toBe(490);
  });

  it('is null for anything that is not a table', () => {
    expect(toTable({ a: 1 })).toBeNull();
  });
});
