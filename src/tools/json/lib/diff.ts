import { joinPath } from './query';
import { childCount, isContainer, type JsonValue } from './types';

/**
 * Structural comparison of two documents.
 *
 * Objects compare by key. Arrays are the interesting case: comparing them
 * index by index reports everything after an inserted element as changed,
 * which is noise rather than a diff. So identical elements are anchored with
 * an LCS first, and whatever is left inside a gap is paired up positionally —
 * an edited element then reads as one change instead of a delete and an add.
 */

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export type DiffNode = {
  id: string;
  path: string;
  label: string;
  labelKind: 'root' | 'key' | 'index';
  status: DiffStatus;
  left: JsonValue | undefined;
  right: JsonValue | undefined;
  children: DiffNode[];
  /** This node or something under it differs. */
  differs: boolean;
};

export type DiffSummary = { added: number; removed: number; changed: number };

export type JsonDiff = { root: DiffNode; summary: DiffSummary };

/** Beyond this the DP table is not worth building; fall back to positional. */
const LCS_CELL_LIMIT = 250_000;

export const deepEqual = (a: JsonValue, b: JsonValue): boolean => {
  const stack: [JsonValue, JsonValue][] = [[a, b]];

  while (stack.length > 0) {
    const pair = stack.pop();
    if (!pair) break;
    const [left, right] = pair;

    if (left === right) continue;
    if (!isContainer(left) || !isContainer(right)) return false;

    const leftIsArray = Array.isArray(left);
    if (leftIsArray !== Array.isArray(right)) return false;

    if (leftIsArray && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      for (let index = 0; index < left.length; index += 1) {
        stack.push([left[index] as JsonValue, right[index] as JsonValue]);
      }
      continue;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    for (const key of leftKeys) {
      if (!Object.hasOwn(right, key)) return false;
      stack.push([
        (left as Record<string, JsonValue>)[key] as JsonValue,
        (right as Record<string, JsonValue>)[key] as JsonValue,
      ]);
    }
  }

  return true;
};

type Op =
  | { kind: 'keep'; left: number; right: number }
  | { kind: 'remove'; left: number }
  | { kind: 'add'; right: number }
  | { kind: 'pair'; left: number; right: number };

const positionalOps = (left: JsonValue[], right: JsonValue[]): Op[] => {
  const ops: Op[] = [];
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (index < left.length && index < right.length)
      ops.push({ kind: 'pair', left: index, right: index });
    else if (index < left.length) ops.push({ kind: 'remove', left: index });
    else ops.push({ kind: 'add', right: index });
  }
  return ops;
};

const lcsOps = (left: JsonValue[], right: JsonValue[]): Op[] => {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = new Int32Array(rows * columns);

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] = deepEqual(left[i] as JsonValue, right[j] as JsonValue)
        ? (table[(i + 1) * columns + (j + 1)] ?? 0) + 1
        : Math.max(table[(i + 1) * columns + j] ?? 0, table[i * columns + (j + 1)] ?? 0);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (deepEqual(left[i] as JsonValue, right[j] as JsonValue)) {
      ops.push({ kind: 'keep', left: i, right: j });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * columns + j] ?? 0) >= (table[i * columns + (j + 1)] ?? 0)) {
      ops.push({ kind: 'remove', left: i });
      i += 1;
    } else {
      ops.push({ kind: 'add', right: j });
      j += 1;
    }
  }
  while (i < left.length) ops.push({ kind: 'remove', left: i++ });
  while (j < right.length) ops.push({ kind: 'add', right: j++ });

  return ops;
};

/**
 * Turns runs of removals immediately followed by additions into pairs, so an
 * element that was edited reads as one changed entry rather than two.
 */
const pairGaps = (ops: Op[]): Op[] => {
  const result: Op[] = [];
  let removed: number[] = [];
  let added: number[] = [];

  const flush = (): void => {
    const paired = Math.min(removed.length, added.length);
    for (let index = 0; index < paired; index += 1) {
      result.push({ kind: 'pair', left: removed[index] as number, right: added[index] as number });
    }
    for (const left of removed.slice(paired)) result.push({ kind: 'remove', left });
    for (const right of added.slice(paired)) result.push({ kind: 'add', right });
    removed = [];
    added = [];
  };

  for (const op of ops) {
    if (op.kind === 'remove') removed.push(op.left);
    else if (op.kind === 'add') added.push(op.right);
    else {
      flush();
      result.push(op);
    }
  }
  flush();

  return result;
};

const alignArrays = (left: JsonValue[], right: JsonValue[]): Op[] =>
  left.length * right.length > LCS_CELL_LIMIT
    ? positionalOps(left, right)
    : pairGaps(lcsOps(left, right));

type Label = { path: string; label: string; labelKind: 'root' | 'key' | 'index' };

/** A whole subtree that exists on only one side. */
const markAll = (value: JsonValue, status: 'added' | 'removed', label: Label): DiffNode => {
  const children: DiffNode[] = [];

  if (isContainer(value)) {
    const isIndexed = Array.isArray(value);
    const entries: [string, JsonValue][] = isIndexed
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);

    for (const [childLabel, child] of entries) {
      children.push(
        markAll(child, status, {
          path: joinPath(label.path, childLabel, isIndexed),
          label: childLabel,
          labelKind: isIndexed ? 'index' : 'key',
        }),
      );
    }
  }

  return {
    id: label.path,
    path: label.path,
    label: label.label,
    labelKind: label.labelKind,
    status,
    left: status === 'removed' ? value : undefined,
    right: status === 'added' ? value : undefined,
    children,
    differs: true,
  };
};

