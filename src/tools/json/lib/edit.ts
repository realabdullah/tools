import { isContainer, kindOf, type JsonKind, type JsonValue } from './types';

/**
 * Structural edits, as pure functions.
 *
 * A path is a list of keys and indices rather than the display string: the
 * display string exists to be read and copied, and re-parsing it to find a
 * node would make `$["a.b"]` ambiguous with `$.a.b`.
 *
 * Every function returns a new document and shares everything it did not
 * touch, so undo is a matter of keeping the old reference.
 */
export type PathSegment = string | number;
export type Path = readonly PathSegment[];

export const getAt = (root: JsonValue, path: Path): JsonValue | undefined => {
  let current: JsonValue | undefined = root;

  for (const segment of path) {
    if (current === undefined || !isContainer(current)) return undefined;
    if (typeof segment === 'number') {
      current = Array.isArray(current) ? current[segment] : undefined;
    } else {
      current = Array.isArray(current) ? undefined : current[segment];
    }
  }

  return current;
};

/** Replaces the value at `path`. An unreachable path leaves the document alone. */
export const setAt = (root: JsonValue, path: Path, value: JsonValue): JsonValue => {
  if (path.length === 0) return value;

  const [head, ...rest] = path;
  if (head === undefined) return root;

  if (typeof head === 'number') {
    if (!Array.isArray(root) || head < 0 || head >= root.length) return root;
    const child = root[head] as JsonValue;
    const updated = setAt(child, rest, value);
    // Nothing below changed, so nothing above needs rebuilding either.
    if (updated === child) return root;

    const next = [...root];
    next[head] = updated;
    return next;
  }

  if (!isContainer(root) || Array.isArray(root)) return root;
  if (!Object.hasOwn(root, head)) return root;

  const child = root[head] as JsonValue;
  const updated = setAt(child, rest, value);
  if (updated === child) return root;
  return { ...root, [head]: updated };
};

export const removeAt = (root: JsonValue, path: Path): JsonValue => {
  if (path.length === 0) return root;

  const parentPath = path.slice(0, -1);
  const last = path.at(-1);
  if (last === undefined) return root;

  const parent = getAt(root, parentPath);
  if (parent === undefined || !isContainer(parent)) return root;

  if (typeof last === 'number') {
    if (!Array.isArray(parent)) return root;
    return setAt(
      root,
      parentPath,
      parent.filter((_, index) => index !== last),
    );
  }

  if (Array.isArray(parent)) return root;

  const rest: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(parent)) {
    if (key !== last) rest[key] = value;
  }
  return setAt(root, parentPath, rest);
};

/**
 * Renames a key, keeping its position.
 *
 * Object key order is not semantic in JSON, but it is how the document reads,
 * and a rename that jumped the key to the end would look like a move.
 */
export const renameAt = (root: JsonValue, path: Path, name: string): JsonValue => {
  const parentPath = path.slice(0, -1);
  const last = path.at(-1);
  if (typeof last !== 'string' || name === '' || name === last) return root;

  const parent = getAt(root, parentPath);
  if (parent === undefined || !isContainer(parent) || Array.isArray(parent)) return root;
  if (!Object.hasOwn(parent, last)) return root;

  const renamed: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(parent)) {
    renamed[key === last ? name : key] = value;
  }

  return setAt(root, parentPath, renamed);
};

/** Copies an entry in beside itself. Object keys gain a " copy" suffix. */
export const duplicateAt = (root: JsonValue, path: Path): JsonValue => {
  const parentPath = path.slice(0, -1);
  const last = path.at(-1);
  if (last === undefined) return root;

  const parent = getAt(root, parentPath);
  const value = getAt(root, path);
  if (parent === undefined || value === undefined || !isContainer(parent)) return root;

  if (typeof last === 'number') {
    if (!Array.isArray(parent)) return root;
    const next = [...parent];
    next.splice(last + 1, 0, structuredClone(value));
    return setAt(root, parentPath, next);
  }

  if (Array.isArray(parent)) return root;

  let name = `${last} copy`;
  let suffix = 2;
  while (Object.hasOwn(parent, name)) name = `${last} copy ${String(suffix++)}`;

  // Rebuilt rather than spread so the copy sits next to its original.
  const next: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(parent)) {
    next[key] = entry;
    if (key === last) next[name] = structuredClone(value);
  }
  return setAt(root, parentPath, next);
};

const EMPTY: Record<JsonKind, JsonValue> = {
  string: '',
  number: 0,
  boolean: false,
  null: null,
  object: {},
  array: [],
};

/** Adds an entry to a container. Returns the document and the new path. */
export const appendTo = (
  root: JsonValue,
  containerPath: Path,
  kind: JsonKind = 'string',
): { document: JsonValue; path: Path } => {
  const container = getAt(root, containerPath);
  if (container === undefined || !isContainer(container))
    return { document: root, path: containerPath };

  const value = EMPTY[kind];

  if (Array.isArray(container)) {
    const path = [...containerPath, container.length];
    return { document: setAt(root, containerPath, [...container, value]), path };
  }

  let name = 'key';
  let suffix = 2;
  while (Object.hasOwn(container, name)) name = `key ${String(suffix++)}`;

  return {
    document: setAt(root, containerPath, { ...container, [name]: value }),
    path: [...containerPath, name],
  };
};

/**
 * Changes a value's type, keeping whatever meaning survives the change.
 *
 * "1" becomes 1, not 0, and true becomes "true", because the point of the
 * conversion is usually that the document has the right data in the wrong
 * type — most often a number that arrived as a string.
 */
export const convertAt = (root: JsonValue, path: Path, kind: JsonKind): JsonValue => {
  const value = getAt(root, path);
  if (value === undefined || kindOf(value) === kind) return root;

  return setAt(root, path, coerce(value, kind));
};

export const coerce = (value: JsonValue, kind: JsonKind): JsonValue => {
  switch (kind) {
    case 'string':
      return typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
    case 'number': {
      // Only text can become a number; a container has no numeric reading.
      const numeric = typeof value === 'string' ? Number(value) : Number.NaN;
      return typeof value === 'number' ? value : Number.isFinite(numeric) ? numeric : 0;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value !== '' && value !== 'false';
      if (typeof value === 'number') return value !== 0;
      return value !== null;
    case 'null':
      return null;
    case 'object':
      return isContainer(value) && !Array.isArray(value) ? value : {};
    case 'array':
      return Array.isArray(value) ? value : isContainer(value) ? Object.values(value) : [value];
  }
};

/**
 * Reads what the user typed into a value field.
 *
 * A string stays a string — editing "5" in a name field must not silently make
 * it a number. Any other type is re-read as JSON, so `12`, `true` and `null`
 * keep working, and anything unparseable becomes a string.
 */
export const parseEdited = (text: string, previous: JsonValue): JsonValue => {
  if (typeof previous === 'string') return text;

  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return text;
  }
};

/** How a value is shown in an edit field. Strings appear without their quotes. */
export const editableText = (value: JsonValue): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
