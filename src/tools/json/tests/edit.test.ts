import { describe, expect, it } from 'vitest';
import {
  appendTo,
  coerce,
  convertAt,
  duplicateAt,
  editableText,
  getAt,
  parseEdited,
  removeAt,
  renameAt,
  setAt,
} from '../lib/edit';
import type { JsonValue } from '../lib/types';

const DOC: JsonValue = {
  name: 'billing',
  replicas: 2,
  hosts: ['a', 'b'],
  limits: { rps: 100, burst: null },
};

describe('getAt', () => {
  it('walks keys and indices', () => {
    expect(getAt(DOC, ['name'])).toBe('billing');
    expect(getAt(DOC, ['hosts', 1])).toBe('b');
    expect(getAt(DOC, ['limits', 'rps'])).toBe(100);
    expect(getAt(DOC, [])).toBe(DOC);
  });

  it('is undefined for a path that is not there', () => {
    expect(getAt(DOC, ['nope'])).toBeUndefined();
    expect(getAt(DOC, ['hosts', 9])).toBeUndefined();
    expect(getAt(DOC, ['name', 'deeper'])).toBeUndefined();
    // An index into an object, or a key into an array, is not a path.
    expect(getAt(DOC, ['hosts', 'length'])).toBeUndefined();
    expect(getAt(DOC, [0])).toBeUndefined();
  });
});

describe('setAt', () => {
  it('replaces a value without touching the rest', () => {
    const next = setAt(DOC, ['replicas'], 5);
    expect(getAt(next, ['replicas'])).toBe(5);
    expect(getAt(next, ['limits'])).toBe(DOC.limits); // shared, not copied
    expect(DOC.replicas).toBe(2); // original untouched
  });

  it('replaces deep values and array items', () => {
    expect(getAt(setAt(DOC, ['limits', 'rps'], 250), ['limits', 'rps'])).toBe(250);
    expect(getAt(setAt(DOC, ['hosts', 0], 'z'), ['hosts'])).toEqual(['z', 'b']);
  });

  it('leaves the document alone for an unreachable path', () => {
    expect(setAt(DOC, ['nope', 'deeper'], 1)).toBe(DOC);
    expect(setAt(DOC, ['hosts', 9], 'x')).toBe(DOC);
  });
});

describe('removeAt', () => {
  it('removes a key and closes an array gap', () => {
    expect(removeAt(DOC, ['replicas'])).toEqual({
      name: 'billing',
      hosts: ['a', 'b'],
      limits: { rps: 100, burst: null },
    });
    expect(getAt(removeAt(DOC, ['hosts', 0]), ['hosts'])).toEqual(['b']);
  });

  it('ignores a path that is not there', () => {
    expect(removeAt(DOC, ['nope'])).toEqual(DOC);
  });
});

describe('renameAt', () => {
  it('keeps the key in place', () => {
    const next = renameAt(DOC, ['replicas'], 'instances');
    expect(Object.keys(next as object)).toEqual(['name', 'instances', 'hosts', 'limits']);
    expect(getAt(next, ['instances'])).toBe(2);
  });

  it('refuses a rename that would change nothing or lose the key', () => {
    expect(renameAt(DOC, ['replicas'], 'replicas')).toBe(DOC);
    expect(renameAt(DOC, ['replicas'], '')).toBe(DOC);
    expect(renameAt(DOC, ['hosts', 0], 'x')).toBe(DOC);
  });
});

describe('duplicateAt', () => {
  it('puts the copy next to the original', () => {
    const next = duplicateAt(DOC, ['hosts', 0]);
    expect(getAt(next, ['hosts'])).toEqual(['a', 'a', 'b']);

    const withKey = duplicateAt(DOC, ['replicas']);
    expect(Object.keys(withKey as object)).toEqual([
      'name',
      'replicas',
      'replicas copy',
      'hosts',
      'limits',
    ]);
  });

  it('does not collide with a copy that already exists', () => {
    const once = duplicateAt(DOC, ['replicas']);
    const twice = duplicateAt(once, ['replicas']);
    expect(Object.keys(twice as object)).toContain('replicas copy 2');
  });

  it('copies deeply, so editing the copy leaves the original alone', () => {
    const next = duplicateAt(DOC, ['limits']);
    const edited = setAt(next, ['limits copy', 'rps'], 1);
    expect(getAt(edited, ['limits', 'rps'])).toBe(100);
  });
});

describe('appendTo', () => {
  it('appends to an array and reports the new path', () => {
    const { document, path } = appendTo(DOC, ['hosts']);
    expect(getAt(document, ['hosts'])).toEqual(['a', 'b', '']);
    expect(path).toEqual(['hosts', 2]);
  });

  it('adds a fresh key to an object without overwriting one', () => {
    const first = appendTo(DOC, []);
    expect(first.path).toEqual(['key']);

    const second = appendTo(first.document, []);
    expect(second.path).toEqual(['key 2']);
  });

  it('can append a container', () => {
    const { document, path } = appendTo(DOC, ['hosts'], 'object');
    expect(getAt(document, path)).toEqual({});
  });
});

describe('convertAt and coerce', () => {
  it('keeps the meaning that survives the change', () => {
    expect(coerce('42', 'number')).toBe(42);
    expect(coerce(42, 'string')).toBe('42');
    expect(coerce('', 'boolean')).toBe(false);
    expect(coerce('false', 'boolean')).toBe(false);
    expect(coerce('yes', 'boolean')).toBe(true);
    expect(coerce(0, 'boolean')).toBe(false);
    expect(coerce('abc', 'number')).toBe(0);
    expect(coerce(null, 'object')).toEqual({});
    expect(coerce({ a: 1 }, 'array')).toEqual([1]);
    expect(coerce('x', 'array')).toEqual(['x']);
  });

  it('is a no-op when the type already matches', () => {
    expect(convertAt(DOC, ['replicas'], 'number')).toBe(DOC);
  });

  it('converts in place', () => {
    expect(getAt(convertAt(DOC, ['replicas'], 'string'), ['replicas'])).toBe('2');
  });
});

describe('parseEdited', () => {
  it('keeps a string a string, whatever it looks like', () => {
    expect(parseEdited('5', 'name')).toBe('5');
    expect(parseEdited('true', 'name')).toBe('true');
  });

  it('re-reads other types as JSON', () => {
    expect(parseEdited('12', 0)).toBe(12);
    expect(parseEdited('true', false)).toBe(true);
    expect(parseEdited('null', 0)).toBeNull();
  });

  it('falls back to a string when the text is not JSON', () => {
    expect(parseEdited('twelve', 0)).toBe('twelve');
  });
});

describe('editableText', () => {
  it('shows strings without quotes and everything else as JSON', () => {
    expect(editableText('hello')).toBe('hello');
    expect(editableText(42)).toBe('42');
    expect(editableText(null)).toBe('null');
    expect(editableText(true)).toBe('true');
  });
});
