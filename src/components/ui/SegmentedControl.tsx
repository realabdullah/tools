import { cn } from '@/lib/cn';

export type Segment<T extends string> = { value: T; label: string; title?: string | undefined };

type Props<T extends string> = {
  value: T;
  options: readonly Segment<T>[];
  onChange: (value: T) => void;
  label: string;
};

/** Two or three mutually exclusive options, sized for a panel header. */
export const SegmentedControl = <T extends string>({
  value,
  options,
  onChange,
  label,
}: Props<T>) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="border-border flex h-6 items-center gap-0.5 rounded-xs border p-0.5"
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selected}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            'text-2xs h-full rounded-[2px] px-1.5 font-medium transition-colors duration-(--duration-fast)',
            selected ? 'bg-elevated text-fg' : 'text-fg-subtle hover:text-fg-muted',
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
