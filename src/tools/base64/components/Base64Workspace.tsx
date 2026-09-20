import { ArrowDown, ArrowRight, ArrowUp, Eraser } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { byteLength, formatBytes } from '@/lib/bytes';
import { takePendingInput } from '@/lib/handoff';
import {
  decodeText,
  encodeText,
  looksLikeBase64,
  usesUrlAlphabet,
  type Base64Variant,
} from '../lib/base64';

type Source = { side: 'text' | 'base64'; value: string };

/**
 * One value, two representations.
 *
 * Only the edited side is stored; the other is derived on render. That removes
 * the class of bugs where two synchronised fields fight each other, and it
 * means there is no mode to choose and nothing to submit.
 */
const initialSource = (): Source => {
  const handed = takePendingInput();
  if (handed === null) return { side: 'text', value: '' };
  return looksLikeBase64(handed) && decodeText(handed).ok
    ? { side: 'base64', value: handed }
    : { side: 'text', value: handed };
};

export const Base64Workspace = () => {
  const [source, setSource] = useState<Source>(initialSource);
  const [variant, setVariant] = useState<Base64Variant>(() =>
    source.side === 'base64' && usesUrlAlphabet(source.value) ? 'url' : 'standard',
  );

  const derived = useMemo(() => {
    if (source.side === 'text') {
      return { text: source.value, base64: encodeText(source.value, variant), error: null };
    }
    const decoded = decodeText(source.value);
    return {
      text: decoded.ok ? decoded.value : '',
      base64: source.value,
      error: decoded.ok ? null : decoded.message,
    };
  }, [source, variant]);

  const editBase64 = (value: string) => {
    setSource({ side: 'base64', value });
    if (value !== '') setVariant(usesUrlAlphabet(value) ? 'url' : 'standard');
  };

  const isEmpty = source.value === '';

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex h-full w-full max-w-[72rem] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(11rem,1fr)_auto_minmax(11rem,1fr)] gap-2 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-1 lg:gap-3">
          <Panel
            label="Text"
            meta={
              derived.text === '' ? null : (
                <span data-numeric>
                  {derived.text.length.toLocaleString()} chars ·{' '}
                  {formatBytes(byteLength(derived.text))}
                </span>
              )
            }
            actions={
              <>
                {!isEmpty && source.side === 'text' ? (
                  <Button
                    variant="ghost"
                    aria-label="Clear text"
                    onClick={() => setSource({ side: 'text', value: '' })}
                  >
                    <Eraser size={12} aria-hidden />
                  </Button>
                ) : null}
                <CopyButton value={derived.text} label="decoded text" />
              </>
            }
          >
            <Editor
              value={derived.text}
              onChange={(event) => setSource({ side: 'text', value: event.target.value })}
              placeholder="Type or paste text…"
              aria-label="Plain text"
              className="break-words"
            />
          </Panel>

          {/* Which way the value is currently flowing. The arrow points at the
              side being derived, so cause and effect stay legible. */}
          <div
            className="text-fg-subtle flex items-center justify-center lg:w-6"
            aria-live="polite"
          >
            {source.side === 'text' ? (
              <>
                <ArrowDown size={14} aria-hidden className="lg:hidden" />
                <ArrowRight size={14} aria-hidden className="hidden lg:block" />
              </>
            ) : (
              <>
                <ArrowUp size={14} aria-hidden className="lg:hidden" />
                <ArrowRight size={14} aria-hidden className="hidden rotate-180 lg:block" />
              </>
            )}
            <span className="sr-only">
              {isEmpty
                ? 'Ready'
                : source.side === 'text'
                  ? 'Encoding to Base64'
                  : 'Decoding from Base64'}
            </span>
          </div>

          <Panel
            label="Base64"
            className={derived.error ? 'border-danger/40' : undefined}
            meta={
              derived.base64 === '' ? null : (
                <span data-numeric>{derived.base64.length.toLocaleString()} chars</span>
              )
            }
            actions={
              <>
                <SegmentedControl
                  label="Base64 alphabet"
                  value={variant}
                  onChange={(next) => {
                    // Switching alphabet re-encodes, so the text side becomes the source.
                    setSource({ side: 'text', value: derived.text });
                    setVariant(next);
                  }}
                  options={[
                    {
                      value: 'standard',
                      label: 'std',
                      title: 'Standard alphabet (+/ with padding)',
                    },
                    { value: 'url', label: 'url', title: 'URL-safe alphabet (-_ , unpadded)' },
                  ]}
                />
                {!isEmpty && source.side === 'base64' ? (
                  <Button
                    variant="ghost"
                    aria-label="Clear Base64"
                    onClick={() => setSource({ side: 'base64', value: '' })}
                  >
                    <Eraser size={12} aria-hidden />
                  </Button>
                ) : null}
                <CopyButton value={derived.base64} label="Base64" />
              </>
            }
            bodyClassName="flex flex-col"
          >
            <Editor
              value={derived.base64}
              onChange={(event) => editBase64(event.target.value)}
              placeholder="…or paste Base64 to decode it"
              aria-label="Base64"
              aria-invalid={derived.error !== null}
            />
            {derived.error ? (
              <p
                role="status"
                className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
              >
                {derived.error}
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
};
