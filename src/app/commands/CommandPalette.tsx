import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from '@tanstack/react-router';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/cn';
import { setPendingInput } from '@/lib/handoff';
import { detectTools, searchTools } from '@/tools/registry';
import type { ToolDefinition } from '@/tools/types';

/** Past this length a query stops being a tool name and starts being content. */
const CONTENT_THRESHOLD = 24;

type CommandItem = {
  key: string;
  tool: ToolDefinition;
  label: string;
  hint: string;
  /** Content to hand to the workspace on select, if any. */
  payload?: string;
};

type Section = { id: string; heading: string; items: CommandItem[] };

const buildSections = (query: string): Section[] => {
  const trimmed = query.trim();
  const sections: Section[] = [];

  // The intent seam: pasted content resolves to a capability directly.
  if (trimmed.length >= CONTENT_THRESHOLD) {
    const matches = detectTools(trimmed);
    if (matches.length > 0) {
      sections.push({
        id: 'input',
        heading: 'Use this input',
        items: matches.map(({ tool, detection }) => ({
          key: `input-${tool.id}`,
          tool,
          label: detection.action,
          hint: tool.name,
          payload: trimmed,
        })),
      });
    }
  }

  const found = searchTools(trimmed);
  if (found.length > 0) {
    sections.push({
      id: 'tools',
      heading: 'Tools',
      items: found.map((tool) => ({
        key: `tool-${tool.id}`,
        tool,
        label: tool.name,
        hint: tool.summary,
      })),
    });
  }

  return sections;
};

/**
 * Palette contents.
 *
 * Mounted only while open, so every invocation starts from an empty query
 * without a single reset effect.
 */
const Contents = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => buildSections(query), [query]);
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeItem = items[Math.min(active, items.length - 1)];

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, sections]);

  const select = (item: CommandItem | undefined) => {
    if (!item) return;
    if (item.payload !== undefined) setPendingInput(item.payload);
    onClose();
    void navigate({ to: `/${item.tool.slug}` });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      select(activeItem);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      <Dialog.Title className="sr-only">Search tools</Dialog.Title>

      <div className="border-border flex h-11 items-center gap-2.5 border-b px-3.5">
        <Search size={14} className="text-fg-subtle shrink-0" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          placeholder="Search tools, or paste something"
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={activeItem ? `${listId}-${activeItem.key}` : undefined}
          className="text-fg placeholder:text-fg-subtle h-full w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Tools"
        className="scroll-thin max-h-[min(22rem,50vh)] overflow-y-auto p-1.5"
      >
        {items.length === 0 ? (
          <p className="text-fg-subtle px-2.5 py-6 text-center text-xs">
            Nothing matches “{query.trim().slice(0, 32)}”
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="mb-1 last:mb-0">
              <div className="text-2xs text-fg-subtle px-2.5 pt-1.5 pb-1 font-medium tracking-[0.07em] uppercase">
                {section.heading}
              </div>
              {section.items.map((item) => {
                const index = items.indexOf(item);
                const isActive = item === activeItem;
                const Icon = item.tool.icon;
                return (
                  <div
                    key={item.key}
                    id={`${listId}-${item.key}`}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onPointerMove={() => setActive(index)}
                    onClick={() => select(item)}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2.5 rounded-sm px-2.5',
                      isActive ? 'bg-surface text-fg' : 'text-fg-muted',
                    )}
                  >
                    <Icon size={14} className="text-fg-subtle shrink-0" aria-hidden />
                    <span className="shrink-0 text-xs font-medium">{item.label}</span>
                    <span className="text-2xs text-fg-subtle min-w-0 truncate">{item.hint}</span>
                    {isActive ? (
                      <CornerDownLeft
                        size={12}
                        className="text-fg-subtle ml-auto shrink-0"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="border-border text-2xs text-fg-subtle flex h-8 items-center gap-3 border-t px-3.5">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> close
        </span>
      </div>
    </div>
  );
};

export const CommandPalette = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="animate-overlay fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px]" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          'animate-panel fixed top-[12vh] left-1/2 z-50 w-[min(34rem,calc(100vw-1.5rem))]',
          'border-border-strong bg-elevated shadow-pop -translate-x-1/2 overflow-hidden rounded-lg border',
        )}
      >
        <Contents onClose={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
