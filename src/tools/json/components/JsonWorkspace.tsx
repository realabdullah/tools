import { ArrowDownAZ, CornerDownRight, Eraser, Unlink, Wrench } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { byteLength, formatBytes } from '@/lib/bytes';
import { takePendingInput } from '@/lib/handoff';
import { formatJson, summarise, type IndentStyle } from '../lib/format';
import { findMatches } from '../lib/matches';
import { parseJson } from '../lib/parse';
import { queryJson } from '../lib/query';
import { needsRepair, repairJson } from '../lib/repair';
import { isTabular, type TableSort } from '../lib/table';
import { searchJson, EMPTY_SEARCH } from '../lib/search';
import { sortKeys, unwrapEncoded } from '../lib/transform';
import { allContainerPaths, defaultExpanded } from '../lib/tree';
import type { JsonValue } from '../lib/types';
import { JsonEditor } from './JsonEditor';
import { JsonTable } from './JsonTable';
import { JsonTree } from './JsonTree';
import { Toolbar } from './Toolbar';

type View = 'tree' | 'table' | 'raw';

/**
 * One box.
 *
 * An earlier version split the screen into a source pane and a result pane,
 * which spent half the width showing the same document twice. This is a single
 * surface with a toolbar: the view control decides whether you are reading a
 * tree or the text, and the text stays editable so pasting never needs a mode.
 */
