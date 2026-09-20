import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useCopy } from '@/hooks/useCopy';
import { useTreeNavigation } from '@/hooks/useTreeNavigation';
import { cn } from '@/lib/cn';
import { buildDiffRows, type DiffNode, type DiffRow, type DiffStatus } from '../lib/diff';
import { previewOf } from '../lib/tree';
import { isContainer, type JsonValue } from '../lib/types';
import { ValueText } from './ValueText';

const INDENT = 14;

const STATUS_CLASS: Record<DiffStatus, string> = {
  added: 'text-success',
  removed: 'text-danger',
  changed: 'text-warning',
  unchanged: 'text-fg-subtle',
};

const MARKER: Record<DiffStatus, string> = {
  added: '+',
  removed: '−',
  changed: '~',
  unchanged: ' ',
};

type DiffTreeProps = {
  root: DiffNode;
  expanded: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onlyDifferences: boolean;
};

export const DiffTree = ({ root, expanded, onToggle, onlyDifferences }: DiffTreeProps) => {
  const rows = useMemo(
    () => buildDiffRows(root, expanded, onlyDifferences),
    [root, expanded, onlyDifferences],
  );
  const { copy } = useCopy();
  const { containerRef, activeId, setActiveId, onKeyDown } = useTreeNavigation(rows, {
    onToggle,
    onCopyPath: (path) => void copy(path),
  });

  if (rows.length === 0) {
    return (
      <p className="text-fg-subtle flex h-full items-center justify-center px-6 text-center text-xs">
        The two documents are identical.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="Differences"
      className="scroll-thin h-full overflow-auto py-1.5 font-mono text-sm"
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => (
        <DiffRowView
          key={row.id}
          row={row}
          active={row.id === activeId}
          onActivate={() => setActiveId(row.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

/** A changed leaf shows both sides; anything else shows the side it exists on. */
const sideValue = (row: DiffRow): JsonValue | undefined =>
  row.status === 'removed' ? row.left : row.right;

type DiffRowProps = {
  row: DiffRow;
  active: boolean;
  onActivate: () => void;
  onToggle: (path: string) => void;
};

const DiffRowView = ({ row, active, onActivate, onToggle }: DiffRowProps) => {
  const value = sideValue(row);
  const container = value !== undefined && isContainer(value);
  const showsBothSides = row.status === 'changed' && !row.expandable;

  return (
    <div
      role="treeitem"
      data-row-id={row.id}
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      tabIndex={active ? 0 : -1}
      onFocus={onActivate}
      onClick={() => row.expandable && onToggle(row.path)}
      className={cn(
        'focus-visible:bg-elevated flex h-6 items-center pr-2 outline-none',
        row.expandable && 'cursor-pointer',
        'hover:bg-elevated/60',
        row.status === 'added' && 'bg-success/8',
        row.status === 'removed' && 'bg-danger/8',
      )}
      style={{ paddingLeft: row.depth * INDENT + 6 }}
    >
      <span
        className={cn('text-2xs mr-1 w-3 shrink-0 text-center', STATUS_CLASS[row.status])}
        aria-hidden
      >
        {MARKER[row.status]}
      </span>

      {row.expandable ? (
        <ChevronRight
          size={12}
          aria-hidden
          className={cn(
            'text-fg-subtle mr-1 shrink-0 transition-transform duration-(--duration-fast)',
            row.expanded && 'rotate-90',
          )}
        />
      ) : (
        <span className="mr-1 w-3 shrink-0" />
      )}

      {row.labelKind === 'root' ? (
        <span className="text-fg-subtle">$</span>
      ) : (
        <>
          <span className={row.labelKind === 'index' ? 'text-fg-subtle' : 'text-accent'}>
            {row.labelKind === 'index' ? row.label : `"${row.label}"`}
          </span>
          <span className="text-fg-subtle">:</span>
        </>
      )}

      {showsBothSides ? (
        <span className="ml-1.5 flex min-w-0 items-center gap-1.5 truncate">
          <ValueText value={row.left ?? null} className="line-through opacity-60" />
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <ValueText value={row.right ?? null} />
          <span className="sr-only">changed</span>
        </span>
      ) : container ? (
        <span className="text-fg-subtle ml-1.5 truncate">{previewOf(value)}</span>
      ) : (
        <ValueText value={value ?? null} className="ml-1.5 truncate" />
      )}

      {row.status === 'added' || row.status === 'removed' ? (
        <span className="sr-only">{row.status}</span>
      ) : null}
    </div>
  );
};
