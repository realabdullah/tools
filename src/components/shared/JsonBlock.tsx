import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { tokenizeJson, type JsonTokenType } from '@/lib/json-tokens';

/**
 * Past this, one span per token stops being worth it: the tokeniser is fine
 * but the DOM is not, and a readable plain block beats a stalled tab.
 */
const MAX_HIGHLIGHTED = 150_000;

const TOKEN_CLASS: Record<JsonTokenType, string> = {
  key: 'text-syntax-key',
  string: 'text-syntax-string',
  number: 'text-syntax-number',
  keyword: 'text-syntax-boolean',
  punctuation: 'text-syntax-punctuation',
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
  const tokens = useMemo(
    () => (source.length > MAX_HIGHLIGHTED ? null : tokenizeJson(source)),
    [source],
  );

  return (
    <pre
      className={cn(
        'scroll-thin h-full overflow-auto px-3 py-2.5 font-mono text-sm break-words whitespace-pre-wrap',
        className,
      )}
    >
      <code>
        {tokens === null
          ? source
          : tokens.map((token, index) => (
              // Tokens are positional; the index is the identity here.
              <span key={index} className={TOKEN_CLASS[token.type]}>
                {token.value}
              </span>
            ))}
      </code>
    </pre>
  );
};
