import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'ghost' | 'subtle' | 'accent';
type Size = 'sm' | 'md';

const base =
  'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm ' +
  'font-medium transition-[background-color,color,border-color,opacity] duration-(--duration-fast) ' +
  'disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  ghost: 'text-fg-muted hover:bg-elevated hover:text-fg',
  subtle: 'border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
  accent: 'bg-accent text-accent-fg hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2 text-2xs',
  md: 'h-8 px-3 text-xs',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant | undefined;
  size?: Size | undefined;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'subtle', size = 'sm', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
