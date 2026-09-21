import { Check, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import {
  FILTER_OPERATORS,
  isEmptyTransform,
  type FilterOperator,
  type TransformSpec,
} from '../lib/transform-ops';

type TransformPanelProps = {
  spec: TransformSpec;
  onChange: (spec: TransformSpec) => void;
  fields: readonly string[];
  /** How many records survive the current spec, for the live count. */
  resultCount: number | null;
  onApply: () => void;
  onClose: () => void;
};

const field =
  'h-6 min-w-0 rounded-xs border border-border bg-bg px-1.5 text-2xs text-fg outline-none focus:border-border-strong';

/**
 * Filter, sort and pick, previewed live.
 *
 * The result updates as the form changes, so "apply" only ever commits
 * something already on screen — a transform that rewrote the document before
 * you could see what it did would be a thing to undo, not a thing to use.
 */
export const TransformPanel = ({
  spec,
  onChange,
  fields,
  resultCount,
  onApply,
  onClose,
}: TransformPanelProps) => {
  const filter = spec.filter;
  const sort = spec.sort;

  const setFilter = (next: Partial<NonNullable<TransformSpec['filter']>>) =>
    onChange({
      ...spec,
      filter: { field: '', operator: '==', value: '', ...filter, ...next },
    });

  return (
    <div className="border-border bg-bg/40 flex shrink-0 flex-col gap-2 border-b px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs text-fg-subtle flex h-6 items-center gap-1.5 font-medium tracking-[0.07em] uppercase">
          <Filter size={11} aria-hidden />
          Filter
        </span>

        <Select
          aria-label="Filter field"
          value={filter?.field ?? ''}
          onChange={(event) => setFilter({ field: event.target.value })}
        >
          <option value="">—</option>
          {fields.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter operator"
          value={filter?.operator ?? '=='}
          onChange={(event) => setFilter({ operator: event.target.value as FilterOperator })}
        >
          {FILTER_OPERATORS.map((operator) => (
            <option key={operator.value} value={operator.value}>
              {operator.label}
            </option>
          ))}
        </Select>

        <input
          aria-label="Filter value"
          value={filter?.value ?? ''}
          onChange={(event) => setFilter({ value: event.target.value })}
          placeholder="value"
          spellCheck={false}
          className={cn(field, 'w-28 font-mono')}
        />

        {filter ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear filter"
            onClick={() => onChange({ ...spec, filter: null })}
          >
            <X size={11} aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs text-fg-subtle flex h-6 w-[4.5rem] items-center font-medium tracking-[0.07em] uppercase">
          Sort
        </span>

        <Select
          aria-label="Sort field"
          value={sort?.field ?? ''}
          onChange={(event) =>
            onChange({
              ...spec,
              sort:
                event.target.value === ''
                  ? null
                  : { field: event.target.value, direction: sort?.direction ?? 'asc' },
            })
          }
        >
          <option value="">—</option>
          {fields.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Sort direction"
          value={sort?.direction ?? 'asc'}
          disabled={sort === null}
          onChange={(event) =>
            sort &&
            onChange({
              ...spec,
              sort: { ...sort, direction: event.target.value as 'asc' | 'desc' },
            })
          }
        >
          <option value="asc">ascending</option>
          <option value="desc">descending</option>
        </Select>
      </div>

      {fields.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-2xs text-fg-subtle flex h-6 w-[4.5rem] items-center font-medium tracking-[0.07em] uppercase">
            Keep
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {fields.map((name) => {
              const picked = spec.pick.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={picked}
                  onClick={() =>
                    onChange({
                      ...spec,
                      pick: picked
                        ? spec.pick.filter((entry) => entry !== name)
                        : [...spec.pick, name],
                    })
                  }
                  className={cn(
                    'text-2xs flex h-6 items-center gap-1 rounded-xs border px-1.5 font-mono transition-colors',
                    picked
                      ? 'border-accent/50 bg-accent/10 text-fg'
                      : 'border-border text-fg-subtle hover:text-fg-muted',
                  )}
                >
                  {picked ? <Check size={10} aria-hidden /> : null}
                  {name}
                </button>
              );
            })}
            {spec.pick.length > 0 ? (
              <Button variant="ghost" onClick={() => onChange({ ...spec, pick: [] })}>
                All fields
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="border-border flex items-center gap-2 border-t pt-2">
        <span className="text-2xs text-fg-subtle" role="status" data-numeric>
          {resultCount === null
            ? 'Previewing the whole document'
            : `${resultCount.toLocaleString()} ${resultCount === 1 ? 'record' : 'records'} after transform`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" onClick={onApply} disabled={isEmptyTransform(spec)}>
            Apply to document
          </Button>
        </div>
      </div>
    </div>
  );
};