const diffValue = (left: JsonValue, right: JsonValue, label: Label): DiffNode => {
  const bothObjects =
    isContainer(left) && isContainer(right) && !Array.isArray(left) && !Array.isArray(right);
  const bothArrays = Array.isArray(left) && Array.isArray(right);

  if (bothObjects) {
    const leftRecord = left as Record<string, JsonValue>;
    const rightRecord = right as Record<string, JsonValue>;
    // Left order first so the document you started from stays readable.
    const keys = [
      ...Object.keys(leftRecord),
      ...Object.keys(rightRecord).filter((key) => !Object.hasOwn(leftRecord, key)),
    ];

    const children = keys.map((key) => {
      const childLabel: Label = {
        path: joinPath(label.path, key, false),
        label: key,
        labelKind: 'key',
      };
      if (!Object.hasOwn(rightRecord, key))
        return markAll(leftRecord[key] as JsonValue, 'removed', childLabel);
      if (!Object.hasOwn(leftRecord, key))
        return markAll(rightRecord[key] as JsonValue, 'added', childLabel);
      return diffValue(leftRecord[key] as JsonValue, rightRecord[key] as JsonValue, childLabel);
    });

    const differs = children.some((child) => child.differs);
    return {
      id: label.path,
      path: label.path,
      label: label.label,
      labelKind: label.labelKind,
      status: differs ? 'changed' : 'unchanged',
      left,
      right,
      children,
      differs,
    };
  }

  if (bothArrays) {
    const children = alignArrays(left, right).map((op) => {
      const index = op.kind === 'remove' ? op.left : op.right;
      const childLabel: Label = {
        path: joinPath(label.path, String(index), true),
        label: String(index),
        labelKind: 'index',
      };

      if (op.kind === 'remove') return markAll(left[op.left] as JsonValue, 'removed', childLabel);
      if (op.kind === 'add') return markAll(right[op.right] as JsonValue, 'added', childLabel);
      return diffValue(left[op.left] as JsonValue, right[op.right] as JsonValue, childLabel);
    });

    const differs = children.some((child) => child.differs) || left.length !== right.length;
    return {
      id: label.path,
      path: label.path,
      label: label.label,
      labelKind: label.labelKind,
      status: differs ? 'changed' : 'unchanged',
      left,
      right,
      children,
      differs,
    };
  }

  const equal = deepEqual(left, right);
  return {
    id: label.path,
    path: label.path,
    label: label.label,
    labelKind: label.labelKind,
    status: equal ? 'unchanged' : 'changed',
    left,
    right,
    children: [],
    differs: !equal,
  };
};

/** Counts the outermost change of each kind, not every node beneath it. */
const summarise = (node: DiffNode): DiffSummary => {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0 };

  const walk = (current: DiffNode): void => {
    if (current.status === 'added') {
      summary.added += 1;
      return;
    }
    if (current.status === 'removed') {
      summary.removed += 1;
      return;
    }
    if (current.status === 'changed' && current.children.length === 0) {
      summary.changed += 1;
      return;
    }
    for (const child of current.children) walk(child);
  };

  walk(node);
  return summary;
};

export const diffJson = (left: JsonValue, right: JsonValue): JsonDiff => {
  const root = diffValue(left, right, { path: '$', label: '$', labelKind: 'root' });
  return { root, summary: summarise(root) };
};

// --- rendering model ---------------------------------------------------------

export type DiffRow = {
  id: string;
  path: string;
  depth: number;
  label: string;
  labelKind: 'root' | 'key' | 'index';
  status: DiffStatus;
  left: JsonValue | undefined;
  right: JsonValue | undefined;
  expandable: boolean;
  expanded: boolean;
  childCount: number;
  differs: boolean;
};

export const buildDiffRows = (
  root: DiffNode,
  expanded: ReadonlySet<string>,
  onlyDifferences: boolean,
): DiffRow[] => {
  const rows: DiffRow[] = [];

  const walk = (node: DiffNode, depth: number): void => {
    if (onlyDifferences && !node.differs) return;

    const visibleChildren = onlyDifferences
      ? node.children.filter((child) => child.differs)
      : node.children;
    const isExpanded = visibleChildren.length > 0 && expanded.has(node.path);

    rows.push({
      id: node.id,
      path: node.path,
      depth,
      label: node.label,
      labelKind: node.labelKind,
      status: node.status,
      left: node.left,
      right: node.right,
      expandable: visibleChildren.length > 0,
      expanded: isExpanded,
      childCount: visibleChildren.length,
      differs: node.differs,
    });

    if (!isExpanded) return;
    for (const child of visibleChildren) walk(child, depth + 1);
  };

  walk(root, 0);
  return rows;
};

/**
 * Opens the document along the paths that changed, so a diff arrives already
 * showing its differences instead of a collapsed root.
 */
export const expandedForChanges = (root: DiffNode, budget = 400): Set<string> => {
  const expanded = new Set<string>();
  let rows = 1;

  const walk = (node: DiffNode): void => {
    if (node.children.length === 0 || rows > budget) return;
    if (!node.differs && node.path !== '$') return;

    expanded.add(node.path);
    rows += node.children.length;
    for (const child of node.children) walk(child);
  };

  walk(root);
  return expanded;
};

export const hasChildren = (node: DiffNode): boolean => node.children.length > 0;

export const countOf = (value: JsonValue | undefined): number =>
  value === undefined ? 0 : childCount(value);