export const JsonWorkspace = () => {
  const [source, setSource] = useState(() => takePendingInput() ?? '');
  const [view, setView] = useState<View>('tree');
  const [indent, setIndent] = useState<IndentStyle>('2');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TableSort>(null);
  const [activeMatch, setActiveMatch] = useState(0);
  const [filter, setFilter] = useState('');

  const trimmed = source.trim();
  const parsed = useMemo(() => (trimmed === '' ? null : parseJson(source)), [source, trimmed]);
  const document = parsed?.ok === true ? parsed.value : null;
  const error = parsed?.ok === false ? parsed.error : null;

  const queried = useMemo(
    () => (document === null ? null : queryJson(document, filter)),
    [document, filter],
  );
  const filtering = filter.trim() !== '';

  /** What the box shows: the document, the single match, or all matches. */
  const result = useMemo<JsonValue | null>(() => {
    if (!queried?.ok) return null;
    if (!filtering) return queried.matches[0]?.value ?? null;
    if (queried.matches.length === 1) return queried.matches[0]?.value ?? null;
    return queried.matches.map((match) => match.value);
  }, [queried, filtering]);

  const formatted = useMemo(
    () => (result === null ? '' : formatJson(result, indent)),
    [result, indent],
  );
  const stats = useMemo(() => (document === null ? null : summarise(document)), [document]);

  // While a filter is on, the box shows a derived value, so the text is not
  // the source any more and must not be editable.
  const editorText = filtering ? formatted : source;
  const matches = useMemo(
    () => (view === 'raw' ? findMatches(editorText, search) : []),
    [view, editorText, search],
  );

  const treeSearch = useMemo(
    () => (view === 'tree' && result !== null ? searchJson(result, search) : EMPTY_SEARCH),
    [view, result, search],
  );
  const searching = search.trim() !== '';
  const matchCount = view === 'raw' ? matches.length : treeSearch.matches.size;

  const defaults = useMemo(
    () => (result === null ? new Set<string>() : defaultExpanded(result)),
    [result],
  );
  const [override, setOverride] = useState<{
    base: ReadonlySet<string>;
    expanded: Set<string>;
  } | null>(null);
  const baseExpanded = override?.base === defaults ? override.expanded : defaults;
  // A search opens whatever it had to look inside to find its hits.
  const expanded = useMemo(
    () => (searching ? new Set([...baseExpanded, ...treeSearch.expand]) : baseExpanded),
    [searching, baseExpanded, treeSearch],
  );

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

  const stepMatch = (delta: number) => {
    if (matchCount === 0) return;
    setActiveMatch((current) => (current + delta + matchCount) % matchCount);
  };

  const onSearch = (value: string) => {
    setSearch(value);
    setActiveMatch(0);
  };

  const encoded = document === null ? null : unwrapEncoded(document);

  /**
   * Repair is offered only when the document does not parse and a rewrite
   * would actually produce something that does — never as a button that might
   * mangle a document which is already fine.
   */
  const repair = useMemo(() => {
    if (document !== null || trimmed === '') return null;
    const attempt = repairJson(source);
    if (!needsRepair(source, attempt) || !parseJson(attempt.text).ok) return null;
    return attempt;
  }, [document, trimmed, source]);

  const tabular = result !== null && isTabular(result);

  // The table only exists for data shaped like a table, so the option appears
  // only when there is one to show, and falls back when the shape changes.
  const effectiveView: View = view === 'table' && !tabular ? 'tree' : view;
  const showTree = effectiveView === 'tree' && result !== null;
  const showTable = effectiveView === 'table' && result !== null;
  const emptyFilter =
    effectiveView !== 'raw' && result === null && filtering && queried?.ok === true;

  /**
   * Indentation applies the moment it is chosen.
   *
   * It used to be a setting that only took effect when a separate Format
   * button was pressed, which meant picking "min" flattened the document and
   * picking "2" afterwards appeared to do nothing at all. A layout control
   * that needs a second button is not a layout control.
   */
  const applyIndent = (next: IndentStyle) => {
    setIndent(next);
    // While filtering, the text shown is derived and already follows `indent`.
    if (document !== null && !filtering) setSource(formatJson(document, next));
  };

  const tools =
    effectiveView === 'raw' ? (
      <>
        <SegmentedControl
          label="Indentation"
          value={indent}
          onChange={applyIndent}
          disabled={document === null}
          options={[
            { value: '2', label: '2', title: 'Two spaces' },
            { value: '4', label: '4', title: 'Four spaces' },
            { value: 'tab', label: 'tab', title: 'Tabs' },
            { value: 'min', label: 'min', title: 'Minified — no whitespace' },
          ]}
        />
        <Button
          variant="subtle"
          disabled={document === null || filtering}
          onClick={() => document !== null && setSource(formatJson(sortKeys(document), indent))}
          title="Order every object's keys alphabetically"
        >
          <ArrowDownAZ size={12} aria-hidden />
          Sort keys
        </Button>
        {encoded !== null ? (
          <Button
            variant="subtle"
            onClick={() => setSource(formatJson(encoded, indent))}
            title="This document is a JSON string containing JSON — parse it"
          >
            <Unlink size={12} aria-hidden />
            Unwrap
          </Button>
        ) : null}
      </>
    ) : null;

  return (
    <div className="h-full overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-[84rem] flex-col px-3 py-3 sm:px-4 sm:py-4">
        <Panel
          className="min-h-0 flex-1"
          label="JSON"
          meta={
            stats ? (
              <span data-numeric className="hidden md:inline">
                {formatBytes(byteLength(source))} · {stats.keys.toLocaleString()} keys · depth{' '}
                {stats.depth}
              </span>
            ) : null
          }
          actions={
            <>
              <SegmentedControl
                label="View"
                value={effectiveView}
                onChange={(next) => {
                  setView(next);
                  setActiveMatch(0);
                }}
                options={[
                  { value: 'tree', label: 'tree', title: 'Browse the structure' },
                  ...(tabular
                    ? [{ value: 'table' as const, label: 'table', title: 'Rows and columns' }]
                    : []),
                  { value: 'raw', label: 'raw', title: 'Read and edit the text' },
                ]}
              />
              {trimmed === '' ? null : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Clear"
                  onClick={() => setSource('')}
                >
                  <Eraser size={12} aria-hidden />
                </Button>
              )}
              <CopyButton value={formatted} label="JSON" />
            </>
          }
          bodyClassName="flex min-h-0 flex-col"
        >
          {document === null && trimmed === '' ? null : (
            <Toolbar
              search={search}
              onSearch={onSearch}
              matchCount={matchCount}
              activeMatch={activeMatch}
              onStepMatch={stepMatch}
              filter={filter}
              onFilter={setFilter}
              filterError={queried?.ok === false ? queried.message : null}
              filterCount={filtering && queried?.ok ? queried.matches.length : null}
              tools={tools}
            />
          )}

          <div className="min-h-0 flex-1">
            {showTable ? (
              <JsonTable value={result} sort={sort} onSort={setSort} query={search} />
            ) : showTree ? (
              <JsonTree
                value={result}
                expanded={expanded}
                onToggle={toggle}
                onToggleDeep={toggleDeep}
                visible={searching ? treeSearch.visible : undefined}
                query={search}
              />
            ) : emptyFilter ? (
              <Empty />
            ) : (
              /* With nothing to browse, the box is simply the editor — there is
                 no state in which you have to switch views before you can paste. */
              <JsonEditor
                value={editorText}
                onChange={setSource}
                readOnly={filtering}
                search={{ query: search, active: activeMatch }}
              />
            )}
          </div>

          {error ? (
            <ErrorStrip
              line={error.line}
              column={error.column}
              message={error.message}
              repair={
                repair ? (
                  <Button
                    variant="subtle"
                    onClick={() => setSource(repair.text)}
                    title={repair.repairs.map((entry) => entry.description).join(' · ')}
                  >
                    <Wrench size={12} aria-hidden />
                    Repair
                  </Button>
                ) : null
              }
            />
          ) : null}
        </Panel>
      </div>
    </div>
  );
};

const Empty = () => (
  <div className="flex h-full items-center justify-center px-6 text-center">
    <p className="text-fg-subtle text-xs">No matches for this path.</p>
  </div>
);

const ErrorStrip = ({
  line,
  column,
  message,
  repair,
}: {
  line: number;
  column: number;
  message: string;
  /** The repair offer, when a rewrite would actually fix this document. */
  repair: ReactNode;
}) => (
  <div
    role="status"
    className="border-danger/30 text-2xs text-danger flex shrink-0 items-center gap-2 border-t px-3 py-2"
  >
    <span className="min-w-0 flex-1">{message}</span>
    <span className="flex shrink-0 items-center gap-1 font-mono">
      <CornerDownRight size={11} aria-hidden />
      line {line}, column {column}
    </span>
    {repair}
  </div>
);
