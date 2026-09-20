import { ChevronsDownUp, ChevronsUpDown, CornerDownRight, Eraser } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { JsonBlock } from '@/components/shared/JsonBlock';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { byteLength, formatBytes } from '@/lib/bytes';
import { takePendingInput } from '@/lib/handoff';
import { formatJson, summarise, type IndentStyle } from '../lib/format';
import { parseJson } from '../lib/parse';
import { queryJson } from '../lib/query';
import { allContainerPaths, defaultExpanded } from '../lib/tree';
import type { JsonValue } from '../lib/types';
import { JsonTree } from './JsonTree';
import { QueryBar } from './QueryBar';

type ResultView = 'tree' | 'raw';

/**
 * One document, several ways of looking at it.
 *
 * Validating, formatting, minifying, browsing and querying are not five tools;
 * they are one surface with a view control and an indent control. Nothing is
 * submitted and nothing has a mode — the result simply follows the source.
 */
export const JsonWorkspace = () => {
  const [source, setSource] = useState(() => takePendingInput() ?? '');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ResultView>('tree');
  const [indent, setIndent] = useState<IndentStyle>('2');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = source.trim();
  const parsed = useMemo(() => (trimmed === '' ? null : parseJson(source)), [source, trimmed]);
  const document = parsed?.ok === true ? parsed.value : null;

  const queried = useMemo(
    () => (document === null ? null : queryJson(document, query)),
    [document, query],
  );

  /** What the result panel shows: the match, or every match as an array. */
  const result = useMemo<JsonValue | null>(() => {
    if (!queried?.ok) return null;
    if (query.trim() === '') return queried.matches[0]?.value ?? null;
    if (queried.matches.length === 1) return queried.matches[0]?.value ?? null;
    return queried.matches.map((match) => match.value);
  }, [queried, query]);

  const formatted = useMemo(
    () => (result === null ? '' : formatJson(result, indent)),
    [result, indent],
  );
  const stats = useMemo(() => (document === null ? null : summarise(document)), [document]);

  // Expansion is derived from the result, with the user's toggles layered on
  // top. Keying the override on the defaults' identity means a new document
  // discards stale expansion state without an effect to reset it.
  const defaults = useMemo(
    () => (result === null ? new Set<string>() : defaultExpanded(result)),
    [result],
  );
  const [override, setOverride] = useState<{
    base: ReadonlySet<string>;
    expanded: Set<string>;
  } | null>(null);
  const expanded = override?.base === defaults ? override.expanded : defaults;

  const commit = useCallback(
    (next: Set<string>) => setOverride({ base: defaults, expanded: next }),
    [defaults],
  );

  const toggle = useCallback(
    (path: string) => {
      const next = new Set(expanded);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      commit(next);
    },
    [expanded, commit],
  );

  const toggleDeep = useCallback(
    (path: string) => {
      if (result === null) return;
      const under = [...allContainerPaths(result)].filter(
        (candidate) =>
          candidate === path ||
          candidate.startsWith(`${path}.`) ||
          candidate.startsWith(`${path}[`),
      );
      const next = new Set(expanded);
      if (expanded.has(path)) for (const candidate of under) next.delete(candidate);
      else for (const candidate of under) next.add(candidate);
      commit(next);
    },
    [result, expanded, commit],
  );

  /** Puts the caret on the offending character rather than describing where it is. */
  const jumpToError = () => {
    if (parsed?.ok !== false) return;
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    editor.setSelectionRange(parsed.error.offset, Math.min(parsed.error.offset + 1, source.length));

    const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 20;
    editor.scrollTop = Math.max(0, (parsed.error.line - 1) * lineHeight - editor.clientHeight / 2);
  };

  const error = parsed?.ok === false ? parsed.error : null;

  return (
    <div className="h-full overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-2 lg:grid-cols-2 lg:grid-rows-1 lg:gap-3">
          <Panel
            label="Source"
            className={error ? 'border-danger/40' : undefined}
            meta={
              trimmed === '' ? null : (
                <span data-numeric className="hidden sm:inline">
                  {formatBytes(byteLength(source))}
                </span>
              )
            }
            actions={
              <>
                {trimmed === '' ? null : (
                  <>
                    <Button variant="ghost" aria-label="Clear source" onClick={() => setSource('')}>
                      <Eraser size={12} aria-hidden />
                    </Button>
                    <CopyButton value={source} label="source" />
                  </>
                )}
              </>
            }
            bodyClassName="flex flex-col"
          >
            <Editor
              ref={editorRef}
              autoFocus
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Paste JSON…"
              aria-label="JSON source"
              aria-invalid={error !== null}
              className="break-words"
            />
            {error ? (
              <div
                role="status"
                className="border-danger/30 text-2xs text-danger flex shrink-0 items-center gap-2 border-t px-3 py-2"
              >
                <span className="min-w-0 flex-1">{error.message}</span>
                <button
                  type="button"
                  onClick={jumpToError}
                  className="hover:bg-danger/10 flex shrink-0 items-center gap-1 rounded-xs px-1 py-0.5 font-mono transition-colors"
                >
                  <CornerDownRight size={11} aria-hidden />
                  line {error.line}, column {error.column}
                </button>
              </div>
            ) : null}
          </Panel>

          <Panel
            label="Result"
            meta={
              stats ? (
                <span data-numeric className="hidden sm:inline">
                  {stats.keys.toLocaleString()} keys · depth {stats.depth}
                </span>
              ) : null
            }
            actions={
              <>
                {view === 'tree' && result !== null ? (
                  <>
                    <Button
                      variant="ghost"
                      aria-label="Collapse all"
                      onClick={() => commit(new Set())}
                    >
                      <ChevronsDownUp size={12} aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label="Expand all"
                      onClick={() => commit(allContainerPaths(result))}
                    >
                      <ChevronsUpDown size={12} aria-hidden />
                    </Button>
                  </>
                ) : null}
                {view === 'raw' ? (
                  <SegmentedControl
                    label="Indentation"
                    value={indent}
                    onChange={setIndent}
                    options={[
                      { value: '2', label: '2', title: 'Two spaces' },
                      { value: '4', label: '4', title: 'Four spaces' },
                      { value: 'tab', label: 'tab', title: 'Tabs' },
                      { value: 'min', label: 'min', title: 'Minified — no whitespace' },
                    ]}
                  />
                ) : null}
                <SegmentedControl
                  label="Result view"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'tree', label: 'tree' },
                    { value: 'raw', label: 'raw' },
                  ]}
                />
                <CopyButton value={formatted} label="result" />
              </>
            }
            bodyClassName="flex flex-col"
          >
            {document === null ? (
              <EmptyResult invalid={error !== null} />
            ) : (
              <>
                <QueryBar
                  value={query}
                  onChange={setQuery}
                  error={queried?.ok === false ? queried.message : null}
                  matchCount={
                    query.trim() === '' ? null : queried?.ok ? queried.matches.length : null
                  }
                />
                {result === null ? (
                  <p className="text-fg-subtle flex flex-1 items-center justify-center px-6 text-center text-xs">
                    {queried?.ok === false
                      ? 'Fix the filter to see a result'
                      : 'No matches for this path'}
                  </p>
                ) : view === 'tree' ? (
                  <JsonTree
                    value={result}
                    expanded={expanded}
                    onToggle={toggle}
                    onToggleDeep={toggleDeep}
                  />
                ) : (
                  <JsonBlock source={formatted} />
                )}
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

/**
 * Deliberately quiet. A document is invalid for most of the time it is being
 * typed, and the source panel already says exactly what and where — a second
 * alarm over here would just flash.
 */
const EmptyResult = ({ invalid }: { invalid: boolean }) => (
  <div className="flex flex-1 items-center justify-center px-6 text-center">
    <p className="text-fg-subtle text-xs">
      {invalid ? 'Not valid JSON yet.' : 'Paste a document to read it.'}
    </p>
  </div>
);
