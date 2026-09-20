import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const tones: Record<Tone, string> = {
  neutral: 'border-border text-fg-subtle',
  success: 'border-success/35 text-success',
  warning: 'border-warning/35 text-warning',
  danger: 'border-danger/35 text-danger',
  accent: 'border-accent/35 text-accent',
};

export const StatusChip = ({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone | undefined;
  children: ReactNode;
  className?: string | undefined;
}) => (
  <span
    className={cn(
      'text-2xs inline-flex h-5 items-center gap-1.5 rounded-xs border px-1.5 font-medium',
      tones[tone],
      className,
    )}
  >
    {children}
  </span>
);
