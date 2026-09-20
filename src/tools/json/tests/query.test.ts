import { describe, expect, it } from 'vitest';
import { joinPath, queryJson } from '../lib/query';
import type { JsonValue } from '../lib/types';

const DOC: JsonValue = {
  users: [
    { name: 'Ada', roles: ['admin', 'dev'], profile: { email: 'ada@example.com' } },
    { name: 'Grace', roles: ['dev'], profile: { email: 'grace@example.com' } },
  ],
  meta: { 'total count': 2, nested: { deep: { email: 'buried@example.com' } } },
};

const values = (query: string) => {
  const result = queryJson(DOC, query);
  if (!result.ok) throw new Error(result.message);
  return result.matches.map((match) => match.value);
};

const paths = (query: string) => {
  const result = queryJson(DOC, query);
  if (!result.ok) throw new Error(result.message);
  return result.matches.map((match) => match.path);
};

describe('queryJson', () => {
  it('returns the whole document for an empty query', () => {
    expect(queryJson(DOC, '')).toEqual({ ok: true, matches: [{ path: '$', value: DOC }] });
    expect(queryJson(DOC, '  $ ')).toEqual({ ok: true, matches: [{ path: '$', value: DOC }] });
  });

  it('walks keys with or without a leading dot or $', () => {
    expect(values('users[0].name')).toEqual(['Ada']);
    expect(values('.users[0].name')).toEqual(['Ada']);
    expect(values('$.users[0].name')).toEqual(['Ada']);
  });

  it('indexes arrays, counting back from the end for negatives', () => {
    expect(values('users[-1].name')).toEqual(['Grace']);
    expect(values('users[0].roles[1]')).toEqual(['dev']);
  });

  it('reads keys that are not identifiers through brackets', () => {
    expect(values('meta["total count"]')).toEqual([2]);
    expect(values("meta['total count']")).toEqual([2]);
  });

  it('expands a wildcard over every child', () => {
    expect(values('users[*].name')).toEqual(['Ada', 'Grace']);
    expect(values('users.*.name')).toEqual(['Ada', 'Grace']);
  });

  it('searches recursively with ..', () => {
    expect(values('..email')).toEqual([
      'ada@example.com',
      'grace@example.com',
      'buried@example.com',
    ]);
  });

  it('reports the path of every match', () => {
    expect(paths('users[*].profile.email')).toEqual([
      '$.users[0].profile.email',
      '$.users[1].profile.email',
    ]);
    expect(paths('meta["total count"]')).toEqual(['$.meta["total count"]']);
  });

  it('returns nothing rather than failing when a path is absent', () => {
    expect(values('users[9].name')).toEqual([]);
    expect(values('nope.at.all')).toEqual([]);
    expect(values('users.name')).toEqual([]);
  });

  it('explains a malformed query', () => {
    expect(queryJson(DOC, 'users[')).toMatchObject({ ok: false });
    const badIndex = queryJson(DOC, 'users[a]');
    expect(badIndex.ok).toBe(false);
    expect(badIndex.ok ? '' : badIndex.message).toMatch(/is not an index/);
    expect(queryJson(DOC, "users['x")).toMatchObject({
      ok: false,
      message: 'Unterminated quoted property name',
    });
    expect(queryJson(DOC, '..')).toMatchObject({ ok: false });
  });

  it('does not reach into inherited properties', () => {
    expect(values('constructor')).toEqual([]);
    expect(values('__proto__')).toEqual([]);
  });
});

describe('joinPath', () => {
  it('uses dots for identifiers and brackets for everything else', () => {
    expect(joinPath('$', 'name', false)).toBe('$.name');
    expect(joinPath('$', 'total count', false)).toBe('$["total count"]');
    expect(joinPath('$', '0', true)).toBe('$[0]');
    expect(joinPath('$.a', 'b-c', false)).toBe('$.a["b-c"]');
  });
});
