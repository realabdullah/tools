import type { Path, PathSegment } from './edit';
import { joinPath } from './query';
import { childCount, entriesOf, isContainer, kindOf, type JsonKind, type JsonValue } from './types';

/**
 * The tree as a flat list of visible rows.
 *
 * Flat because it is what the DOM wants, and because a collapsed subtree then
 * costs nothing to skip rather than costing a render to hide.
 */

export type TreeRow =
  | {
      type: 'node';
      id: string;
      path: string;
      /** The same location as keys and indices, which is what edits need. */
      segments: Path;
      depth: number;
      label: string;
      labelKind: 'root' | 'key' | 'index';
      kind: JsonKind;
      value: JsonValue;
      expandable: boolean;
      expanded: boolean;
      childCount: number;
      /** True for the last child of its parent, so guides can stop cleanly. */
      last: boolean;
    }
  | {
      type: 'overflow';
      id: string;
      depth: number;
      hidden: number;
    };

/**
 * Children shown per container before the rest are summarised.
 *
 * A viewer that tries to render a 200,000-element array is not a viewer. The
 * raw view and the query bar are the honest ways to reach the rest, and the
 * overflow row says so.
 */
export const CHILD_LIMIT = 200;

type BuildOptions = {
  childLimit?: number;
  /**
   * When present, only these paths are rendered. Used by search to show the
   * hits and the branches leading to them, and nothing else.
   */
  visible?: ReadonlySet<string> | undefined;
};

export const buildRows = (
  root: JsonValue,
  expanded: ReadonlySet<string>,
  options: BuildOptions = {},
): TreeRow[] => {
  const limit = options.childLimit ?? CHILD_LIMIT;
  const visible = options.visible;
  const rows: TreeRow[] = [];

  const walk = (
    value: JsonValue,
    path: string,
    segments: PathSegment[],
    depth: number,
    label: string,
    labelKind: 'root' | 'key' | 'index',
    last: boolean,
  ): void => {
    const container = isContainer(value);
    const count = childCount(value);
    const isExpanded = container && count > 0 && expanded.has(path);

    rows.push({
      type: 'node',
      id: path,
      path,
      segments,
      depth,
      label,
      labelKind,
      kind: kindOf(value),
      value,
      expandable: container && count > 0,
      expanded: isExpanded,
      childCount: count,
      last,
    });

    if (!isExpanded || !container) return;

    const isIndexed = Array.isArray(value);
    const entries = entriesOf(value).filter(
      ([childLabel]) => visible === undefined || visible.has(joinPath(path, childLabel, isIndexed)),
    );
    const shown = Math.min(entries.length, limit);

    for (let index = 0; index < shown; index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      const [childLabel, child] = entry;
      walk(
        child,
        joinPath(path, childLabel, isIndexed),
        [...segments, isIndexed ? Number(childLabel) : childLabel],
        depth + 1,
        childLabel,
        isIndexed ? 'index' : 'key',
        index === entries.length - 1,
      );
    }

    if (entries.length > shown) {
      rows.push({
        type: 'overflow',
        id: `${path}#overflow`,
        depth: depth + 1,
        hidden: entries.length - shown,
      });
    }
  };

  walk(root, '$', [], 0, '$', 'root', true);
  return rows;
};

/**
 * Which nodes start open.
 *
 * Breadth-first within a row budget: shallow structure is what you want to see
 * first, and the budget means a small document opens fully while a large one
 * opens as far as it usefully can. Siblings that do not fit are simply left
 * closed rather than abandoning the level.
 */
export const defaultExpanded = (root: JsonValue, budget = 300): Set<string> => {
  const expanded = new Set<string>();
  if (!isContainer(root) || childCount(root) === 0) return expanded;

  let rows = 1;
  const queue: { value: JsonValue; path: string }[] = [{ value: root, path: '$' }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const count = childCount(current.value);
    if (count === 0 || rows + count > budget) continue;

    expanded.add(current.path);
    rows += count;

    if (!isContainer(current.value)) continue;
    const isIndexed = Array.isArray(current.value);
    for (const [label, child] of entriesOf(current.value)) {
      if (isContainer(child) && childCount(child) > 0) {
        queue.push({ value: child, path: joinPath(current.path, label, isIndexed) });
      }
    }
  }

  return expanded;
};

/** Every container path in the document — what "expand all" needs. */
export const allContainerPaths = (root: JsonValue, cap = 5000): Set<string> => {
  const paths = new Set<string>();
  const stack: { value: JsonValue; path: string }[] = [{ value: root, path: '$' }];

  while (stack.length > 0 && paths.size < cap) {
    const current = stack.pop();
    if (!current || !isContainer(current.value) || childCount(current.value) === 0) continue;

    paths.add(current.path);
    const isIndexed = Array.isArray(current.value);
    for (const [label, child] of entriesOf(current.value)) {
      if (isContainer(child))
        stack.push({ value: child, path: joinPath(current.path, label, isIndexed) });
    }
  }

  return paths;
};

/** One-line stand-in for a collapsed container. */
export const previewOf = (value: JsonValue): string => {
  // Counts are grouped, as they are everywhere else: "1000 items" is a number
  // to decode rather than read.
  if (Array.isArray(value)) {
    const count = value.length;
    return count === 0 ? '[]' : `[ ${count.toLocaleString()} ${count === 1 ? 'item' : 'items'} ]`;
  }
  if (value !== null && typeof value === 'object') {
    const count = Object.keys(value).length;
    return count === 0 ? '{}' : `{ ${count.toLocaleString()} ${count === 1 ? 'key' : 'keys'} }`;
  }
  return JSON.stringify(value) ?? String(value);
};
