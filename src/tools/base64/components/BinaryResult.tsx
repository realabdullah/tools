import { Download, FileDigit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { formatBytes } from '@/lib/bytes';
import { downloadBytes, extensionFor, formatMediaType, sniffMediaType } from '../lib/files';

/**
 * What Base64 decodes to when it is not text.
 *
 * An earlier version called this an error — "not valid UTF-8" — which is true
 * and useless: most Base64 in the wild is an image or a PDF. Bytes get a
 * preview and a download instead of a complaint.
 */
export const BinaryResult = ({
  bytes,
  mediaType,
}: {
  bytes: Uint8Array<ArrayBuffer>;
  mediaType: string;
}) => {
  const sniffed = sniffMediaType(bytes) ?? mediaType;
  const url = useObjectUrl(bytes, sniffed);
  const isImage = sniffed.startsWith('image/');

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-4 text-center">
      {isImage && url ? (
        <img
          src={url}
          alt="Decoded image"
          className="border-border max-h-[min(22rem,50vh)] max-w-full rounded-sm border object-contain"
        />
      ) : (
        <FileDigit size={28} aria-hidden className="text-fg-subtle" />
      )}

      <div className="flex flex-col gap-0.5">
        <p className="text-fg text-xs">
          {formatMediaType(sniffed)} · <span data-numeric>{formatBytes(bytes.length)}</span>
        </p>
        <p className="text-2xs text-fg-subtle">
          These bytes are not text, so there is nothing to show as characters.
        </p>
      </div>

      <Button
        variant="subtle"
        onClick={() => downloadBytes(bytes, sniffed, `decoded.${extensionFor(sniffed)}`)}
      >
        <Download size={12} aria-hidden />
        Download
      </Button>
    </div>
  );
};
