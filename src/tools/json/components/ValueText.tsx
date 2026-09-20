import { cn } from '@/lib/cn';
import { kindOf, type JsonValue } from '../lib/types';

const KIND_CLASS = {
  string: 'text-fg',
  number: 'text-success',
  boolean: 'text-warning',
  null: 'text-fg-subtle',
  object: 'text-fg-subtle',
  array: 'text-fg-subtle',
} as const;

/** A primitive rendered the way it appears in the document, coloured by type. */
export const ValueText = ({
  value,
  className,
}: {
  value: JsonValue;
  className?: string | undefined;
}) => (
  <span className={cn(KIND_CLASS[kindOf(value)], className)} data-numeric>
    {JSON.stringify(value)}
  </span>
);
