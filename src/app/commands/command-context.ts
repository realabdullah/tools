import { createContext, useContext } from 'react';

export type CommandMenuValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

export const CommandMenuContext = createContext<CommandMenuValue | null>(null);

export const useCommandMenu = (): CommandMenuValue => {
  const value = useContext(CommandMenuContext);
  if (!value) throw new Error('useCommandMenu must be used inside <CommandMenuProvider>');
  return value;
};
