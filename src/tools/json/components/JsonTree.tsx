import { ChevronRight, ExternalLink, Link2, MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Menu, MenuItem, MenuLabel, MenuRadioItem, MenuSeparator } from '@/components/ui/Menu';
import { useCopy } from '@/hooks/useCopy';
import { useTreeNavigation } from '@/hooks/useTreeNavigation';
import { cn } from '@/lib/cn';
import { formatJson } from '../lib/format';
import type { Path } from '../lib/edit';
import { buildRows, previewOf, type TreeRow } from '../lib/tree';
import { isContainer, kindOf, type JsonKind, type JsonValue } from '../lib/types';
import { Highlight } from './Highlight';
import { KeyEditor, ValueEditor } from './ValueEditor';
import { ValueText } from './ValueText';

/** Every edit the tree can ask the workspace to make. */
export type TreeEdit =
  | { kind: 'set'; path: Path; value: JsonValue }
  | { kind: 'rename'; path: Path; name: string }
  | { kind: 'remove'; path: Path }
  | { kind: 'duplicate'; path: Path }
  | { kind: 'append'; path: Path; valueKind: JsonKind }
  | { kind: 'convert'; path: Path; valueKind: JsonKind }
  | { kind: 'sort'; path: Path };

type JsonTreeProps = {
  value: JsonValue;
  expanded: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onToggleDeep: (path: string) => void;
  visible?: ReadonlySet<string> | undefined;
  query?: string;
  /** Absent while the tree is showing a derived value, which cannot be edited. */
  onEdit?: ((edit: TreeEdit) => void) | undefined;
};

const INDENT = 15;
const GUTTER = 10;

type NodeRow = Extract<TreeRow, { type: 'node' }>;

const KINDS: readonly JsonKind[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];

/** Only http(s), so a value can never turn into a javascript: link. */
const linkFor = (value: JsonValue): string | null => {
  if (typeof value !== 'string') return null;
  return /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null;
};

