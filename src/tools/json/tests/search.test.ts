import { describe, expect, it } from 'vitest';
import { findMatches, splitMatches } from '../lib/matches';
import { searchJson } from '../lib/search';
import type { JsonValue } from '../lib/types';

const DOC: JsonValue = {
  service: 'billing',
  users: [
    { name: 'Ada', email: 'ada@example.com' },
    { name: 'Grace', email: 'grace@example.com' },
  ],
  meta: { emailProvider: 'postmark' },
};

describe('findMatches', () => {
  it('finds every occurrence, ignoring case', () => {
    expect(findMatches('a-B-a-b', 'B')).toEqual([2, 6]);
    expect(findMatches('aaa', 'aa')).toEqual([0]); // non-overlapping
    expect(findMatches('abc', 'z')).toEqual([]);
    expect(findMatches('abc', '')).toEqual([]);
  });
});

describe('splitMatches', () => {
  it('splits into alternating plain and matching segments', () => {
    expect(splitMatches('a-B-c', 'b')).toEqual([
      { text: 'a-', match: false },
      { text: 'B', match: true },
      { text: '-c', match: false },
    ]);
  });

  it('never drops or alters characters', () => {
    const text = 'the rain in SPAIN';
    expect(
      splitMatches(text, 'ain')
        .map((segment) => segment.text)
        .join(''),
    ).toBe(text);
  });

  it('returns the whole text when there is no query', () => {
    expect(splitMatches('abc', '')).toEqual([{ text: 'abc', match: false }]);
  });
});

describe('searchJson', () => {
  it('matches keys and primitive values', () => {
    const result = searchJson(DOC, 'ada@example.com');
    expect([...result.matches]).toEqual(['$.users[0].email']);
  });

  it('matches a key by name', () => {
    expect([...searchJson(DOC, 'emailProvider').matches]).toEqual(['$.meta.emailProvider']);
  });

  it('ignores case', () => {
    // Both the name and the address contain it.
    expect([...searchJson(DOC, 'GRACE').matches]).toEqual(['$.users[1].name', '$.users[1].email']);
  });

  it('keeps every ancestor of a match visible for context', () => {
    const result = searchJson(DOC, 'ada@example.com');
    expect([...result.visible].sort()).toEqual(
      ['$', '$.users', '$.users[0]', '$.users[0].email'].sort(),
    );
  });

  it('reports the containers that must be opened to reach a match', () => {
    const result = searchJson(DOC, 'ada@example.com');
    expect(result.expand.has('$')).toBe(true);
    expect(result.expand.has('$.users[0]')).toBe(true);
    // The match itself is a leaf; there is nothing to open on it.
    expect(result.expand.has('$.users[0].email')).toBe(false);
  });

  it('finds several matches at once', () => {
    expect(searchJson(DOC, 'example.com').matches.size).toBe(2);
  });

  it('does not match a container by its rendered preview', () => {
    expect(searchJson(DOC, 'keys').matches.size).toBe(0);
  });

  it('has nothing to say about an empty query', () => {
    expect(searchJson(DOC, '   ').matches.size).toBe(0);
  });
});
