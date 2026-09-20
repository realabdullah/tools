import { useMemo } from 'react';
import { splitMatches } from '../lib/matches';

/** Renders text with the search term picked out. Never renders markup. */
export const Highlight = ({ text, query }: { text: string; query: string }) => {
  const segments = useMemo(() => splitMatches(text, query), [text, query]);
  if (query === '') return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          // Positional segments; the index is the identity.
          <mark key={index} className="bg-highlight/35 text-fg rounded-[2px]">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
};
