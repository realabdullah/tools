import { ArrowLeftRight, Eraser, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { byteLength, formatBytes } from '@/lib/bytes';
import { takePendingInput } from '@/lib/handoff';
import { formatJson } from '@/tools/json/lib/format';
import { parseIfJson } from '@/tools/json/lib/transform';
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
  const [prettyJson, setPrettyJson] = useState(true);

  const result = useMemo(() => {
    if (input === '') return { output: '', error: null };
    if (mode === 'encode') return { output: encodeText(input, variant), error: null };

    const decoded = decodeText(input);
    return decoded.ok
      ? { output: decoded.value, error: null }
      : { output: '', error: decoded.message };
  }, [input, mode, variant]);

  /**
   * The most common thing anyone Base64-decodes is a JSON payload, so when the
   * result is one it is laid out by default. The toggle is there because the
   * bytes that were actually decoded are the unformatted ones.
   */
  const decodedJson = useMemo(
    () => (mode === 'decode' ? parseIfJson(result.output) : null),
    [mode, result.output],
  );
  const output = decodedJson !== null && prettyJson ? formatJson(decodedJson, '2') : result.output;

  /** Encoding side: the text you are about to encode can be laid out first. */
  const inputJson = useMemo(() => (mode === 'encode' ? parseIfJson(input) : null), [mode, input]);

  /**
   * Swapping is a round trip, not just a relabelling: the result you were
   * looking at becomes the thing you are now working from.
   */
  const swap = () => {
    setMode(mode === 'encode' ? 'decode' : 'encode');
    if (output !== '') setInput(output);
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
            tone={result.error ? 'danger' : 'default'}
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
                {inputJson !== null ? (
                  <Button
                    variant="ghost"
                    aria-label="Format the JSON being encoded"
                    title="Lay out this JSON before encoding it"
                    onClick={() => setInput(formatJson(inputJson, '2'))}
                  >
                    <WandSparkles size={12} aria-hidden />
                    Format
                  </Button>
                ) : null}
                {input === '' ? null : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Clear input"
                    onClick={() => setInput('')}
                  >
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
              size="icon"
              title={`Swap — ${outputLabel.toLowerCase()} becomes the input`}
            >
              {/* The panels stack on a phone and sit side by side above it. */}
              <ArrowLeftRight size={13} aria-hidden className="rotate-90 lg:rotate-0" />
            </Button>
          </div>

          <Panel
            label={outputLabel}
            meta={
              output === '' ? null : (
                <span data-numeric className="hidden sm:inline">
                  {output.length.toLocaleString()} chars
                </span>
              )
            }
            actions={
              <>
                {decodedJson !== null ? (
                  <SegmentedControl
                    label="Decoded JSON layout"
                    value={prettyJson ? 'pretty' : 'raw'}
                    onChange={(next) => setPrettyJson(next === 'pretty')}
                    options={[
                      { value: 'raw', label: 'raw', title: 'Exactly what was decoded' },
                      { value: 'pretty', label: 'pretty', title: 'Laid out as JSON' },
                    ]}
                  />
                ) : null}
                {mode === 'encode' ? alphabet : null}
                <CopyButton value={output} label={outputLabel.toLowerCase()} />
              </>
            }
          >
            <Editor
              readOnly
              value={output}
              placeholder={mode === 'encode' ? 'Base64 appears here' : 'Decoded text appears here'}
              aria-label={`${outputLabel} output`}
              tabIndex={output === '' ? -1 : 0}
              className={mode === 'decode' ? 'break-words' : undefined}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
};
