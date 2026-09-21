import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * A native select, styled.
 *
 * Native because a custom listbox buys nothing here and costs keyboard
 * behaviour, type-ahead, and the platform picker on a phone.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex shrink-0 items-center">
      <select
        ref={ref}
        className={cn(
          'border-border bg-surface h-6 appearance-none rounded-xs border py-0 pr-5 pl-1.5',
          'text-2xs text-fg-muted font-medium transition-colors duration-(--duration-fast)',
          'hover:border-border-strong hover:text-fg',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={11}
        aria-hidden
        className="text-fg-subtle pointer-events-none absolute right-1"
      />
    </div>
  ),
);
Select.displayName = 'Select';