export const JsonTree = ({
  value,
  expanded,
  onToggle,
  onToggleDeep,
  visible,
  query = '',
  onEdit,
}: JsonTreeProps) => {
  const rows = useMemo(() => buildRows(value, expanded, { visible }), [value, expanded, visible]);
  const nodeRows = useMemo(() => rows.filter((row): row is NodeRow => row.type === 'node'), [rows]);
  const [editing, setEditing] = useState<{ id: string; field: 'key' | 'value' } | null>(null);
  const { copy } = useCopy();

  const { containerRef, activeId, setActiveId, onKeyDown } = useTreeNavigation(nodeRows, {
    onToggle,
    onCopyPath: (path) => void copy(path),
  });

  if (rows.length === 0) {
    return (
      <p className="text-fg-subtle flex h-full items-center justify-center px-6 text-center text-xs">
        Nothing matches “{query}”.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="JSON tree"
      className="scroll-thin h-full overflow-auto py-1.5 font-mono text-sm"
      onKeyDown={editing ? undefined : onKeyDown}
    >
      {rows.map((row) =>
        row.type === 'overflow' ? (
          <div
            key={row.id}
            className="text-2xs text-fg-subtle flex h-[26px] items-center"
            style={{ paddingLeft: row.depth * INDENT + GUTTER + 18 }}
          >
            {row.hidden.toLocaleString()} more — narrow it with a filter, or use the raw view
          </div>
        ) : (
          <TreeNodeRow
            key={row.id}
            row={row}
            active={row.id === activeId}
            query={query}
            editing={editing?.id === row.id ? editing.field : null}
            onStartEdit={(field) => onEdit && setEditing({ id: row.id, field })}
            onStopEdit={() => setEditing(null)}
            onActivate={() => setActiveId(row.id)}
            onToggle={onToggle}
            onToggleDeep={onToggleDeep}
            onCopyPath={() => void copy(row.path)}
            onCopyValue={() => void copy(formatJson(row.value, '2'))}
            onEdit={onEdit}
          />
        ),
      )}
    </div>
  );
};

type RowProps = {
  row: NodeRow;
  active: boolean;
  query: string;
  editing: 'key' | 'value' | null;
  onStartEdit: (field: 'key' | 'value') => void;
  onStopEdit: () => void;
  onActivate: () => void;
  onToggle: (path: string) => void;
  onToggleDeep: (path: string) => void;
  onCopyPath: () => void;
  onCopyValue: () => void;
  onEdit: ((edit: TreeEdit) => void) | undefined;
};

const TreeNodeRow = ({
  row,
  active,
  query,
  editing,
  onStartEdit,
  onStopEdit,
  onActivate,
  onToggle,
  onToggleDeep,
  onCopyPath,
  onCopyValue,
  onEdit,
}: RowProps) => {
  const container = isContainer(row.value);
  const editable = onEdit !== undefined;
  const link = linkFor(row.value);

  const apply = (edit: TreeEdit) => {
    onEdit?.(edit);
    onStopEdit();
  };

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
        if (!row.expandable || editing) return;
        if (event.altKey) onToggleDeep(row.path);
        else onToggle(row.path);
      }}
      className={cn(
        'group relative flex h-[26px] items-center pr-1 outline-none',
        row.expandable && !editing && 'cursor-pointer',
        'hover:bg-elevated/70 focus-visible:bg-elevated',
      )}
      style={{ paddingLeft: row.depth * INDENT + GUTTER }}
    >
      {Array.from({ length: row.depth }, (_, level) => (
        <span
          key={level}
          aria-hidden
          className="bg-border-strong/80 absolute top-0 bottom-0 w-px"
          style={{ left: level * INDENT + GUTTER + 5 }}
        />
      ))}

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
      ) : editing === 'key' && row.labelKind === 'key' ? (
        <KeyEditor
          name={row.label}
          onCommit={(name) => apply({ kind: 'rename', path: row.segments, name })}
          onCancel={onStopEdit}
        />
      ) : (
        <>
          <span
            className={cn(
              row.labelKind === 'index' ? 'text-fg-subtle' : 'text-syntax-key',
              editable && row.labelKind === 'key' && 'cursor-text hover:underline',
            )}
            onClick={(event) => {
              if (!editable || row.labelKind !== 'key') return;
              event.stopPropagation();
              onStartEdit('key');
            }}
          >
            {row.labelKind === 'index' ? row.label : `"`}
            {row.labelKind === 'index' ? null : <Highlight text={row.label} query={query} />}
            {row.labelKind === 'index' ? null : `"`}
          </span>
          <span className="text-syntax-punctuation">:</span>
        </>
      )}

      <span className="ml-1.5 flex min-w-0 flex-1 items-center gap-1.5">
        {container ? (
          <span className="text-fg-subtle truncate">{previewOf(row.value)}</span>
        ) : editing === 'value' ? (
          <ValueEditor
            value={row.value}
            onCommit={(next) => apply({ kind: 'set', path: row.segments, value: next })}
            onCancel={onStopEdit}
          />
        ) : typeof row.value === 'boolean' && editable ? (
          <label className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={row.value}
              aria-label={`Toggle ${row.label}`}
              onChange={(event) =>
                onEdit?.({ kind: 'set', path: row.segments, value: event.target.checked })
              }
              className="accent-accent size-3"
            />
            <ValueText value={row.value} query={query} />
          </label>
        ) : (
          <span
            className={cn('min-w-0 truncate', editable && 'cursor-text')}
            onClick={(event) => {
              if (!editable) return;
              event.stopPropagation();
              onStartEdit('value');
            }}
          >
            <ValueText value={row.value} query={query} />
          </span>
        )}

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Open ${link}`}
            className="text-fg-subtle hover:text-accent shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <ExternalLink size={11} aria-hidden />
          </a>
        ) : null}
      </span>

      <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[open=true]:opacity-100">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Copy path ${row.path}`}
          title={row.path}
          onClick={(event) => {
            event.stopPropagation();
            onCopyPath();
          }}
          className="text-fg-subtle hover:text-fg rounded-xs p-1"
        >
          <Link2 size={11} aria-hidden />
        </button>

        <Menu
          trigger={
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Actions for ${row.path}`}
              onClick={(event) => event.stopPropagation()}
              className="text-fg-subtle hover:text-fg rounded-xs p-1"
            >
              <MoreHorizontal size={11} aria-hidden />
            </button>
          }
        >
          {editable && container ? (
            <>
              <MenuLabel>Add</MenuLabel>
              {KINDS.map((valueKind) => (
                <MenuItem
                  key={valueKind}
                  onSelect={() => apply({ kind: 'append', path: row.segments, valueKind })}
                >
                  {valueKind}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => apply({ kind: 'sort', path: row.segments })}>
                Sort contents
              </MenuItem>
              <MenuSeparator />
            </>
          ) : null}

          {editable && !container ? (
            <>
              <MenuLabel>Change type</MenuLabel>
              {KINDS.map((valueKind) => (
                <MenuRadioItem
                  key={valueKind}
                  checked={kindOf(row.value) === valueKind}
                  onSelect={() => apply({ kind: 'convert', path: row.segments, valueKind })}
                >
                  {valueKind}
                </MenuRadioItem>
              ))}
              <MenuSeparator />
            </>
          ) : null}

          <MenuItem onSelect={onCopyValue}>Copy value</MenuItem>
          <MenuItem onSelect={onCopyPath}>Copy path</MenuItem>

          {editable && row.labelKind !== 'root' ? (
            <>
              <MenuSeparator />
              <MenuItem onSelect={() => apply({ kind: 'duplicate', path: row.segments })}>
                Duplicate
              </MenuItem>
              <MenuItem onSelect={() => apply({ kind: 'remove', path: row.segments })}>
                Remove
              </MenuItem>
            </>
          ) : null}
        </Menu>
      </span>
    </div>
  );
};
