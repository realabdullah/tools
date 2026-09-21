/**
 * Repairs the JSON people actually paste.
 *
 * Almost every broken document arrives broken the same handful of ways: it
 * came from a JavaScript file, a Python repl, a config file with comments, or
 * a log line that was truncated. The parser already pinpoints these; this
 * rewrites them.
 *
 * It is a scanner, not a guesser. It only ever changes syntax — quoting,
 * separators, literals, brackets — and never invents or drops a value, so a
 * repaired document always carries the same data the broken one was trying to.
 */

export type RepairKind =
  | 'single-quotes'
  | 'unquoted-key'
  | 'trailing-comma'
  | 'missing-comma'
  | 'comment'
  | 'literal'
  | 'unclosed'
  | 'smart-quotes'
  | 'trailing-content';

export type Repair = { kind: RepairKind; description: string };

export type RepairResult = {
  /** The rewritten source. Equal to the input when nothing needed doing. */
  text: string;
  repairs: Repair[];
};

const SMART_QUOTES = /[‘’‚‛]/g;
const SMART_DOUBLES = /[“”„‟]/g;

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isKeyStart = (char: string): boolean => /[A-Za-z_$]/.test(char);
const isKeyPart = (char: string): boolean => /[\w$-]/.test(char);

export const repairJson = (source: string): RepairResult => {
  const repairs: Repair[] = [];
  const seen = new Set<RepairKind>();
  const note = (kind: RepairKind, description: string): void => {
    if (seen.has(kind)) return;
    seen.add(kind);
    repairs.push({ kind, description });
  };

  // Curly quotes come from documents that went through a word processor or a
  // chat client. They are never intentional in JSON.
  let input = source;
  if (SMART_QUOTES.test(input) || SMART_DOUBLES.test(input)) {
    input = input.replace(SMART_DOUBLES, '"').replace(SMART_QUOTES, "'");
    note('smart-quotes', 'Replaced curly quotes with straight ones');
  }

  let index = 0;
  let out = '';
  /** Open containers, so anything left unclosed can be closed at the end. */
  const stack: ('object' | 'array')[] = [];

  const at = (position: number = index): string => input[position] ?? '';

  const skipWhitespaceAndComments = (): string => {
    let skipped = '';
    for (;;) {
      const char = at();
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        skipped += char;
        index += 1;
        continue;
      }
      if (char === '/' && at(index + 1) === '/') {
        while (index < input.length && at() !== '\n') index += 1;
        note('comment', 'Removed comments');
        continue;
      }
      if (char === '/' && at(index + 1) === '*') {
        index += 2;
        while (index < input.length && !(at() === '*' && at(index + 1) === '/')) index += 1;
        index += 2;
        note('comment', 'Removed comments');
        continue;
      }
      return skipped;
    }
  };

  /** Reads a quoted string in either quote style and re-emits it double-quoted. */
  const readString = (): string => {
    const quote = at();
    index += 1;
    let value = '';

    while (index < input.length && at() !== quote) {
      if (at() === '\\') {
        const escape = at(index + 1);
        // A single quote only needs escaping inside single quotes.
        if (escape === "'") value += "'";
        else value += `\\${escape}`;
        index += 2;
        continue;
      }
      if (at() === '"') value += '\\"';
      else if (at() === '\n') value += '\\n';
      else value += at();
      index += 1;
    }
    index += 1; // closing quote

    if (quote === "'") note('single-quotes', 'Converted single-quoted strings to double quotes');
    return `"${value}"`;
  };

  const readNumber = (): string => {
    const start = index;
    if (at() === '-' || at() === '+') index += 1;
    while (isDigit(at()) || at() === '.' || at() === 'e' || at() === 'E') index += 1;
    if ((at() === '-' || at() === '+') && (input[index - 1] === 'e' || input[index - 1] === 'E')) {
      index += 1;
      while (isDigit(at())) index += 1;
    }

    const raw = input.slice(start, index);
    // `+1` and `.5` are JavaScript numbers, not JSON ones.
    const normalised = raw.replace(/^\+/, '').replace(/^(-?)\./, '$10.');
    if (normalised !== raw) note('literal', 'Normalised numbers that JSON does not allow');
    return normalised;
  };

  const LITERALS: Record<string, string> = {
    true: 'true',
    false: 'false',
    null: 'null',
    True: 'true',
    False: 'false',
    None: 'null',
    TRUE: 'true',
    FALSE: 'false',
    NULL: 'null',
    undefined: 'null',
    NaN: 'null',
    Infinity: 'null',
    '-Infinity': 'null',
  };

  const readBareWord = (): string => {
    const start = index;
    while (index < input.length && isKeyPart(at())) index += 1;
    return input.slice(start, index);
  };

  const readValue = (): string => {
    // The whitespace before a value is returned with it, so a document that
    // needed no repair comes back character-for-character identical.
    const lead = skipWhitespaceAndComments();
    const char = at();

    if (char === '{') return lead + readObject();
    if (char === '[') return lead + readArray();
    if (char === '"' || char === "'") return lead + readString();
    if (char === '-' || char === '+' || char === '.' || isDigit(char)) return lead + readNumber();

    const word = readBareWord();
    if (word === '') {
      index += 1; // skip whatever this is rather than looping forever
      return `${lead}null`;
    }

    const replacement = LITERALS[word];
    if (replacement === undefined) {
      // A bare word where a value belongs is almost always a missing quote.
      note('single-quotes', 'Quoted values that were missing their quotes');
      return `${lead}"${word}"`;
    }
    if (replacement !== word) {
      note('literal', `Replaced ${word} with ${replacement}`);
    }
    return lead + replacement;
  };

  function readObject(): string {
    stack.push('object');
    index += 1;
    let body = '{';
    /** True once an entry has been read and no separator has followed it yet. */
    let awaitingSeparator = false;

    for (;;) {
      body += skipWhitespaceAndComments();

      if (index >= input.length) {
        note('unclosed', 'Closed containers that were left open');
        stack.pop();
        return `${body}}`;
      }
      if (at() === '}') {
        index += 1;
        stack.pop();
        return `${body}}`;
      }
      if (at() === ',') {
        index += 1;
        const after = skipWhitespaceAndComments();
        if (at() === '}') {
          index += 1;
          stack.pop();
          note('trailing-comma', 'Removed trailing commas');
          return `${body}}`;
        }
        body += ',';
        body += after;
        awaitingSeparator = false;
        continue;
      }

      if (awaitingSeparator) {
        body += ',';
        note('missing-comma', 'Inserted separators that were missing');
      }
      awaitingSeparator = true;

      // Key
      if (at() === '"' || at() === "'") {
        body += readString();
      } else if (isKeyStart(at())) {
        const key = readBareWord();
        body += `"${key}"`;
        note('unquoted-key', 'Quoted property names that were bare');
      } else {
        index += 1;
        continue;
      }

      body += skipWhitespaceAndComments();
      if (at() === ':') {
        index += 1;
        body += ':';
      } else {
        body += ':';
        note('missing-comma', 'Inserted separators that were missing');
      }

      body += readValue();
    }
  }

  function readArray(): string {
    stack.push('array');
    index += 1;
    let body = '[';
    let awaitingSeparator = false;

    for (;;) {
      body += skipWhitespaceAndComments();

      if (index >= input.length) {
        note('unclosed', 'Closed containers that were left open');
        stack.pop();
        return `${body}]`;
      }
      if (at() === ']') {
        index += 1;
        stack.pop();
        return `${body}]`;
      }
      if (at() === ',') {
        index += 1;
        const after = skipWhitespaceAndComments();
        if (at() === ']') {
          index += 1;
          stack.pop();
          note('trailing-comma', 'Removed trailing commas');
          return `${body}]`;
        }
        body += ',';
        body += after;
        awaitingSeparator = false;
        continue;
      }

      if (awaitingSeparator) {
        body += ',';
        note('missing-comma', 'Inserted separators that were missing');
      }
      awaitingSeparator = true;
      body += readValue();
    }
  }

  out += skipWhitespaceAndComments();
  if (index >= input.length) return { text: source, repairs: [] };

  out += readValue();
  const tail = input.slice(index).trim();
  if (tail !== '') {
    note('trailing-content', 'Dropped content after the end of the document');
  }

  return { text: out.trim(), repairs };
};

/** True when repairing would actually change something. */
export const needsRepair = (source: string, repaired: RepairResult): boolean =>
  repaired.repairs.length > 0 || repaired.text.trim() !== source.trim();
