import { useEffect, useState } from 'react';

/**
 * An object URL for some bytes, revoked when they change or the view goes.
 *
 * The URL cannot be derived during render: creating it registers something
 * with the browser, and a render that is thrown away — which React does on
 * purpose in development — would leave that registration behind, or revoke one
 * that is still on screen.
 *
 * So it is created in an effect, which is exactly the "synchronise with an
 * external system" case effects exist for, and stored alongside the bytes it
 * belongs to so a revoked URL is never rendered.
 */
export const useObjectUrl = (
  bytes: Uint8Array<ArrayBuffer> | null,
  mediaType: string,
): string | null => {
  const [entry, setEntry] = useState<{ bytes: Uint8Array<ArrayBuffer>; url: string } | null>(null);

  useEffect(() => {
    if (bytes === null) return;

    // The browser hands back the handle here, so there is nowhere else for it
    // to come from: this is the "subscribe to an external system" case.
    const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ bytes, url });

    return () => URL.revokeObjectURL(url);
  }, [bytes, mediaType]);

  return entry?.bytes === bytes ? entry.url : null;
};
