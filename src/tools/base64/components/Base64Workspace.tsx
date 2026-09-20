import { ArrowLeftRight, Eraser } from 'lucide-react';
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

type Mode = 'encode' | 'decode';

/**
 * Input on the left, output on the right, and a mode that says which is which.
 *
 * An earlier version made both sides editable and inferred the direction. It
 * was fewer clicks and more guesswork: which pane held your input depended on
 * which you touched last. A named mode keeps the two roles fixed, and the swap
 * control between them round-trips in one move.
 */
export const Base64Workspace = () => {
  const handed = useMemo(() => takePendingInput(), []);
  const [mode, setMode] = useState<Mode>(() =>
    handed !== null && looksLikeBase64(handed) && decodeText(handed).ok ? 'decode' : 'encode',
  );
  const [input, setInput] = useState(handed ?? '');
  const [variant, setVariant] = useState<Base64Variant>(() =>
    handed !== null && usesUrlAlphabet(handed) ? 'url' : 'standard',
  );

  const result = useMemo(() => {
    if (input === '') return { output: '', error: null };
    if (mode === 'encode') return { output: encodeText(input, variant), error: null };

    const decoded = decodeText(input);
    return decoded.ok
      ? { output: decoded.value, error: null }
      : { output: '', error: decoded.message };
  }, [input, mode, variant]);

  /**
   * Swapping is a round trip, not just a relabelling: the result you were
   * looking at becomes the thing you are now working from.
   */
  const swap = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    if (result.output !== '') setInput(result.output);
  };

  const inputLabel = mode === 'encode' ? 'Text' : 'Base64';
  const outputLabel = mode === 'encode' ? 'Base64' : 'Text';

  // Only meaningful when Base64 is being written: decoding accepts either
  // alphabet without being told which it is looking at.
  const alphabet = (
    <SegmentedControl
      label="Base64 alphabet"
      value={variant}
      onChange={setVariant}
      options={[
        { value: 'standard', label: 'std', title: 'Standard alphabet (+/ with padding)' },
        { value: 'url', label: 'url', title: 'URL-safe alphabet (-_ , unpadded)' },
      ]}
    />
  );

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex h-full w-full max-w-[72rem] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(11rem,1fr)_auto_minmax(11rem,1fr)] gap-2 lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-1 lg:gap-3">
          <Panel
            label={inputLabel}
            className={result.error ? 'border-danger/40' : undefined}
            meta={
              input === '' ? null : (
                <span data-numeric className="hidden sm:inline">
                  {input.length.toLocaleString()} chars
                  {mode === 'encode' ? ` · ${formatBytes(byteLength(input))}` : ''}
                </span>
              )
            }
            actions={
              <>
                <SegmentedControl
                  label="Direction"
                  value={mode}
                  onChange={(next) => setMode(next)}
                  options={[
                    { value: 'encode', label: 'encode', title: 'Text to Base64' },
                    { value: 'decode', label: 'decode', title: 'Base64 to text' },
                  ]}
                />
                {input === '' ? null : (
                  <Button variant="ghost" aria-label="Clear input" onClick={() => setInput('')}>
                    <Eraser size={12} aria-hidden />
                  </Button>
                )}
              </>
            }
            bodyClassName="flex flex-col"
          >
            <Editor
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={mode === 'encode' ? 'Type or paste text…' : 'Paste Base64…'}
              aria-label={mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}
              aria-invalid={result.error !== null}
              className={mode === 'encode' ? 'break-words' : undefined}
            />
            {result.error ? (
              <p
                role="status"
                className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
              >
                {result.error}
              </p>
            ) : null}
          </Panel>

          <div className="flex items-center justify-center lg:w-9">
            <Button
              variant="subtle"
              onClick={swap}
              aria-label={`Swap to ${mode === 'encode' ? 'decode' : 'encode'}`}
              title={`Swap — ${outputLabel.toLowerCase()} becomes the input`}
              className="size-7 rounded-full p-0"
            >
              {/* The panels stack on a phone and sit side by side above it. */}
              <ArrowLeftRight size={13} aria-hidden className="rotate-90 lg:rotate-0" />
            </Button>
          </div>

          <Panel
            label={outputLabel}
            meta={
              result.output === '' ? null : (
                <span data-numeric className="hidden sm:inline">
                  {result.output.length.toLocaleString()} chars
                </span>
              )
            }
            actions={
              <>
                {mode === 'encode' ? alphabet : null}
                <CopyButton value={result.output} label={outputLabel.toLowerCase()} />
              </>
            }
          >
            <Editor
              readOnly
              value={result.output}
              placeholder={mode === 'encode' ? 'Base64 appears here' : 'Decoded text appears here'}
              aria-label={`${outputLabel} output`}
              tabIndex={result.output === '' ? -1 : 0}
              className={mode === 'decode' ? 'break-words' : undefined}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
};
