import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PanelProps = {
  /** Short, lowercase-noun label. The panel's identity, not a sentence. */
  label: ReactNode;
  /** Right-aligned controls. Kept in the header so the body stays pure content. */
  actions?: ReactNode | undefined;
  /** Small metadata shown next to the label — counts, variants, status. */
  meta?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
};

export const Panel = ({ label, actions, meta, children, className, bodyClassName }: PanelProps) => (
  <section
    className={cn(
      'border-border bg-surface flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border',
      'focus-within:border-border-strong transition-colors duration-(--duration-base)',
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
