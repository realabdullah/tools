import { useRef, type ChangeEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * The token, with its three segments coloured.
 *
 * A textarea cannot colour part of its own text, so a highlighted layer sits
 * behind a transparent one and the two are kept in lockstep: identical font,
 * padding, wrapping and scroll position. The editable element is still a real
 * textarea, so selection, undo, spellcheck-off and mobile keyboards all behave
 * the way the platform intends.
 */
const SEGMENT_CLASS = ['text-syntax-key', 'text-syntax-boolean', 'text-syntax-string'] as const;

const SHARED =
  'px-3 py-2.5 font-mono text-sm leading-[1.55] tracking-normal break-all whitespace-pre-wrap';

type TokenInputProps = {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  /** The builder shows a token it produced; there is nothing to type into it. */
  readOnly?: boolean | undefined;
};

export const TokenInput = ({ value, onChange, invalid, readOnly = false }: TokenInputProps) => {
  const highlight = useRef<HTMLPreElement>(null);

  const segments = value.split('.');

  const onInput = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value);

  return (
    <div className="relative min-h-[5.5rem] flex-1">
      <pre
        ref={highlight}
        aria-hidden
        className={cn(
          SHARED,
          'scroll-thin text-fg-muted pointer-events-none absolute inset-0 overflow-hidden',
        )}
      >
        {segments.map((segment, index) => (
          // Positional segments; the index is the identity and the colour.
          <span key={index}>
            {index > 0 ? <span className="text-syntax-punctuation">.</span> : null}
            <span className={SEGMENT_CLASS[index] ?? 'text-danger'}>{segment}</span>
          </span>
        ))}
        {/* A trailing line keeps the last row scrollable in step with the textarea. */}
        {'\n'}
      </pre>

      <textarea
        value={value}
        onChange={onInput}
        onScroll={(event) => {
          const node = highlight.current;
          if (!node) return;
          node.scrollTop = event.currentTarget.scrollTop;
          node.scrollLeft = event.currentTarget.scrollLeft;
        }}
        readOnly={readOnly}
        autoFocus={!readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label={readOnly ? 'Signed token' : 'JWT'}
        aria-invalid={invalid}
        placeholder={readOnly ? 'The signed token appears here' : 'Paste a JWT…'}
        className={cn(
          SHARED,
          'scroll-thin absolute inset-0 h-full w-full resize-none bg-transparent',
          'caret-fg placeholder:text-fg-subtle text-transparent outline-none',
          'selection:bg-accent/30 selection:text-transparent',
        )}
      />
    </div>
  );
};
