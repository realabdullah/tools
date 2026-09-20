import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

export type NavigableRow = {
  id: string;
  path: string;
  depth: number;
  expandable: boolean;
  expanded: boolean;
};

type Options = {
  onToggle: (path: string) => void;
  /** Bound to `c`, because the path is the thing you came to fetch. */
  onCopyPath?: ((path: string) => void) | undefined;
};

/**
 * Roving-tabindex keyboard behaviour for a `role="tree"`.
 *
 * One row is tabbable at a time; arrows walk and open it. Shared by the JSON
 * tree and the diff tree, which is why it lives here rather than inside either
 * of them — a tree you can only reach with a mouse is not finished.
 */
export const useTreeNavigation = (
  rows: readonly NavigableRow[],
  { onToggle, onCopyPath }: Options,
) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const index = Math.max(
    0,
    rows.findIndex((row) => row.id === activeId),
  );
  const activeRow = rows[index] ?? rows[0];

  const focusRow = useCallback((id: string) => {
    setActiveId(id);
    // The row may have only just appeared, from the expand that preceded this.
    queueMicrotask(() => {
      containerRef.current
        ?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!activeRow || rows.length === 0) return;

      const move = (delta: number): void => {
        const next = rows[Math.min(Math.max(index + delta, 0), rows.length - 1)];
        if (next) focusRow(next.id);
      };

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          move(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          move(-1);
          break;
        case 'Home':
          event.preventDefault();
          if (rows[0]) focusRow(rows[0].id);
          break;
        case 'End':
          event.preventDefault();
          if (rows.at(-1)) focusRow(rows.at(-1)?.id ?? '');
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (activeRow.expandable && !activeRow.expanded) onToggle(activeRow.path);
          else move(1);
          break;
        case 'ArrowLeft': {
          event.preventDefault();
          if (activeRow.expandable && activeRow.expanded) {
            onToggle(activeRow.path);
            break;
          }
          const parent = rows
            .slice(0, index)
            .reverse()
            .find((row) => row.depth === activeRow.depth - 1);
          if (parent) focusRow(parent.id);
          break;
        }
        case 'Enter':
        case ' ':
          if (activeRow.expandable) {
            event.preventDefault();
            onToggle(activeRow.path);
          }
          break;
        case 'c':
          if (event.metaKey || event.ctrlKey) return; // leave native copy alone
          event.preventDefault();
          onCopyPath?.(activeRow.path);
          break;
        default:
          break;
      }
    },
    [activeRow, rows, index, focusRow, onToggle, onCopyPath],
  );

  return {
    containerRef,
    /** The row that currently owns the tab stop. */
    activeId: activeRow?.id,
    setActiveId,
    onKeyDown,
  };
};
