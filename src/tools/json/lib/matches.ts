/** Caps a pathological search on a very large document. */
const MAX_MATCHES = 5000;

/**
 * Start offsets of every case-insensitive occurrence of `query` in `text`.
 * Plain substring search: this is "find this key", not a regex console.
 */
export const findMatches = (text: string, query: string): number[] => {
  if (query === '') return [];

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const offsets: number[] = [];

  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1 || offsets.length >= MAX_MATCHES) break;
    offsets.push(at);
    from = at + needle.length;
  }

  return offsets;
};

export type TextSegment = { text: string; match: boolean };

/** Splits text into alternating plain and matching segments, for rendering. */
export const splitMatches = (text: string, query: string): TextSegment[] => {
  if (query === '') return [{ text, match: false }];

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const at of findMatches(text, query)) {
    if (at > cursor) segments.push({ text: text.slice(cursor, at), match: false });
    segments.push({ text: text.slice(at, at + query.length), match: true });
    cursor = at + query.length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
};
