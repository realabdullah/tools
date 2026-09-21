import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  EMPTY_TRANSFORM,
  fieldsOf,
  isEmptyTransform,
  type TransformSpec,
} from '../lib/transform-ops';
import type { JsonValue } from '../lib/types';

const RECORDS: JsonValue = [
  { id: 3, name: 'Grace', role: 'admin', score: 91, user: { city: 'Arlington' } },
  { id: 1, name: 'Ada', role: 'dev', score: 99, user: { city: 'London' } },
  { id: 2, name: 'Alan', role: 'dev', score: 97 },
];

const spec = (partial: Partial<TransformSpec>): TransformSpec => ({
  ...EMPTY_TRANSFORM,
  ...partial,
});

const names = (value: JsonValue) =>
  (value as Record<string, JsonValue>[]).map((item) => item['name']);

describe('applyTransform', () => {
  it('returns the value untouched when nothing is set', () => {
    expect(applyTransform(RECORDS, EMPTY_TRANSFORM)).toBe(RECORDS);
    expect(isEmptyTransform(EMPTY_TRANSFORM)).toBe(true);
  });

  it('filters by equality, comparing as text so 2 matches "2"', () => {
    const result = applyTransform(
      RECORDS,
      spec({ filter: { field: 'role', operator: '==', value: 'dev' } }),
    );
    expect(names(result)).toEqual(['Ada', 'Alan']);

    const byId = applyTransform(
      RECORDS,
      spec({ filter: { field: 'id', operator: '==', value: '2' } }),
    );
    expect(names(byId)).toEqual(['Alan']);
  });

  it('filters numerically for the ordering operators', () => {
    const result = applyTransform(
      RECORDS,
      spec({ filter: { field: 'score', operator: '>', value: '95' } }),
    );
    expect(names(result)).toEqual(['Ada', 'Alan']);
  });

  it('filters by text operators, ignoring case', () => {
    expect(
      names(
        applyTransform(
          RECORDS,
          spec({ filter: { field: 'name', operator: 'contains', value: 'a' } }),
        ),
      ),
    ).toEqual(['Grace', 'Ada', 'Alan']);

    expect(
      names(
        applyTransform(
          RECORDS,
          spec({ filter: { field: 'name', operator: 'startsWith', value: 'A' } }),
        ),
      ),
    ).toEqual(['Ada', 'Alan']);
  });

  it('reaches into nested records by path', () => {
    const result = applyTransform(
      RECORDS,
      spec({ filter: { field: 'user.city', operator: '==', value: 'London' } }),
    );
    expect(names(result)).toEqual(['Ada']);
  });

  it('sorts in both directions', () => {
    expect(
      names(applyTransform(RECORDS, spec({ sort: { field: 'id', direction: 'asc' } }))),
    ).toEqual(['Ada', 'Alan', 'Grace']);
    expect(
      names(applyTransform(RECORDS, spec({ sort: { field: 'name', direction: 'desc' } }))),
    ).toEqual(['Grace', 'Alan', 'Ada']);
  });

  it('sinks records missing the sort field, either direction', () => {
    const ascending = applyTransform(
      RECORDS,
      spec({ sort: { field: 'user.city', direction: 'asc' } }),
    );
    expect(names(ascending).at(-1)).toBe('Alan');

    const descending = applyTransform(
      RECORDS,
      spec({ sort: { field: 'user.city', direction: 'desc' } }),
    );
    expect(names(descending).at(-1)).toBe('Alan');
  });

  it('keeps only the picked fields, in the order picked', () => {
    const result = applyTransform(RECORDS, spec({ pick: ['name', 'id'] }));
    expect(result).toEqual([
      { name: 'Grace', id: 3 },
      { name: 'Ada', id: 1 },
      { name: 'Alan', id: 2 },
    ]);
  });

  it('composes filter, sort and pick', () => {
    const result = applyTransform(
      RECORDS,
      spec({
        filter: { field: 'role', operator: '==', value: 'dev' },
        sort: { field: 'score', direction: 'desc' },
        pick: ['name'],
      }),
    );
    expect(result).toEqual([{ name: 'Ada' }, { name: 'Alan' }]);
  });

  it('leaves the original array alone', () => {
    applyTransform(RECORDS, spec({ sort: { field: 'id', direction: 'asc' } }));
    expect(names(RECORDS)).toEqual(['Grace', 'Ada', 'Alan']);
  });

  it('can only pick from an object', () => {
    const object: JsonValue = { a: 1, b: 2, c: 3 };
    expect(applyTransform(object, spec({ pick: ['a', 'c'] }))).toEqual({ a: 1, c: 3 });
    expect(applyTransform(object, spec({ sort: { field: 'a', direction: 'asc' } }))).toBe(object);
  });

  it('ignores a filter with no field', () => {
    expect(
      applyTransform(RECORDS, spec({ filter: { field: '  ', operator: '==', value: 'x' } })),
    ).toHaveLength(3);
  });
});

describe('fieldsOf', () => {
  it('lists the union of keys across records', () => {
    expect(fieldsOf(RECORDS)).toEqual(['id', 'name', 'role', 'score', 'user']);
  });

  it('works on a lone object', () => {
    expect(fieldsOf({ a: 1, b: 2 })).toEqual(['a', 'b']);
  });

  it('has nothing to offer for scalars', () => {
    expect(fieldsOf([1, 2, 3])).toEqual([]);
  });
});
