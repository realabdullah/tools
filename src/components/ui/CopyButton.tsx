import { Check, Copy, X } from 'lucide-react';
import { useCopy } from '@/hooks/useCopy';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type CopyButtonProps = {
  value: string;
  /** What is being copied, e.g. "payload". Used for the accessible label. */
  label: string;
  className?: string | undefined;
  disabled?: boolean | undefined;
};

const ICONS = {
  idle: Copy,
  copied: Check,
  failed: X,
} as const;

const TEXT = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Failed',
} as const;

export const CopyButton = ({ value, label, className, disabled }: CopyButtonProps) => {
  const { state, copy } = useCopy();
  const Icon = ICONS[state];

  return (
    <Button
      variant="ghost"
      onClick={() => void copy(value)}
      disabled={disabled ?? value === ''}
      aria-label={`Copy ${label}`}
      className={cn(
        state === 'copied' && 'text-success',
        state === 'failed' && 'text-danger',
        className,
      )}
    >
      <Icon size={12} aria-hidden />
      <span aria-live="polite">{TEXT[state]}</span>
    </Button>
  );
};
