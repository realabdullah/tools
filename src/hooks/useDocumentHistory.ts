import { useCallback, useMemo, useState } from 'react';

type Snapshot = {
  past: string[];
  present: string;
  future: string[];
  /** When the present was committed, for coalescing runs of typing. */
  at: number;
  coalescing: boolean;
};

/** Consecutive keystrokes inside this window become one undo step. */
const COALESCE_MS = 700;

export type DocumentHistory = {
  value: string;
  /** `coalesce` merges this into the previous step if it was a moment ago. */
  set: (next: string, options?: { coalesce?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Undo over the document text.
 *
 * One stack for the whole workspace rather than one per surface: a tree edit
 * and a keystroke change the same document, so an undo that only knew about
 * one of them would skip past the other.
 */
export const useDocumentHistory = (initial: string, limit = 200): DocumentHistory => {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    past: [],
    present: initial,
    future: [],
    at: 0,
    coalescing: false,
  });

  const set = useCallback(
    (next: string, { coalesce = false }: { coalesce?: boolean } = {}) => {
      setSnapshot((current) => {
        if (next === current.present) return current;

        const now = Date.now();
        const merge = coalesce && current.coalescing && now - current.at < COALESCE_MS;

        return {
          past: merge ? current.past : [...current.past, current.present].slice(-limit),
          present: next,
          future: [],
          at: now,
          coalescing: coalesce,
        };
      });
    },
    [limit],
  );

  const undo = useCallback(() => {
    setSnapshot((current) => {
      const previous = current.past.at(-1);
      if (previous === undefined) return current;

      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
        at: 0,
        coalescing: false,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setSnapshot((current) => {
      const [next, ...rest] = current.future;
      if (next === undefined) return current;

      return {
        past: [...current.past, current.present],
        present: next,
        future: rest,
        at: 0,
        coalescing: false,
      };
    });
  }, []);

  return useMemo(
    () => ({
      value: snapshot.present,
      set,
      undo,
      redo,
      canUndo: snapshot.past.length > 0,
      canRedo: snapshot.future.length > 0,
    }),
    [snapshot, set, undo, redo],
  );
};
