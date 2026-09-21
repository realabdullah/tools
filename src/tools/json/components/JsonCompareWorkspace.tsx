import { Eraser } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Editor } from '@/components/ui/Editor';
import { Panel } from '@/components/ui/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusChip } from '@/components/ui/StatusChip';
import { takePendingInput } from '@/lib/handoff';
import { diffJson, expandedForChanges } from '../lib/diff';
import { parseJson, type JsonSyntaxError } from '../lib/parse';
import type { JsonValue } from '../lib/types';
import { DiffTree } from './DiffTree';

type Scope = 'changes' | 'all';

/**
 * Two documents, one structural comparison.
 *
 * Still the JSON workspace — same parser, same diagnostics, same tree — with a
 * second source. The diff arrives already opened along the paths that differ,
 * because a collapsed root is not an answer.
 */
export const JsonCompareWorkspace = () => {
  // Whatever was handed over lands on the left; the right is what you compare to.
  const [left, setLeft] = useState(() => takePendingInput() ?? '');
  const [right, setRight] = useState('');
  const [scope, setScope] = useState<Scope>('changes');

  const leftParsed = useMemo(() => (left.trim() === '' ? null : parseJson(left)), [left]);
  const rightParsed = useMemo(() => (right.trim() === '' ? null : parseJson(right)), [right]);

  const leftValue = leftParsed?.ok === true ? leftParsed.value : null;
  const rightValue = rightParsed?.ok === true ? rightParsed.value : null;

  const diff = useMemo(
    () => (leftValue === null || rightValue === null ? null : diffJson(leftValue, rightValue)),
    [leftValue, rightValue],
  );

  const defaults = useMemo(
    () => (diff === null ? new Set<string>() : expandedForChanges(diff.root)),
    [diff],
  );
  const [override, setOverride] = useState<{
    base: ReadonlySet<string>;
    expanded: Set<string>;
  } | null>(null);
  const expanded = override?.base === defaults ? override.expanded : defaults;

  const toggle = useCallback(
    (path: string) => {
      const next = new Set(expanded);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      setOverride({ base: defaults, expanded: next });
    },
    [expanded, defaults],
  );

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex h-full min-h-[40rem] w-full max-w-[96rem] flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4 lg:gap-3">
        {/* Stacked and comfortably tall on a phone; side by side and sharing a
            third of the height once there is room for two columns. */}
        <div className="grid shrink-0 gap-2 lg:h-[34%] lg:grid-cols-2 lg:gap-3">
          <SourcePanel label="Left" value={left} onChange={setLeft} parsed={leftParsed} />
          <SourcePanel label="Right" value={right} onChange={setRight} parsed={rightParsed} />
        </div>

        <Panel
          className="min-h-[18rem] flex-1"
          label="Differences"
          meta={
            diff ? (
              <span className="flex items-center gap-1.5" data-numeric>
                <span className="text-success">+{diff.summary.added}</span>
                <span className="text-danger">−{diff.summary.removed}</span>
                <span className="text-warning">~{diff.summary.changed}</span>
              </span>
            ) : null
          }
          actions={
            diff ? (
              <SegmentedControl
                label="What to show"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'changes', label: 'changes', title: 'Only what differs' },
                  { value: 'all', label: 'all', title: 'The whole document' },
                ]}
              />
            ) : null
          }
        >
          {diff ? (
            <DiffTree
              root={diff.root}
              expanded={expanded}
              onToggle={toggle}
              onlyDifferences={scope === 'changes'}
            />
          ) : (
            <p className="text-fg-subtle flex h-full items-center justify-center px-6 text-center text-xs">
              Paste a document on each side to compare them.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
};

type SourcePanelProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  parsed: { ok: true; value: JsonValue } | { ok: false; error: JsonSyntaxError } | null;
};

const SourcePanel = ({ label, value, onChange, parsed }: SourcePanelProps) => {
  const error = parsed?.ok === false ? parsed.error : null;

  return (
    <Panel
      label={label}
      className="min-h-[11rem]"
      tone={error ? 'danger' : 'default'}
      meta={parsed?.ok === true ? <StatusChip tone="success">valid</StatusChip> : null}
      actions={
        value ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange('')}
          >
            <Eraser size={12} aria-hidden />
          </Button>
        ) : null
      }
      bodyClassName="flex flex-col"
    >
      <Editor
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste JSON…"
        aria-label={`${label} document`}
        aria-invalid={error !== null}
        className="break-words"
      />
      {error ? (
        <p
          role="status"
          className="border-danger/30 text-2xs text-danger shrink-0 border-t px-3 py-2"
        >
          {error.message} — line {error.line}, column {error.column}
        </p>
      ) : null}
    </Panel>
  );
};
