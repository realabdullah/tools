import { describe, expect, it } from 'vitest';
import { allContainerPaths, buildRows, defaultExpanded, previewOf } from '../lib/tree';
import type { JsonValue } from '../lib/types';

const DOC: JsonValue = { a: 1, b: { c: [10, 20] }, d: 'x' };

const labels = (rows: ReturnType<typeof buildRows>) =>
  rows.map((row) =>
    row.type === 'node' ? `${String(row.depth)}:${row.label}` : `${String(row.depth)}:…`,
  );

describe('buildRows', () => {
  it('shows only the root when nothing is expanded', () => {
    const rows = buildRows(DOC, new Set());
    expect(rows).toHaveLength(1);
    expect(labels(rows)).toEqual(['0:$']);
    expect(rows[0]).toMatchObject({ expandable: true, expanded: false, childCount: 3 });
  });

  it('adds children as nodes are expanded', () => {
    expect(labels(buildRows(DOC, new Set(['$'])))).toEqual(['0:$', '1:a', '1:b', '1:d']);
    expect(labels(buildRows(DOC, new Set(['$', '$.b', '$.b.c'])))).toEqual([
      '0:$',
      '1:a',
      '1:b',
      '2:c',
      '3:0',
      '3:1',
      '1:d',
    ]);
  });

  it('labels array children by index', () => {
    const rows = buildRows(DOC, new Set(['$', '$.b', '$.b.c']));
    const first = rows.find((row) => row.type === 'node' && row.path === '$.b.c[0]');
    expect(first).toMatchObject({ labelKind: 'index', label: '0', kind: 'number', value: 10 });
  });

  it('marks the last child of each parent', () => {
    const rows = buildRows(DOC, new Set(['$']));
    const last = rows
      .filter((row) => row.type === 'node' && row.last)
      .map((row) => row.type === 'node' && row.path);
    expect(last).toContain('$.d');
    expect(last).not.toContain('$.a');
  });

  it('never expands an empty container', () => {
    const rows = buildRows({ empty: {}, list: [] }, new Set(['$', '$.empty', '$.list']));
    expect(labels(rows)).toEqual(['0:$', '1:empty', '1:list']);
    expect(rows[1]).toMatchObject({ expandable: false });
  });

  it('summarises children past the limit instead of rendering them', () => {
    const big: JsonValue = Array.from({ length: 500 }, (_, index) => index);
    const rows = buildRows(big, new Set(['$']), { childLimit: 10 });

    expect(rows).toHaveLength(12); // root + 10 children + overflow
    expect(rows.at(-1)).toMatchObject({ type: 'overflow', hidden: 490, depth: 1 });
  });
});

describe('defaultExpanded', () => {
  it('opens a small document completely', () => {
    const expanded = defaultExpanded(DOC);
    expect(expanded).toEqual(new Set(['$', '$.b', '$.b.c']));
  });

  it('stays inside its row budget on a large document', () => {
    const wide: JsonValue = Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [
        `key${String(index)}`,
        Array.from({ length: 50 }, () => 1),
      ]),
    );
    const expanded = defaultExpanded(wide, 100);
    const rows = buildRows(wide, expanded);

    expect(rows.length).toBeLessThanOrEqual(120);
    expect(expanded.has('$')).toBe(true);
  });

  it('has nothing to expand for a scalar', () => {
    expect(defaultExpanded(42)).toEqual(new Set());
    expect(defaultExpanded({})).toEqual(new Set());
  });
});

describe('allContainerPaths', () => {
  it('finds every container', () => {
    expect(allContainerPaths(DOC)).toEqual(new Set(['$', '$.b', '$.b.c']));
  });
});

describe('previewOf', () => {
  it('describes containers by size and pluralises', () => {
    expect(previewOf([1, 2, 3])).toBe('[ 3 items ]');
    expect(previewOf([1])).toBe('[ 1 item ]');
    expect(previewOf([])).toBe('[]');
    expect(previewOf({ a: 1 })).toBe('{ 1 key }');
    expect(previewOf({})).toBe('{}');
  });

  it('renders primitives as JSON', () => {
    expect(previewOf('hi')).toBe('"hi"');
    expect(previewOf(null)).toBe('null');
  });
});
