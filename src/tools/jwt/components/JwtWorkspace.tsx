import { AlertTriangle, Eraser } from 'lucide-react';
import { useMemo, useState } from 'react';
import { JsonBlock } from '@/components/shared/JsonBlock';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Panel } from '@/components/ui/Panel';
import { StatusChip } from '@/components/ui/StatusChip';
import { takePendingInput } from '@/lib/handoff';
import { useVerification } from '../hooks/useVerification';
import { evaluateValidity, type ValidityStatus } from '../lib/claims';
import { inspectJwt, type JwtSegment } from '../lib/decode-jwt';
import type { SecretEncoding, VerificationStatus } from '../lib/verify';
import { ClaimsTable } from './ClaimsTable';
import { SignaturePanel } from './SignaturePanel';
import { TokenInput } from './TokenInput';

const VALIDITY_TONE = {
  valid: 'success',
  expired: 'danger',
  'not-yet-valid': 'warning',
  unknown: 'neutral',
} as const satisfies Record<ValidityStatus, 'success' | 'danger' | 'warning' | 'neutral'>;

const VERIFICATION_TONE = {
  verified: 'success',
  mismatch: 'danger',
  unsigned: 'danger',
  unsupported: 'warning',
  error: 'warning',
  idle: 'neutral',
} as const satisfies Record<VerificationStatus, 'success' | 'danger' | 'warning' | 'neutral'>;

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
 * Paste, and it is already decoded. Add a key, and it is checked.
 *
 * Decoding still proves nothing on its own, so the interface says which of the
 * two it has done rather than leaving "unverified" as a permanent disclaimer.
 */
export const JwtWorkspace = () => {
  const [token, setToken] = useState(() => takePendingInput() ?? '');
  const [key, setKey] = useState('');
  const [encoding, setEncoding] = useState<SecretEncoding>('utf-8');

  const result = useMemo(() => inspectJwt(token), [token]);
  const jwt = result.ok ? result.jwt : null;
  const validity = useMemo(() => evaluateValidity(jwt?.payload.value ?? null), [jwt]);

  const verification = useVerification(token, jwt?.algorithm ?? null, key, encoding);

  const notices = result.ok ? [...result.jwt.warnings, ...result.jwt.errors] : [];

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4 lg:gap-3">
        <Panel
          label="Token"
          meta={
            token ? <span data-numeric>{token.trim().length.toLocaleString()} chars</span> : null
          }
          tone={token && !result.ok ? 'danger' : 'default'}
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
          bodyClassName="flex flex-col"
        >
          <TokenInput value={token} onChange={setToken} invalid={Boolean(token) && !result.ok} />
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
              <StatusChip tone={VERIFICATION_TONE[verification.status]}>
                {verification.status === 'idle' ? 'signature unchecked' : verification.message}
              </StatusChip>
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

            <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
              <SegmentPanel segment={jwt.header} label="Header" />
              <SegmentPanel
                segment={jwt.payload}
                label="Payload"
                className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
              />
              <SignaturePanel
                signature={jwt.signature}
                algorithm={jwt.algorithm}
                keyMaterial={key}
                onKeyChange={setKey}
                encoding={encoding}
                onEncodingChange={setEncoding}
                verification={verification}
              />
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
