import { KeyRound, ShieldCheck, ShieldOff, ShieldQuestion, ShieldX } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { cn } from '@/lib/cn';
import { shapeOf, isSupported } from '../lib/algorithms';
import type { SecretEncoding, Verification } from '../lib/verify';

const PRESENTATION = {
  verified: { icon: ShieldCheck, class: 'text-success', border: 'border-success/40' },
  mismatch: { icon: ShieldX, class: 'text-danger', border: 'border-danger/40' },
  unsigned: { icon: ShieldOff, class: 'text-danger', border: 'border-danger/40' },
  unsupported: { icon: ShieldQuestion, class: 'text-warning', border: 'border-warning/40' },
  error: { icon: ShieldQuestion, class: 'text-warning', border: 'border-warning/40' },
  idle: { icon: ShieldQuestion, class: 'text-fg-subtle', border: '' },
} as const;

type SignaturePanelProps = {
  signature: string;
  algorithm: string | null;
  keyMaterial: string;
  onKeyChange: (value: string) => void;
  encoding: SecretEncoding;
  onEncodingChange: (value: SecretEncoding) => void;
  verification: Verification;
};

/**
 * The signature, and the key that decides whether to believe it.
 *
 * Everything happens in the tab: the key is never sent anywhere, which is the
 * only reason it is reasonable to ask for one at all.
 */
export const SignaturePanel = ({
  signature,
  algorithm,
  keyMaterial,
  onKeyChange,
  encoding,
  onEncodingChange,
  verification,
}: SignaturePanelProps) => {
  const presentation = PRESENTATION[verification.status];
  const Icon = presentation.icon;
  const usesSecret =
    algorithm !== null && isSupported(algorithm) && shapeOf(algorithm) === 'secret';

  return (
    <Panel
      label="Signature"
      className={presentation.border}
      meta={signature ? null : <span>absent</span>}
      actions={
        <>
          {usesSecret ? (
            <SegmentedControl
              label="Secret encoding"
              value={encoding}
              onChange={onEncodingChange}
              options={[
                { value: 'utf-8', label: 'text', title: 'The secret as written' },
                { value: 'base64url', label: 'b64', title: 'The secret is Base64-encoded' },
              ]}
            />
          ) : null}
          <CopyButton value={signature} label="signature" />
        </>
      }
      bodyClassName="flex flex-col"
    >
      <p className="scroll-thin border-border text-syntax-string max-h-16 shrink-0 overflow-auto border-b px-3 py-2.5 font-mono text-sm break-all">
        {signature || '—'}
      </p>

      <label className="text-2xs text-fg-subtle flex shrink-0 items-center gap-1.5 px-3 pt-2">
        <KeyRound size={11} aria-hidden />
        {usesSecret ? 'Shared secret' : 'Public key — PEM or JWK'}
      </label>

      <Editor
        value={keyMaterial}
        onChange={(event) => onKeyChange(event.target.value)}
        aria-label="Verification key"
        placeholder={
          usesSecret
            ? 'a-string-secret-at-least-256-bits-long'
            : '-----BEGIN PUBLIC KEY----- or { "kty": … }'
        }
        className="min-h-[4.5rem] text-xs break-all"
      />

      <p
        role="status"
        className={cn(
          'text-2xs flex shrink-0 items-center gap-1.5 border-t px-3 py-2',
          presentation.class,
          verification.status === 'idle' ? 'border-border' : presentation.border || 'border-border',
        )}
      >
        <Icon size={12} aria-hidden className="shrink-0" />
        {verification.message}
      </p>
    </Panel>
  );
};
