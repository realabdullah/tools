import { ChevronRight, Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { useCopy } from '@/hooks/useCopy';
import { useTreeNavigation } from '@/hooks/useTreeNavigation';
import { cn } from '@/lib/cn';
import { buildRows, previewOf, type TreeRow } from '../lib/tree';
import { isContainer, type JsonValue } from '../lib/types';
import { ValueText } from './ValueText';

type JsonTreeProps = {
  value: JsonValue;
  expanded: ReadonlySet<string>;
  onToggle: (path: string) => void;
  /** Expands or collapses a path and everything under it. */
  onToggleDeep: (path: string) => void;
};

const INDENT = 14;

type NodeRow = Extract<TreeRow, { type: 'node' }>;

export const JsonTree = ({ value, expanded, onToggle, onToggleDeep }: JsonTreeProps) => {
  const rows = useMemo(() => buildRows(value, expanded), [value, expanded]);
  const nodeRows = useMemo(() => rows.filter((row): row is NodeRow => row.type === 'node'), [rows]);
  const { copy } = useCopy();

  const { containerRef, activeId, setActiveId, onKeyDown } = useTreeNavigation(nodeRows, {
    onToggle,
    onCopyPath: (path) => void copy(path),
  });

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="JSON tree"
      className="scroll-thin h-full overflow-auto py-1.5 font-mono text-sm"
      onKeyDown={onKeyDown}
    >
      {rows.map((row) =>
        row.type === 'overflow' ? (
          <div
            key={row.id}
            className="text-2xs text-fg-subtle flex h-6 items-center"
            style={{ paddingLeft: row.depth * INDENT + 22 }}
          >
            {row.hidden.toLocaleString()} more — narrow it with a query, or use the raw view
          </div>
        ) : (
          <TreeNodeRow
            key={row.id}
            row={row}
            active={row.id === activeId}
            onActivate={() => setActiveId(row.id)}
            onToggle={onToggle}
            onToggleDeep={onToggleDeep}
            onCopyPath={() => void copy(row.path)}
          />
        ),
      )}
    </div>
  );
};

type RowProps = {
  row: NodeRow;
  active: boolean;
  onActivate: () => void;
  onToggle: (path: string) => void;
  onToggleDeep: (path: string) => void;
  onCopyPath: () => void;
};

const TreeNodeRow = ({ row, active, onActivate, onToggle, onToggleDeep, onCopyPath }: RowProps) => {
  const container = isContainer(row.value);

  return (
    <div
      role="treeitem"
      data-row-id={row.id}
      aria-level={row.depth + 1}
      aria-expanded={row.expandable ? row.expanded : undefined}
      aria-label={`${row.labelKind === 'root' ? 'root' : row.label}: ${
        container ? previewOf(row.value) : JSON.stringify(row.value)
      }`}
      tabIndex={active ? 0 : -1}
      onFocus={onActivate}
      onClick={(event) => {
        if (!row.expandable) return;
        // Alt-click opens or closes the whole subtree, which is what you want
        // the moment a document is more than two levels deep.
        if (event.altKey) onToggleDeep(row.path);
        else onToggle(row.path);
      }}
      className={cn(
        'group relative flex h-6 items-center pr-2 outline-none',
        row.expandable && 'cursor-pointer',
        'hover:bg-elevated/60 focus-visible:bg-elevated',
      )}
      style={{ paddingLeft: row.depth * INDENT + 6 }}
    >
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

      <span className="ml-1.5 min-w-0 truncate">
        {container ? (
          <span className="text-fg-subtle">{previewOf(row.value)}</span>
        ) : (
          <ValueText value={row.value} />
        )}
      </span>

      <button
        type="button"
        tabIndex={-1}
        aria-label={`Copy path ${row.path}`}
        title={row.path}
        onClick={(event) => {
          event.stopPropagation();
          onCopyPath();
        }}
        className="text-fg-subtle hover:text-fg ml-auto shrink-0 rounded-xs p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Link2 size={11} aria-hidden />
      </button>
    </div>
  );
};
