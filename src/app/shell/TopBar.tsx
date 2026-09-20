import { Link, useRouterState } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { Kbd } from '@/components/ui/Kbd';
import { modifierLabel } from '@/hooks/useHotkey';
import { toolByPath } from '@/tools/registry';
import { ViewTabs } from './ViewTabs';
import { Wordmark } from './Wordmark';

/**
 * The only chrome in the app: identity, where you are, and the way in.
 * Deliberately not a nav bar — tools are reached by URL or by ⌘K.
 */
export const TopBar = ({ onOpenCommand }: { onOpenCommand: () => void }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const current = toolByPath(pathname);

  return (
    <header className="border-border flex h-11 shrink-0 items-center gap-1 border-b px-3 sm:px-4">
      <Link
        to="/"
        className="text-fg-muted hover:text-fg flex items-center gap-1.5 rounded-xs px-1 py-1 transition-colors"
        aria-label="Tools home"
      >
        <Wordmark />
        <span className="text-xs font-medium tracking-tight">Tools</span>
      </Link>

      {current ? (
        <>
          <div className="flex min-w-0 items-center gap-1.5 pl-1">
            <span className="text-fg-subtle" aria-hidden>
              /
            </span>
            <span className="text-fg truncate text-xs font-medium">{current.name}</span>
          </div>
          <ViewTabs tool={current} pathname={pathname} />
        </>
      ) : null}

      <button
        type="button"
        onClick={onOpenCommand}
        className="group border-border bg-surface text-2xs text-fg-subtle hover:border-border-strong hover:text-fg-muted ml-auto flex h-7 shrink-0 items-center gap-2 rounded-sm border pr-1.5 pl-2 transition-colors"
      >
        <Search size={12} aria-hidden />
        <span className="hidden sm:inline">Search tools</span>
        <Kbd className="group-hover:border-border-strong">{modifierLabel()}K</Kbd>
      </button>
    </header>
  );
};
