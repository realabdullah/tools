import { useEffect } from 'react';

export type Hotkey = {
  key: string;
  /** Cmd on Apple platforms, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  /** Fire even when a text field has focus. Off by default. */
  whileTyping?: boolean;
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement);

/** Binds a document-level shortcut for the lifetime of the component. */
export const useHotkey = (hotkey: Hotkey, handler: (event: KeyboardEvent) => void): void => {
  const { key, mod = false, shift = false, whileTyping = false } = hotkey;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (mod !== (event.metaKey || event.ctrlKey)) return;
      if (shift !== event.shiftKey) return;
      if (!whileTyping && !mod && isTypingTarget(event.target)) return;

      handler(event);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, mod, shift, whileTyping, handler]);
};

export const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

/** `⌘` on Apple platforms, `Ctrl` elsewhere. */
export const modifierLabel = (): string => (isApplePlatform() ? '⌘' : 'Ctrl');
