import { cn } from '@/lib/cn';
import { kindOf, type JsonValue } from '../lib/types';
import { Highlight } from './Highlight';

const KIND_CLASS = {
  string: 'text-syntax-string',
  number: 'text-syntax-number',
  boolean: 'text-syntax-boolean',
  null: 'text-syntax-null',
  object: 'text-fg-subtle',
  array: 'text-fg-subtle',
} as const;

/** How much of a long string to show inline before it stops being readable. */
const MAX_INLINE = 220;

/** A primitive rendered the way it appears in the document, coloured by type. */
export const ValueText = ({
  value,
  className,
  query = '',
}: {
  value: JsonValue;
  className?: string | undefined;
  query?: string;
}) => {
  const full = JSON.stringify(value) ?? 'null';
  const text = full.length > MAX_INLINE ? `${full.slice(0, MAX_INLINE)}…` : full;

  return (
    <span
      className={cn(KIND_CLASS[kindOf(value)], className)}
      data-numeric
      title={full.length > MAX_INLINE ? full : undefined}
    >
      <Highlight text={text} query={query} />
    </span>
  );
};
