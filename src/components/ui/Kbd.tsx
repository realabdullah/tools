import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A key cap. Presentational only — the shortcut itself lives in a hook. */
export const Kbd = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) => (
  <kbd
    className={cn(
      'border-border inline-flex h-5 min-w-5 items-center justify-center rounded-xs border',
      'bg-elevated text-2xs text-fg-subtle px-1 font-sans',
      className,
    )}
  >
    {children}
  </kbd>
);
