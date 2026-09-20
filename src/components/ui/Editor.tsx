import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * The workbench's text surface.
 *
 * A plain textarea on purpose: no syntax highlighting is needed for a token or
 * a Base64 blob, and native text editing (spellcheck off, undo, selection,
 * caret behaviour, mobile keyboards) is better than anything reimplemented.
 */
export const Editor = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      className={cn(
        'scroll-thin h-full w-full resize-none bg-transparent px-3 py-2.5 font-mono text-sm',
        'text-fg placeholder:text-fg-subtle break-all outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Editor.displayName = 'Editor';
