import { Eraser, KeyRound, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { setPendingInput } from '@/lib/handoff';
import { Link } from '@tanstack/react-router';
import { parseJson } from '@/tools/json/lib/parse';
import { SUPPORTED_ALGORITHMS, shapeOf, type JwsAlgorithm } from '../lib/algorithms';
import { generateKey, signToken, type SecretEncoding, type SignResult } from '../lib/verify';
import { TokenInput } from './TokenInput';

const DEFAULT_PAYLOAD = JSON.stringify(
  { sub: '1234567890', name: 'John Doe', admin: true, iat: 1516239022 },
  null,
  2,
);

type Parsed = { value: Record<string, unknown> | null; error: string | null };

const parseObject = (source: string, what: string): Parsed => {
  const result = parseJson(source);
  if (!result.ok) return { value: null, error: result.error.message };
  if (typeof result.value !== 'object' || result.value === null || Array.isArray(result.value)) {
    return { value: null, error: `The ${what} must be a JSON object` };
  }
  return { value: result.value, error: null };
};

/**
 * Composing a token, rather than reading one.
 *
 * Still the JWT workspace: same algorithms, same key handling, same crypto —
 * run the other way round. Signing happens in the tab, so the private key you
 * paste here is no more exposed than the token you paste next door.
 */
export const JwtBuildWorkspace = () => {
  const [algorithm, setAlgorithm] = useState<JwsAlgorithm>('HS256');
  const [payloadSource, setPayloadSource] = useState(DEFAULT_PAYLOAD);
  const [key, setKey] = useState('a-string-secret-at-least-256-bits-long');
  const [encoding, setEncoding] = useState<SecretEncoding>('utf-8');
  const [signed, setSigned] = useState<{ inputs: string; result: SignResult } | null>(null);

  // The header is derived: `alg` has to agree with what is doing the signing,
  // and `typ` is the same for every JWT worth building.
  const header = useMemo(() => ({ alg: algorithm, typ: 'JWT' }), [algorithm]);
  const headerSource = useMemo(() => JSON.stringify(header, null, 2), [header]);

  const payload = useMemo(() => parseObject(payloadSource, 'payload'), [payloadSource]);
  const usesSecret = shapeOf(algorithm) === 'secret';

  /**
   * Signing runs whenever the inputs change, and the result is stored with the
   * inputs it came from — so a token is never shown next to a payload or key
   * it was not signed with, and nothing is assigned synchronously in an effect.
   */
  const inputs = JSON.stringify([algorithm, payloadSource, key, encoding]);

  useEffect(() => {
    if (payload.value === null || key.trim() === '') return;

    let cancelled = false;
    void signToken(header, payload.value, algorithm, key, encoding).then((result) => {
      if (!cancelled) setSigned({ inputs, result });
    });

    return () => {
      cancelled = true;
    };
  }, [inputs, header, payload, algorithm, key, encoding]);

  const current = signed?.inputs === inputs ? signed.result : null;
  const token = current?.ok === true ? current.token : '';
  const missingKey = key.trim() === '';
  const error =
    payload.error ??
    (missingKey ? 'Add a key to sign with' : current?.ok === false ? current.message : null);
  const busy = payload.value !== null && !missingKey && current === null;

  const onGenerate = () => {
    void generateKey(algorithm).then((generated) => setKey(generated.sign));
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4 lg:gap-3">
        <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
          <div className="flex min-w-0 flex-col gap-2 lg:gap-3">
            <Panel
              label="Header"
              meta={<span className="hidden sm:inline">derived from the algorithm</span>}
              actions={
                <Select
                  aria-label="Signing algorithm"
                  value={algorithm}
                  onChange={(event) => setAlgorithm(event.target.value as JwsAlgorithm)}
                >
                  {SUPPORTED_ALGORITHMS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              }
            >
              <Editor
                readOnly
                value={headerSource}
                aria-label="Header"
                className="text-syntax-key min-h-[4.5rem]"
              />
            </Panel>

            <Panel
              label="Payload"
              tone={payload.error ? 'danger' : 'default'}
              actions={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear payload"
                  onClick={() => setPayloadSource('{}')}
                >
                  <Eraser size={12} aria-hidden />
                </Button>
              }
              bodyClassName="flex flex-col"
            >
              <Editor
                value={payloadSource}
                onChange={(event) => setPayloadSource(event.target.value)}
                aria-label="Payload"
                placeholder="{}"
                className="min-h-[9rem] break-words"
                aria-invalid={payload.error !== null}
              />
              {payload.error ? (
                <p
                  role="status"
                  className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
                >
                  {payload.error}
                </p>
              ) : null}
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-2 lg:gap-3">
            <Panel
              label={usesSecret ? 'Secret' : 'Private key'}
              actions={
                <>
                  {usesSecret ? (
                    <SegmentedControl
                      label="Secret encoding"
                      value={encoding}
                      onChange={setEncoding}
                      options={[
                        { value: 'utf-8', label: 'text', title: 'The secret as written' },
                        { value: 'base64url', label: 'b64', title: 'The secret is Base64-encoded' },
                      ]}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    onClick={onGenerate}
                    title={`Generate an ${algorithm} key`}
                  >
                    <Sparkles size={12} aria-hidden />
                    Generate
                  </Button>
                </>
              }
              bodyClassName="flex flex-col"
            >
              <label className="text-2xs text-fg-subtle flex shrink-0 items-center gap-1.5 px-3 pt-2">
                <KeyRound size={11} aria-hidden />
                {usesSecret ? 'Shared secret' : 'PKCS#8 PEM or JWK'}
              </label>
              <Editor
                value={key}
                onChange={(event) => setKey(event.target.value)}
                aria-label="Signing key"
                placeholder={usesSecret ? 'a-string-secret…' : '-----BEGIN PRIVATE KEY-----'}
                className="min-h-[7rem] text-xs break-all"
              />
            </Panel>

            <Panel
              label="Signed token"
              tone={error ? 'danger' : 'default'}
              meta={
                busy ? (
                  <span>signing…</span>
                ) : token ? (
                  <span data-numeric>{token.length.toLocaleString()} chars</span>
                ) : null
              }
              actions={
                <>
                  {token ? (
                    <Link
                      to="/jwt"
                      onClick={() => setPendingInput(token)}
                      className="text-2xs text-fg-muted hover:text-fg rounded-xs px-1.5 py-1 font-medium transition-colors"
                    >
                      Inspect this token
                    </Link>
                  ) : null}
                  <CopyButton value={token} label="token" />
                </>
              }
              bodyClassName="flex flex-col"
            >
              <TokenInput value={token} onChange={() => undefined} invalid={false} readOnly />
              {error ? (
                <p
                  role="status"
                  className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
                >
                  {error}
                </p>
              ) : null}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};
