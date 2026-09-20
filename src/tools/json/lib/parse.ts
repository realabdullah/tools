import type { JsonValue } from './types';

/**
 * Parsing, with diagnostics worth reading.
 *
 * `JSON.parse` is the source of truth for the value — it is native, fast and
 * exactly correct. Its *error messages*, however, differ between engines and
 * frequently omit the position entirely, which is useless in a tool whose job
 * is to tell you what is wrong with your document.
 *
 * So the happy path is native, and only when it throws does a scanner walk the
 * source to find the first violation and say where it is.
 */

export type JsonSyntaxError = {
  message: string;
  /** Index into the source string. */
  offset: number;
  /** 1-based, for display. */
  line: number;
  column: number;
};

export type JsonParseResult =
  { ok: true; value: JsonValue } | { ok: false; error: JsonSyntaxError };

class ScanError extends Error {
  offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

/**
 * Walks the JSON grammar and throws at the first thing that is not valid.
 * It does not build a value — `JSON.parse` already did, or already failed.
 */
const scan = (source: string): void => {
  let index = 0;

  /** Reading past the end yields '', which matches no expected character. */
  const at = (position: number = index): string => source[position] ?? '';
  const fail = (message: string, offset: number = index): never => {
    throw new ScanError(message, Math.min(offset, source.length));
  };

  const whitespace = (): void => {
    while (index < source.length) {
      const char = at();
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        index += 1;
        continue;
      }
      // A frequent paste from a config file, and worth naming precisely.
      if (char === '/' && (at(index + 1) === '/' || at(index + 1) === '*')) {
        fail('Comments are not allowed in JSON');
      }
      break;
    }
  };

  const string = (): void => {
    const start = index;
    index += 1; // opening quote

    for (;;) {
      if (index >= source.length) fail('Unterminated string', start);
      const char = at();

      if (char === '"') {
        index += 1;
        return;
      }

      if (char === '\\') {
        const escapeAt = index;
        index += 1;
        const escape = at();
        if (escape === '') fail('Unterminated string', start);
        if ('"\\/bfnrt'.includes(escape)) {
          index += 1;
          continue;
        }
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(index + 1, index + 5))) {
            fail('Invalid \\u escape — four hex digits are required', escapeAt);
          }
          index += 5;
          continue;
        }
        fail(`Invalid escape "\\${escape}"`, escapeAt);
      }

      if (source.charCodeAt(index) < 0x20) {
        fail('Control characters must be escaped inside a string');
      }
      index += 1;
    }
  };

  const number = (): void => {
    const start = index;
    if (at() === '-') index += 1;

    if (at() === '0') {
      index += 1;
      if (isDigit(at())) fail('Numbers cannot have a leading zero', start);
    } else if (isDigit(at())) {
      while (isDigit(at())) index += 1;
    } else {
      fail('Expected a number', start);
    }

    if (at() === '.') {
      index += 1;
      if (!isDigit(at())) fail('Expected a digit after the decimal point');
      while (isDigit(at())) index += 1;
    }

    if (at() === 'e' || at() === 'E') {
      index += 1;
      if (at() === '+' || at() === '-') index += 1;
      if (!isDigit(at())) fail('Expected a digit in the exponent');
      while (isDigit(at())) index += 1;
    }
  };

  const literal = (word: string): boolean => {
    if (!source.startsWith(word, index)) return false;
    index += word.length;
    return true;
  };

  const object = (): void => {
    const start = index;
    index += 1; // {
    whitespace();

    if (at() === '}') {
      index += 1;
      return;
    }

    for (;;) {
      whitespace();
      if (at() !== '"') {
        if (at() === "'") fail('Property names must be wrapped in double quotes');
        if (index >= source.length)
          fail('Unexpected end of input — this object is never closed', start);
        fail('Expected a property name in double quotes');
      }
      string();

      whitespace();
      if (at() !== ':') fail('Expected ":" after the property name');
      index += 1;

      value();
      whitespace();

      if (at() === ',') {
        const commaAt = index;
        index += 1;
        whitespace();
        if (at() === '}') fail('Trailing comma before "}"', commaAt);
        continue;
      }
      if (at() === '}') {
        index += 1;
        return;
      }
      if (index >= source.length)
        fail('Unexpected end of input — this object is never closed', start);
      fail('Expected "," or "}"');
    }
  };

  const array = (): void => {
    const start = index;
    index += 1; // [
    whitespace();

    if (at() === ']') {
      index += 1;
      return;
    }

    for (;;) {
      value();
      whitespace();

      if (at() === ',') {
        const commaAt = index;
        index += 1;
        whitespace();
        if (at() === ']') fail('Trailing comma before "]"', commaAt);
        continue;
      }
      if (at() === ']') {
        index += 1;
        return;
      }
      if (index >= source.length)
        fail('Unexpected end of input — this array is never closed', start);
      fail('Expected "," or "]"');
    }
  };

  function value(): void {
    whitespace();
    if (index >= source.length) fail('Unexpected end of input');

    const char = at();
    if (char === '{') return object();
    if (char === '[') return array();
    if (char === '"') return string();
    if (char === '-' || isDigit(char)) return number();
    if (literal('true') || literal('false') || literal('null')) return;

    if (char === "'") fail('Strings must be wrapped in double quotes');
    if (literal('True') || literal('False'))
      fail('Booleans are written "true" and "false"', index - 4);
    if (source.startsWith('None', index)) fail('Null is written "null"');
    if (source.startsWith('undefined', index)) fail('"undefined" is not valid in JSON');
    if (source.startsWith('NaN', index)) fail('"NaN" is not a valid JSON number');
    fail(`Unexpected character ${JSON.stringify(char)}`);
  }

  value();
  whitespace();
  if (index < source.length) {
    fail('Unexpected content after the end of the JSON value');
  }
};

/** Converts a string offset into the 1-based line and column a person reads. */
export const positionAt = (source: string, offset: number): { line: number; column: number } => {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const lastBreak = before.lastIndexOf('\n');
  return {
    line: before.split('\n').length,
    column: clamped - lastBreak,
  };
};

/**
 * Finds the first syntax error, or `null` if the scanner considers the source
 * valid. A `null` here on input that `JSON.parse` rejected means the two
 * disagree, and the native message is used instead.
 */
export const locateSyntaxError = (source: string): JsonSyntaxError | null => {
  try {
    scan(source);
    return null;
  } catch (error) {
    if (!(error instanceof ScanError)) throw error;
    return { message: error.message, offset: error.offset, ...positionAt(source, error.offset) };
  }
};

/** Strips the engine-specific tail from a native SyntaxError message. */
const nativeMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : 'Invalid JSON';
  return raw
    .replace(/\s*(in JSON )?at position \d+.*$/i, '')
    .replace(/,\s*"[\s\S]*$/, '')
    .trim();
};

export const parseJson = (source: string): JsonParseResult => {
  try {
    return { ok: true, value: JSON.parse(source) as JsonValue };
  } catch (error) {
    const located = locateSyntaxError(source);
    if (located) return { ok: false, error: located };
    return {
      ok: false,
      error: { message: nativeMessage(error), offset: 0, line: 1, column: 1 },
    };
  }
};
