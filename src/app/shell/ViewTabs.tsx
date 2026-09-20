import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { viewsOf, type ToolDefinition } from '@/tools/types';

/**
 * The views of the current tool, and only the current tool.
 *
 * Contextual rather than permanent: a capability with one view shows nothing
 * here, so this never becomes a navigation bar in disguise.
 */
export const ViewTabs = ({ tool, pathname }: { tool: ToolDefinition; pathname: string }) => {
  const views = viewsOf(tool);
  if (views.length < 2) return null;

  return (
    <nav aria-label={`${tool.name} views`} className="flex items-center gap-0.5 pl-1">
      {views.map((view) => {
        const active = pathname === view.path;
        return (
          <Link
            key={view.id}
            to={view.path}
            aria-current={active ? 'page' : undefined}
            title={view.summary}
            className={cn(
              'text-2xs rounded-xs px-1.5 py-1 font-medium transition-colors duration-(--duration-fast)',
              active ? 'bg-elevated text-fg' : 'text-fg-subtle hover:text-fg-muted',
            )}
          >
            {view.name}
          </Link>
        );
      })}
    </nav>
  );
};
