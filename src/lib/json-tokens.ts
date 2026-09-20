export type JsonTokenType = 'key' | 'string' | 'number' | 'keyword' | 'punctuation' | 'plain';

export type JsonToken = { type: JsonTokenType; value: string };

/**
 * Splits pretty-printed JSON into coloured tokens.
 *
 * Returns data, never markup — the caller renders spans, so nothing pasted
 * into the app can ever be interpreted as HTML.
 */
const PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

export const tokenizeJson = (source: string): JsonToken[] => {
  const tokens: JsonToken[] = [];
  let cursor = 0;

  for (const match of source.matchAll(PATTERN)) {
    const index = match.index;
    if (index > cursor) tokens.push({ type: 'plain', value: source.slice(cursor, index) });

    const [whole, quoted, colon, numeric, keyword, punctuation] = match;
    if (quoted !== undefined) {
      tokens.push({ type: colon ? 'key' : 'string', value: quoted });
      if (colon) tokens.push({ type: 'punctuation', value: colon });
    } else if (numeric !== undefined) {
      tokens.push({ type: 'number', value: numeric });
    } else if (keyword !== undefined) {
      tokens.push({ type: 'keyword', value: keyword });
    } else if (punctuation !== undefined) {
      tokens.push({ type: 'punctuation', value: punctuation });
    }

    cursor = index + whole.length;
  }

  if (cursor < source.length) tokens.push({ type: 'plain', value: source.slice(cursor) });
  return tokens;
};
