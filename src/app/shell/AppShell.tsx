import { Outlet } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { CommandPalette } from '@/app/commands/CommandPalette';
import { CommandMenuContext } from '@/app/commands/command-context';
import { useHotkey } from '@/hooks/useHotkey';
import { TopBar } from './TopBar';

export const AppShell = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useHotkey(
    { key: 'k', mod: true },
    useCallback((event: KeyboardEvent) => {
      event.preventDefault();
      setIsOpen((current) => !current);
    }, []),
  );

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <CommandMenuContext.Provider value={value}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar onOpenCommand={open} />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette isOpen={isOpen} onOpenChange={setIsOpen} />
    </CommandMenuContext.Provider>
  );
};
