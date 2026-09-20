import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type QueryBarProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  /** Null when there is no query — the whole document is the result. */
  matchCount: number | null;
};

/**
 * One optional input that narrows the result.
 *
 * It sits inside the result panel because that is what it changes, and it is
 * always visible rather than behind a control: a filter you have to reveal is
 * a filter you forget exists.
 */
export const QueryBar = ({ value, onChange, error, matchCount }: QueryBarProps) => (
  <div
    className={cn(
      'flex h-8 shrink-0 items-center gap-2 border-b px-3',
      error ? 'border-danger/30' : 'border-border',
    )}
  >
    <Search size={12} aria-hidden className="text-fg-subtle shrink-0" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      aria-label="Filter by path"
      aria-invalid={error !== null}
      placeholder="Filter by path — users[0].name, items[*].id, ..email"
      className="text-fg placeholder:text-fg-subtle h-full w-full bg-transparent font-mono text-xs outline-none placeholder:font-sans"
    />
    {error ? (
      <span role="status" className="text-2xs text-danger shrink-0">
        {error}
      </span>
    ) : matchCount !== null ? (
      <span className="text-2xs text-fg-subtle shrink-0" data-numeric>
        {matchCount.toLocaleString()} {matchCount === 1 ? 'match' : 'matches'}
      </span>
    ) : null}
    {value ? (
      <button
        type="button"
        aria-label="Clear filter"
        onClick={() => onChange('')}
        className="text-fg-subtle hover:text-fg shrink-0 rounded-xs p-0.5 transition-colors"
      >
        <X size={12} aria-hidden />
      </button>
    ) : null}
  </div>
);
