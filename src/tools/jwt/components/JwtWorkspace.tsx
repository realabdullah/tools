import { AlertTriangle, Eraser, ShieldOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JsonBlock } from '@/components/shared/JsonBlock';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { StatusChip } from '@/components/ui/StatusChip';
import { takePendingInput } from '@/lib/handoff';
import { evaluateValidity, type ValidityStatus } from '../lib/claims';
import { inspectJwt, type JwtSegment } from '../lib/decode-jwt';
import { ClaimsTable } from './ClaimsTable';

const VALIDITY_TONE = {
  valid: 'success',
  expired: 'danger',
  'not-yet-valid': 'warning',
  unknown: 'neutral',
} as const satisfies Record<ValidityStatus, 'success' | 'danger' | 'warning' | 'neutral'>;

const SegmentPanel = ({
  segment,
  label,
  className,
}: {
  segment: JwtSegment;
  label: string;
  className?: string | undefined;
}) => (
  <Panel
    label={label}
    className={className}
    tone={segment.error ? 'danger' : 'default'}
    actions={<CopyButton value={segment.text ?? ''} label={label} />}
    bodyClassName="flex flex-col"
  >
    {segment.text === null ? null : <JsonBlock source={segment.text} />}
    {segment.error ? (
      <p
        role="status"
        className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
      >
        {segment.error}
      </p>
    ) : null}
  </Panel>
);

/**
 * Paste, and it is already decoded. There is no action to take.
 *
 * Decoding is not verification: nothing here checks a signature, and the
 * interface says so rather than implying trust through a green state.
 */
export const JwtWorkspace = () => {
  const [token, setToken] = useState(() => takePendingInput() ?? '');

  const result = useMemo(() => inspectJwt(token), [token]);
  const jwt = result.ok ? result.jwt : null;
  const validity = useMemo(() => evaluateValidity(jwt?.payload.value ?? null), [jwt]);

  const notices = [
    ...(result.ok ? result.jwt.warnings : []),
    ...(result.ok ? result.jwt.errors : []),
  ];

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4 lg:gap-3">
        <Panel
          label="Token"
          meta={
            token ? <span data-numeric>{token.trim().length.toLocaleString()} chars</span> : null
          }
          actions={
            <>
              {token ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear token"
                  onClick={() => setToken('')}
                >
                  <Eraser size={12} aria-hidden />
                </Button>
              ) : null}
              <CopyButton value={token} label="token" />
            </>
          }
          tone={token && !result.ok ? 'danger' : 'default'}
          bodyClassName="flex flex-col"
        >
          <Editor
            autoFocus
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste a JWT…"
            aria-label="JWT"
            aria-invalid={Boolean(token) && !result.ok}
            className="text-accent/90 min-h-[5.5rem]"
          />
          {!result.ok && token ? (
            <p
              role="status"
              className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
            >
              {result.errors[0]}
            </p>
          ) : null}
        </Panel>

        {jwt ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 px-0.5">
              <StatusChip tone={jwt.unsecured ? 'danger' : 'accent'}>
                {jwt.algorithm ?? 'no alg'}
              </StatusChip>
              <StatusChip tone={VALIDITY_TONE[validity.status]}>{validity.detail}</StatusChip>
              <span className="text-2xs text-fg-subtle ml-auto flex items-center gap-1.5">
                <ShieldOff size={11} aria-hidden />
                Decoded only — the signature is not verified
              </span>
            </div>

            {notices.length > 0 ? (
              <ul className="flex flex-col gap-1 px-0.5">
                {notices.map((notice) => (
                  <li key={notice} className="text-2xs text-warning flex items-center gap-1.5">
                    <AlertTriangle size={11} className="shrink-0" aria-hidden />
                    {notice}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Source order is the reading order on a narrow screen: header,
                payload, signature. On two columns the payload takes the right
                column whole and the signature sits under the header. */}
            <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
              <SegmentPanel segment={jwt.header} label="Header" />
              <SegmentPanel
                segment={jwt.payload}
                label="Payload"
                className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
              />
              <Panel
                label="Signature"
                meta={jwt.signature ? null : <span>absent</span>}
                actions={<CopyButton value={jwt.signature} label="signature" />}
                className="lg:col-start-1 lg:row-start-2"
              >
                <p className="scroll-thin text-fg-muted max-h-24 overflow-auto px-3 py-2.5 font-mono text-sm break-all">
                  {jwt.signature || '—'}
                </p>
              </Panel>
            </div>

            {jwt.payload.value ? (
              <Panel label="Claims">
                <ClaimsTable payload={jwt.payload.value} />
              </Panel>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};
