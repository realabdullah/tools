import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  invalid?: boolean;
  mono?: boolean;
  icon: React.ReactNode;
  children?: React.ReactNode;
};

const Field = ({
  value,
  onChange,
  placeholder,
  label,
  invalid,
  mono,
  icon,
  children,
}: FieldProps) => (
  <div
    className={cn(
      // A min width rather than a breakpoint: the fields wrap onto their own
      // rows exactly when they would otherwise be too narrow to read.
      'bg-bg flex h-7 min-w-[13rem] flex-1 items-center gap-1.5 rounded-sm border px-2',
      'focus-within:border-border-strong transition-colors duration-(--duration-fast)',
      invalid ? 'border-danger/40' : 'border-border',
    )}
  >
    <span className="text-fg-subtle shrink-0">{icon}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      aria-invalid={invalid}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      className={cn(
        'text-fg placeholder:text-fg-subtle h-full w-full min-w-0 bg-transparent text-xs outline-none placeholder:font-sans',
        mono && 'font-mono',
      )}
    />
    {children}
    {value ? (
      <button
        type="button"
        aria-label={`Clear ${label.toLowerCase()}`}
        onClick={() => onChange('')}
        className="text-fg-subtle hover:text-fg shrink-0 rounded-xs p-0.5 transition-colors"
      >
        <X size={11} aria-hidden />
      </button>
    ) : null}
  </div>
);

type ToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  matchCount: number;
  activeMatch: number;
  onStepMatch: (delta: number) => void;

  filter: string;
  onFilter: (value: string) => void;
  filterError: string | null;
  filterCount: number | null;

  /** Format actions only make sense where the text is visible. */
  tools?: React.ReactNode;
};

/**
 * One row of controls for one box.
 *
 * Search and filter answer different questions — "where does this word
 * appear" and "give me this path" — so they stay separate inputs rather than
 * one box that guesses. Everything wraps instead of scrolling.
 */
export const Toolbar = ({
  search,
  onSearch,
  matchCount,
  activeMatch,
  onStepMatch,
  filter,
  onFilter,
  filterError,
  filterCount,
  tools,
}: ToolbarProps) => (
  <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-2">
    <Field
      value={search}
      onChange={onSearch}
      label="Search"
      placeholder="Search keys and values…"
      icon={<Search size={12} aria-hidden />}
    >
      {search ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <span
            className="text-2xs text-fg-subtle whitespace-nowrap"
            data-numeric
            role="status"
            aria-live="polite"
          >
            {matchCount === 0 ? 'no matches' : `${activeMatch + 1}/${matchCount}`}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous match"
            disabled={matchCount === 0}
            onClick={() => onStepMatch(-1)}
          >
            <ChevronUp size={14} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next match"
            disabled={matchCount === 0}
            onClick={() => onStepMatch(1)}
          >
            <ChevronDown size={14} aria-hidden />
          </Button>
        </div>
      ) : null}
    </Field>

    <Field
      value={filter}
      onChange={onFilter}
      label="Filter by path"
      placeholder="Filter by path — users[0].name, items[*].id, ..email"
      mono
      invalid={filterError !== null}
      icon={<span className="text-2xs font-mono">$</span>}
    >
      {filterError ? (
        <span role="status" className="text-2xs text-danger shrink-0 whitespace-nowrap">
          {filterError}
        </span>
      ) : filterCount !== null ? (
        <span className="text-2xs text-fg-subtle shrink-0 whitespace-nowrap" data-numeric>
          {filterCount.toLocaleString()} {filterCount === 1 ? 'match' : 'matches'}
        </span>
      ) : null}
    </Field>

    {tools ? <div className="flex shrink-0 items-center gap-1">{tools}</div> : null}
  </div>
);
