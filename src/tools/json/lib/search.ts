import { joinPath } from './query';
import { entriesOf, isContainer, type JsonValue } from './types';

export type TreeSearch = {
  /** Paths whose key or value contains the term. */
  matches: Set<string>;
  /** Matches plus every ancestor, which is what has to stay on screen. */
  visible: Set<string>;
  /** Containers that must be open for the matches to be reachable. */
  expand: Set<string>;
};

export const EMPTY_SEARCH: TreeSearch = {
  matches: new Set(),
  visible: new Set(),
  expand: new Set(),
};

const contains = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle);

/**
 * Finds keys and primitive values containing `query`.
 *
 * Keeps ancestors so a match deep in a document is shown in its context rather
 * than as a floating row, and reports which containers to open to reach it.
 */
export const searchJson = (root: JsonValue, query: string): TreeSearch => {
  const needle = query.trim().toLowerCase();
  if (needle === '') return EMPTY_SEARCH;

  const matches = new Set<string>();
  const visible = new Set<string>();
  const expand = new Set<string>();

  const walk = (value: JsonValue, path: string, label: string, ancestors: string[]): void => {
    const labelHit = label !== '' && contains(label, needle);
    const valueHit = !isContainer(value) && contains(JSON.stringify(value) ?? '', needle);

    if (labelHit || valueHit) {
      matches.add(path);
      visible.add(path);
      for (const ancestor of ancestors) {
        visible.add(ancestor);
        expand.add(ancestor);
      }
    }

    if (!isContainer(value)) return;
    const isIndexed = Array.isArray(value);
    const nextAncestors = [...ancestors, path];
    for (const [childLabel, child] of entriesOf(value)) {
      walk(
        child,
        joinPath(path, childLabel, isIndexed),
        isIndexed ? '' : childLabel,
        nextAncestors,
      );
    }
  };

  walk(root, '$', '', []);
  return { matches, visible, expand };
};
