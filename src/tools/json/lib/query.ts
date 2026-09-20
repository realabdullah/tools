import { entriesOf, isContainer, type JsonValue } from './types';

/**
 * A path query, not a query language.
 *
 * Deliberately a small subset of JSONPath: keys, indices (negative counts from
 * the end), `*` for every child and `..key` for a recursive search. That covers
 * what you actually type while looking at a document, and every part of it can
 * be explained in one line of placeholder text. Filters and expressions are
 * where a query language starts, and they are not needed to read JSON.
 */

type Step =
  | { kind: 'key'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'wildcard' }
  | { kind: 'descend'; name: string };

export type QueryMatch = { path: string; value: JsonValue };

export type QueryResult = { ok: true; matches: QueryMatch[] } | { ok: false; message: string };

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Renders a key as it would be typed back into a query. */
export const joinPath = (parent: string, label: string, isIndex: boolean): string => {
  if (isIndex) return `${parent}[${label}]`;
  return IDENTIFIER.test(label) ? `${parent}.${label}` : `${parent}[${JSON.stringify(label)}]`;
};

class QuerySyntaxError extends Error {}

const parseQuery = (query: string): Step[] => {
  const steps: Step[] = [];
  let index = 0;
  const source = query.trim();

  const at = (position: number = index): string => source[position] ?? '';
  if (at() === '$') index += 1;

  const readBareKey = (): string => {
    const start = index;
    while (index < source.length && !'.[]'.includes(at())) index += 1;
    if (index === start) throw new QuerySyntaxError('Expected a property name');
    return source.slice(start, index);
  };

  while (index < source.length) {
    const char = at();

    if (char === '.') {
      if (at(index + 1) === '.') {
        index += 2;
        if (at() === '*') throw new QuerySyntaxError('".." must be followed by a property name');
        steps.push({ kind: 'descend', name: readBareKey() });
        continue;
      }
      index += 1;
      if (at() === '*') {
        index += 1;
        steps.push({ kind: 'wildcard' });
        continue;
      }
      steps.push({ kind: 'key', name: readBareKey() });
      continue;
    }

    if (char === '[') {
      index += 1;
      const quote = at();

      if (quote === '"' || quote === "'") {
        index += 1;
        const start = index;
        while (index < source.length && at() !== quote) index += 1;
        if (at() !== quote) throw new QuerySyntaxError('Unterminated quoted property name');
        const name = source.slice(start, index);
        index += 1;
        if (at() !== ']') throw new QuerySyntaxError('Expected "]"');
        index += 1;
        steps.push({ kind: 'key', name });
        continue;
      }

      const start = index;
      while (index < source.length && at() !== ']') index += 1;
      if (at() !== ']') throw new QuerySyntaxError('Expected "]"');
      const inner = source.slice(start, index).trim();
      index += 1;

      if (inner === '*') {
        steps.push({ kind: 'wildcard' });
        continue;
      }
      if (!/^-?\d+$/.test(inner)) {
        throw new QuerySyntaxError(
          `"${inner}" is not an index — use a number, "*", or a quoted name`,
        );
      }
      steps.push({ kind: 'index', index: Number(inner) });
      continue;
    }

    // A leading key with no dot, as in `users[0].name`.
    if (steps.length === 0 && index === 0) {
      steps.push({ kind: 'key', name: readBareKey() });
      continue;
    }

    throw new QuerySyntaxError(`Unexpected ${JSON.stringify(char)} in the query`);
  }

  return steps;
};

const applyStep = (matches: QueryMatch[], step: Step): QueryMatch[] => {
  const next: QueryMatch[] = [];

  for (const match of matches) {
    const { value, path } = match;

    if (step.kind === 'descend') {
      // Breadth-first so shallower hits are listed before deeper ones.
      const queue: QueryMatch[] = [match];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || !isContainer(current.value)) continue;
        for (const [label, child] of entriesOf(current.value)) {
          const isIndex = Array.isArray(current.value);
          const childPath = joinPath(current.path, label, isIndex);
          if (!isIndex && label === step.name) next.push({ path: childPath, value: child });
          if (isContainer(child)) queue.push({ path: childPath, value: child });
        }
      }
      continue;
    }

    if (!isContainer(value)) continue;

    if (step.kind === 'wildcard') {
      const isIndex = Array.isArray(value);
      for (const [label, child] of entriesOf(value)) {
        next.push({ path: joinPath(path, label, isIndex), value: child });
      }
      continue;
    }

    if (step.kind === 'index') {
      if (!Array.isArray(value)) continue;
      const resolved = step.index < 0 ? value.length + step.index : step.index;
      const child = value[resolved];
      if (child === undefined) continue;
      next.push({ path: joinPath(path, String(resolved), true), value: child });
      continue;
    }

    if (Array.isArray(value)) continue;
    if (!Object.hasOwn(value, step.name)) continue;
    const child = value[step.name];
    if (child === undefined) continue;
    next.push({ path: joinPath(path, step.name, false), value: child });
  }

  return next;
};

/** An empty query is the whole document, not an error. */
export const queryJson = (value: JsonValue, query: string): QueryResult => {
  const trimmed = query.trim();
  if (trimmed === '' || trimmed === '$') return { ok: true, matches: [{ path: '$', value }] };

  let steps: Step[];
  try {
    steps = parseQuery(trimmed);
  } catch (error) {
    if (error instanceof QuerySyntaxError) return { ok: false, message: error.message };
    throw error;
  }

  let matches: QueryMatch[] = [{ path: '$', value }];
  for (const step of steps) matches = applyStep(matches, step);

  return { ok: true, matches };
};
