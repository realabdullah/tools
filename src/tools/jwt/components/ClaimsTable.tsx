import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { parseTimeClaim, REGISTERED_CLAIMS, TIME_CLAIMS } from '../lib/claims';

type Row = {
  claim: string;
  meaning: string | null;
  /** The value as it appears in the token. Always shown verbatim. */
  raw: string;
  /** What the raw value means in human terms, when it has a reading. */
  reading: string | null;
  title: string | null;
  warning: string | null;
};

const rawOf = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));

const buildRows = (payload: Record<string, unknown>, now: Date): Row[] =>
  Object.entries(payload)
    .filter(([claim]) => claim in REGISTERED_CLAIMS || TIME_CLAIMS.has(claim))
    .map(([claim, value]) => {
      const time = TIME_CLAIMS.has(claim) ? parseTimeClaim(value, now) : null;
      return {
        claim,
        meaning: REGISTERED_CLAIMS[claim] ?? null,
        raw: rawOf(value),
        reading: time ? `${time.absolute} · ${time.relative}` : null,
        title: time?.iso ?? null,
        warning:
          time?.milliseconds === true
            ? 'Value looks like milliseconds; JWT times are seconds since the epoch'
            : null,
      };
    });

/**
 * Registered claims, annotated.
 *
 * The raw value stays; the reading sits beside it. Anything unrecognised is
 * left to the payload view rather than guessed at here.
 */
export const ClaimsTable = ({ payload }: { payload: Record<string, unknown> }) => {
  const rows = useMemo(() => buildRows(payload, new Date()), [payload]);

  if (rows.length === 0) {
    return (
      <p className="text-2xs text-fg-subtle px-3 py-3">No registered claims in this payload.</p>
    );
  }

  return (
    <div className="scroll-thin h-full overflow-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Registered claims found in the payload</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.claim} className="border-border/70 border-b align-top last:border-0">
              <th
                scope="row"
                className="text-accent w-px py-2 pr-3 pl-3 font-mono text-xs font-normal whitespace-nowrap"
              >
                {row.claim}
              </th>
              <td className="text-2xs text-fg-subtle w-px py-2 pr-4 whitespace-nowrap">
                {row.meaning}
              </td>
              <td className="py-2 pr-3">
                <div className="text-fg font-mono text-xs break-all" data-numeric>
                  {row.raw}
                </div>
                {row.reading ? (
                  <div className="text-2xs text-fg-muted mt-0.5" title={row.title ?? undefined}>
                    {row.reading}
                  </div>
                ) : null}
                {row.warning ? (
                  <div className="text-2xs text-warning mt-0.5 flex items-center gap-1">
                    <AlertTriangle size={11} aria-hidden />
                    {row.warning}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
