import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { tokenizeJson, type JsonTokenType } from '@/lib/json-tokens';

const TOKEN_CLASS: Record<JsonTokenType, string> = {
  key: 'text-accent',
  string: 'text-fg',
  number: 'text-success',
  keyword: 'text-warning',
  punctuation: 'text-fg-subtle',
  plain: 'text-fg-muted',
};

/** Read-only JSON, syntax-coloured. Selectable and copyable; never editable. */
export const JsonBlock = ({
  source,
  className,
}: {
  source: string;
  className?: string | undefined;
}) => {
  const tokens = useMemo(() => tokenizeJson(source), [source]);

  return (
    <pre
      className={cn(
        'scroll-thin h-full overflow-auto px-3 py-2.5 font-mono text-sm break-words whitespace-pre-wrap',
        className,
      )}
    >
      <code>
        {tokens.map((token, index) => (
          // Tokens are positional; the index is the identity here.
          <span key={index} className={TOKEN_CLASS[token.type]}>
            {token.value}
          </span>
        ))}
      </code>
    </pre>
  );
};
