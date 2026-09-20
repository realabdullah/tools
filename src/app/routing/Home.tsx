import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, CornerDownLeft, CornerDownRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/cn';
import { setPendingInput } from '@/lib/handoff';
import { detectTools, tools } from '@/tools/registry';
import { viewsOf, type ToolPath } from '@/tools/types';

/**
 * The root is an input surface, not a landing page.
 *
 * You paste; the registry decides which capability applies. Until something is
 * pasted it simply lists what exists, with the URLs, because those are the
 * fastest route for anyone who already knows what they want.
 */
export const Home = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  const matches = useMemo(() => detectTools(input), [input]);
  const top = matches[0];

  const go = (path: ToolPath, payload: string) => {
    setPendingInput(payload);
    void navigate({ to: path });
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[42rem] flex-col px-4 pt-[12vh] pb-16 sm:px-6">
        <label htmlFor="root-input" className="sr-only">
          Paste or type something to find the tool for it
        </label>
        <textarea
          id="root-input"
          autoFocus
          rows={3}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && top) {
              event.preventDefault();
              go(top.tool.path, input.trim());
            }
          }}
          placeholder="Paste a token, some Base64, or anything else…"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            'scroll-thin border-border bg-surface w-full resize-none rounded-md border px-3.5 py-3',
            // Grows with what was pasted, up to a ceiling, where supported.
            '[field-sizing:content] max-h-[40vh]',
            'text-fg font-mono text-sm break-all transition-colors duration-(--duration-base) outline-none',
            'placeholder:text-fg-subtle hover:border-border-strong placeholder:font-sans',
            'focus:border-border-strong',
          )}
        />

        <div className="mt-3 flex flex-col gap-1">
          {matches.length > 0
            ? matches.map(({ tool, detection }, index) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => go(tool.path, input.trim())}
                    className={cn(
                      'group flex h-11 items-center gap-3 rounded-md border px-3 text-left transition-colors duration-(--duration-fast)',
                      index === 0
                        ? 'border-border-strong bg-surface'
                        : 'hover:border-border hover:bg-surface border-transparent',
                    )}
                  >
                    <Icon size={14} className="text-fg-subtle shrink-0" aria-hidden />
                    <span className="text-fg text-xs font-medium">{detection.action}</span>
                    <span className="text-2xs text-fg-subtle truncate font-mono">{tool.path}</span>
                    {index === 0 ? (
                      <Kbd className="ml-auto">
                        <CornerDownLeft size={10} aria-hidden />
                      </Kbd>
                    ) : (
                      <ArrowRight
                        size={13}
                        className="text-fg-subtle ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })
            : tools.flatMap((tool) => {
                const Icon = tool.icon;
                return viewsOf(tool).map((view, index) => (
                  <Link
                    key={view.id}
                    to={view.path}
                    className="group hover:border-border hover:bg-surface flex h-11 items-center gap-3 rounded-md border border-transparent px-3 transition-colors duration-(--duration-fast)"
                  >
                    {index === 0 ? (
                      <Icon size={14} className="text-fg-subtle shrink-0" aria-hidden />
                    ) : (
                      <CornerDownRight
                        size={13}
                        className="text-fg-subtle ml-1 shrink-0"
                        aria-hidden
                      />
                    )}
                    <span className="text-fg text-xs font-medium">
                      {index === 0 ? tool.name : view.name}
                    </span>
                    <span className="text-2xs text-fg-subtle truncate">{view.summary}</span>
                    <span className="text-2xs text-fg-subtle ml-auto font-mono">{view.path}</span>
                  </Link>
                ));
              })}
        </div>

        <p className="text-2xs text-fg-subtle mt-8">
          Everything runs in this browser. Nothing you paste is uploaded or stored.
        </p>
      </div>
    </div>
  );
};
