import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'ghost' | 'subtle' | 'accent';
type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

/**
 * `shrink-0` is part of the base on purpose: these sit in toolbars next to
 * inputs that want all the width, and a button squeezed to four pixels is a
 * broken button, not a tight one.
 */
const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap ' +
  'rounded-sm font-medium transition-[background-color,color,border-color,opacity] ' +
  'duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  ghost: 'text-fg-muted hover:bg-elevated hover:text-fg',
  subtle: 'border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
  accent: 'bg-accent text-accent-fg hover:opacity-90',
};

/**
 * Square sizes for icon-only buttons.
 *
 * They exist so nothing has to pass `className="size-5 p-0"` and hope it wins
 * against the padding in a text size — utilities of equal specificity are
 * resolved by stylesheet order, not by the order they appear in the attribute,
 * so that override silently loses.
 */
const sizes: Record<Size, string> = {
  sm: 'h-7 px-2 text-2xs',
  md: 'h-8 px-3 text-xs',
  icon: 'size-7 p-0',
  'icon-sm': 'size-6 p-0',
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
