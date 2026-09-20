import { childCount, entriesOf, isContainer, type JsonValue } from './types';

/**
 * Indentation is the only formatting choice, and minifying is simply its
 * tightest setting. That is why there is no separate "minify" mode: you pick
 * how wide the output is and copy what you see.
 */
export type IndentStyle = '2' | '4' | 'tab' | 'min';

export const INDENT_STYLES: readonly IndentStyle[] = ['2', '4', 'tab', 'min'];

const SPACERS: Record<IndentStyle, string | number> = {
  '2': 2,
  '4': 4,
  tab: '\t',
  min: 0,
};

export const formatJson = (value: JsonValue, style: IndentStyle): string =>
  JSON.stringify(value, null, SPACERS[style]);

export type JsonStats = {
  /** Total values, containers included. */
  nodes: number;
  /** Deepest nesting level; a scalar document is 0. */
  depth: number;
  keys: number;
  items: number;
};

export const summarise = (value: JsonValue): JsonStats => {
  const stats: JsonStats = { nodes: 0, depth: 0, keys: 0, items: 0 };

  // Explicit stack: a deeply nested document must not blow the call stack.
  const stack: { value: JsonValue; depth: number }[] = [{ value, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;

    stats.nodes += 1;
    if (current.depth > stats.depth) stats.depth = current.depth;

    if (!isContainer(current.value)) continue;
    if (Array.isArray(current.value)) stats.items += childCount(current.value);
    else stats.keys += childCount(current.value);

    for (const [, child] of entriesOf(current.value)) {
      stack.push({ value: child, depth: current.depth + 1 });
    }
  }

  return stats;
};
