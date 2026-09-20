import { Link } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';

export const NotFound = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-fg font-mono text-sm">{pathname}</p>
      <p className="text-fg-subtle text-xs">No tool lives here yet.</p>
      <Link
        to="/"
        className="border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg mt-1 rounded-sm border px-3 py-1.5 text-xs transition-colors"
      >
        Back to start
      </Link>
    </div>
  );
};
