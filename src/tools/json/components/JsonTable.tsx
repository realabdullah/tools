import { ArrowDown, ArrowUp, Link2 } from 'lucide-react';
import { useMemo } from 'react';
import { useCopy } from '@/hooks/useCopy';
import { cn } from '@/lib/cn';
import { joinPath } from '../lib/query';
import { toTable, type TableSort } from '../lib/table';
import { isContainer, type JsonValue } from '../lib/types';
import { previewOf } from '../lib/tree';
import { Highlight } from './Highlight';
import { ValueText } from './ValueText';

type JsonTableProps = {
  value: JsonValue;
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  query?: string;
};

/** asc -> desc -> off, which is what clicking a column header should cycle. */
const nextSort = (current: TableSort, column: string): TableSort => {
  if (current?.column !== column) return { column, direction: 'asc' };
  if (current.direction === 'asc') return { column, direction: 'desc' };
  return null;
};

export const JsonTable = ({ value, sort, onSort, query = '' }: JsonTableProps) => {
  const table = useMemo(() => toTable(value, { sort }), [value, sort]);
  const { copy } = useCopy();

  if (!table) return null;

  return (
    <div className="scroll-thin h-full overflow-auto">
      <table className="w-full border-collapse text-left font-mono text-xs">
        <thead className="bg-surface sticky top-0 z-10">
          <tr>
            <th
              scope="col"
              className="border-border text-2xs text-fg-subtle border-r border-b px-2 py-1.5 font-medium"
            >
              #
            </th>
            {table.columns.map((column) => {
              const active = sort?.column === column;
              return (
                <th
                  key={column}
                  scope="col"
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className="border-border border-b p-0"
                >
                  <button
                    type="button"
                    onClick={() => onSort(nextSort(sort, column))}
                    className={cn(
                      'flex w-full items-center gap-1 px-2 py-1.5 text-left transition-colors',
                      'hover:bg-elevated',
                      active ? 'text-syntax-key' : 'text-fg-muted',
                    )}
                  >
                    <span className="truncate">
                      <Highlight text={column} query={query} />
                    </span>
                    {active ? (
                      sort.direction === 'asc' ? (
                        <ArrowUp size={10} aria-hidden className="shrink-0" />
                      ) : (
                        <ArrowDown size={10} aria-hidden className="shrink-0" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {table.rows.map((row) => (
            <tr
              key={row.path}
              className="group border-border/60 hover:bg-elevated/50 border-b last:border-0"
            >
              <th
                scope="row"
                className="border-border text-2xs text-fg-subtle w-px border-r px-2 py-1 text-right font-normal whitespace-nowrap"
                data-numeric
              >
                <span className="flex items-center gap-1">
                  {row.index}
                  <button
                    type="button"
                    aria-label={`Copy path ${row.path}`}
                    title={row.path}
                    onClick={() => void copy(row.path)}
                    className="text-fg-subtle hover:text-fg rounded-xs p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Link2 size={10} aria-hidden />
                  </button>
                </span>
              </th>

              {row.cells.map((cell, column) => {
                const name = table.columns[column] ?? '';
                return (
                  <td
                    key={name}
                    className="max-w-[24rem] truncate px-2 py-1 align-top"
                    title={cell === undefined ? undefined : JSON.stringify(cell)}
                  >
                    {cell === undefined ? (
                      <span className="text-fg-subtle/50">—</span>
                    ) : isContainer(cell) ? (
                      <button
                        type="button"
                        onClick={() => void copy(joinPath(row.path, name, false))}
                        title="Copy this cell's path"
                        className="text-fg-subtle hover:text-fg"
                      >
                        {previewOf(cell)}
                      </button>
                    ) : (
                      <ValueText value={cell} query={query} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {table.hidden > 0 ? (
        <p className="text-2xs text-fg-subtle px-2 py-2">
          {table.hidden.toLocaleString()} more rows — narrow it with a filter
        </p>
      ) : null}
    </div>
  );
};
