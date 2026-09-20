import { useCallback, useEffect, useRef, useState } from 'react';
import { writeClipboard } from '@/lib/clipboard';

type CopyState = 'idle' | 'copied' | 'failed';

/** Copy-to-clipboard with a short-lived confirmation state. */
export const useCopy = (resetAfterMs = 1400) => {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await writeClipboard(text);
      setState(ok ? 'copied' : 'failed');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), resetAfterMs);
      return ok;
    },
    [resetAfterMs],
  );

  return { state, copy };
};
