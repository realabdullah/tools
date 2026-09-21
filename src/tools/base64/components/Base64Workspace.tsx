import { ArrowLeftRight, Eraser, FileUp, WandSparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { byteLength, formatBytes } from '@/lib/bytes';
import { cn } from '@/lib/cn';
import { takePendingInput } from '@/lib/handoff';
import { formatJson } from '@/tools/json/lib/format';
import { parseIfJson } from '@/tools/json/lib/transform';
import {
  decodeToBytes,
  encodeBytes,
  looksLikeBase64,
  usesUrlAlphabet,
  type Base64Variant,
} from '../lib/base64';
import { parseDataUri, readFile, toDataUri, wrapLines, type BinarySource } from '../lib/files';
import { BinaryResult } from './BinaryResult';
import { FileSource } from './FileSource';

type Mode = 'encode' | 'decode';
type OutputForm = 'base64' | 'data-uri';

const MIME_WIDTH = 76;

/**
 * Input on the left, output on the right, and a mode that says which is which.
 *
 * Text is one kind of input. A file is the other, and it is the one Base64
 * exists for: an image becomes a data URI, and a payload becomes a file again.
 * Nothing is uploaded — the bytes are read in the tab.
 */
export const Base64Workspace = () => {
  const handed = useMemo(() => takePendingInput(), []);
  const [mode, setMode] = useState<Mode>(() =>
    handed !== null && looksLikeBase64(handed) ? 'decode' : 'encode',
  );
  const [input, setInput] = useState(handed ?? '');
  const [file, setFile] = useState<BinarySource | null>(null);
  const [variant, setVariant] = useState<Base64Variant>(() =>
    handed !== null && usesUrlAlphabet(handed) ? 'url' : 'standard',
  );
  const [outputForm, setOutputForm] = useState<OutputForm>('base64');
  const [wrapped, setWrapped] = useState(false);
  const [prettyJson, setPrettyJson] = useState(true);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  // --- encoding ------------------------------------------------------------

  const encoded = useMemo(() => {
    if (mode !== 'encode') return '';
    const bytes = file ? file.bytes : new TextEncoder().encode(input);
    if (bytes.length === 0) return '';

    const base64 =
      file && outputForm === 'data-uri' ? toDataUri(file, variant) : encodeBytes(bytes, variant);
    return wrapped ? wrapLines(base64, MIME_WIDTH) : base64;
  }, [mode, file, input, variant, outputForm, wrapped]);

  // --- decoding ------------------------------------------------------------

  const decoded = useMemo(() => {
    if (mode !== 'decode' || input.trim() === '') {
      return { text: '', bytes: null, mediaType: '', error: null };
    }

    const uri = parseDataUri(input);
    const payload = uri?.base64 ?? input;
    const bytes = decodeToBytes(payload);
    if (!bytes.ok) return { text: '', bytes: null, mediaType: '', error: bytes.message };

    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.bytes);
      return { text, bytes: null, mediaType: uri?.mediaType ?? '', error: null };
    } catch {
      // Not text — which is the normal case for an image or a PDF.
      return {
        text: '',
        bytes: bytes.bytes,
        mediaType: uri?.mediaType ?? 'application/octet-stream',
        error: null,
      };
    }
  }, [mode, input]);

  const decodedJson = useMemo(
    () => (mode === 'decode' ? parseIfJson(decoded.text) : null),
    [mode, decoded.text],
  );
  const decodedText =
    decodedJson !== null && prettyJson ? formatJson(decodedJson, '2') : decoded.text;

  const inputJson = useMemo(
    () => (mode === 'encode' && !file ? parseIfJson(input) : null),
    [mode, file, input],
  );

  const output = mode === 'encode' ? encoded : decodedText;
  const inputLabel = mode === 'encode' ? (file ? 'File' : 'Text') : 'Base64';
  const outputLabel = mode === 'encode' ? 'Base64' : decoded.bytes ? 'Bytes' : 'Text';

  const onFiles = (files: FileList | null) => {
    const chosen = files?.[0];
    if (!chosen) return;
    void readFile(chosen).then((source) => {
      setMode('encode');
      setFile(source);
      setOutputForm('data-uri');
    });
  };

  const swap = () => {
    const next = mode === 'encode' ? 'decode' : 'encode';
    setMode(next);
    setFile(null);
    if (output !== '') setInput(output);
  };

  const clearInput = () => {
    setInput('');
    setFile(null);
  };

  return (
    <div
      className="scroll-thin h-full overflow-y-auto"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      {/* The visible button is the control; this only carries the picker, so
          it stays out of the accessibility tree rather than duplicating it. */}
      <input
        ref={picker}
        type="file"
        aria-hidden
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => onFiles(event.target.files)}
      />

      <div className="mx-auto flex h-full w-full max-w-[72rem] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-rows-[minmax(11rem,1fr)_auto_minmax(11rem,1fr)] gap-2',
            'lg:grid-cols-[1fr_auto_1fr] lg:grid-rows-1 lg:gap-3',
            dragging && 'outline-accent rounded-md outline-2 outline-offset-4',
          )}
        >
          <Panel
            label={inputLabel}
            tone={decoded.error ? 'danger' : 'default'}
            meta={
              file ? null : input === '' ? null : (
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
                  onChange={(next) => {
                    setMode(next);
                    setFile(null);
                  }}
                  options={[
                    { value: 'encode', label: 'encode', title: 'Text or a file to Base64' },
                    { value: 'decode', label: 'decode', title: 'Base64 to text or a file' },
                  ]}
                />
                {mode === 'encode' && !file ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Choose a file"
                    title="Encode a file — or drop one anywhere"
                    onClick={() => picker.current?.click()}
                  >
                    <FileUp size={12} aria-hidden />
                  </Button>
                ) : null}
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
                {input === '' && !file ? null : (
                  <Button variant="ghost" size="icon" aria-label="Clear input" onClick={clearInput}>
                    <Eraser size={12} aria-hidden />
                  </Button>
                )}
              </>
            }
            bodyClassName="flex flex-col"
          >
            {file ? (
              <FileSource file={file} onClear={() => setFile(null)} />
            ) : (
              <Editor
                autoFocus
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  mode === 'encode' ? 'Type, paste, or drop a file…' : 'Paste Base64 or a data URI…'
                }
                aria-label={mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}
                aria-invalid={decoded.error !== null}
                className={mode === 'encode' ? 'break-words' : undefined}
              />
            )}
            {decoded.error ? (
              <p
                role="status"
                className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
              >
                {decoded.error}
              </p>
            ) : null}
          </Panel>

          <div className="flex items-center justify-center lg:w-9">
            <Button
              variant="subtle"
              size="icon"
              onClick={swap}
              aria-label={`Swap to ${mode === 'encode' ? 'decode' : 'encode'}`}
              title={`Swap — the result becomes the input`}
            >
              <ArrowLeftRight size={13} aria-hidden className="rotate-90 lg:rotate-0" />
            </Button>
          </div>

          <Panel
            label={outputLabel}
            meta={
              output === '' && !decoded.bytes ? null : decoded.bytes ? null : (
                <span data-numeric className="hidden sm:inline">
                  {output.length.toLocaleString()} chars
                </span>
              )
            }
            actions={
              <>
                {mode === 'encode' && file ? (
                  <SegmentedControl
                    label="Output form"
                    value={outputForm}
                    onChange={setOutputForm}
                    options={[
                      { value: 'base64', label: 'raw', title: 'The Base64 on its own' },
                      { value: 'data-uri', label: 'uri', title: 'A data: URI, ready to embed' },
                    ]}
                  />
                ) : null}
                {mode === 'encode' ? (
                  <>
                    <SegmentedControl
                      label="Line wrapping"
                      value={wrapped ? 'wrap' : 'single'}
                      onChange={(next) => setWrapped(next === 'wrap')}
                      options={[
                        { value: 'single', label: '1 line', title: 'One unbroken line' },
                        {
                          value: 'wrap',
                          label: '76',
                          title: 'Wrapped at 76 characters, as MIME requires',
                        },
                      ]}
                    />
                    <SegmentedControl
                      label="Base64 alphabet"
                      value={variant}
                      onChange={setVariant}
                      options={[
                        {
                          value: 'standard',
                          label: 'std',
                          title: 'Standard alphabet (+/ with padding)',
                        },
                        { value: 'url', label: 'url', title: 'URL-safe alphabet (-_ , unpadded)' },
                      ]}
                    />
                  </>
                ) : null}
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
                <CopyButton
                  value={output}
                  label={outputLabel.toLowerCase()}
                  disabled={output === ''}
                />
              </>
            }
          >
            {decoded.bytes ? (
              <BinaryResult bytes={decoded.bytes} mediaType={decoded.mediaType} />
            ) : (
              <Editor
                readOnly
                value={output}
                placeholder={
                  mode === 'encode' ? 'Base64 appears here' : 'Decoded text appears here'
                }
                aria-label={`${outputLabel} output`}
                tabIndex={output === '' ? -1 : 0}
                className={mode === 'decode' ? 'break-words' : undefined}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};
