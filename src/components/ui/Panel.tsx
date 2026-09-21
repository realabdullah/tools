import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * States the panel knows about.
 *
 * A `tone` rather than a `className` border override: two border-colour
 * utilities of equal specificity are resolved by stylesheet order, not by the
 * order they are written, so "pass a colour class in" is a coin toss.
 */
type Tone = 'default' | 'danger';

type PanelProps = {
  /** Short, lowercase-noun label. The panel's identity, not a sentence. */
  label: ReactNode;
  /** Right-aligned controls. Kept in the header so the body stays pure content. */
  actions?: ReactNode | undefined;
  /** Small metadata shown next to the label — counts, variants, status. */
  meta?: ReactNode | undefined;
  children: ReactNode;
  tone?: Tone | undefined;
  className?: string | undefined;
  bodyClassName?: string | undefined;
};

export const Panel = ({
  label,
  actions,
  meta,
  children,
  tone = 'default',
  className,
  bodyClassName,
}: PanelProps) => (
  <section
    className={cn(
      'bg-surface flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border',
      'transition-colors duration-(--duration-base)',
      tone === 'danger' ? 'border-danger/40' : 'border-border focus-within:border-border-strong',
      className,
    )}
  >
    <header className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-3">
      <h2 className="text-2xs text-fg-muted font-medium tracking-[0.07em] uppercase">{label}</h2>
      {meta ? <div className="text-2xs text-fg-subtle min-w-0 truncate">{meta}</div> : null}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">{actions}</div>
    </header>
    <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
  </section>
);
