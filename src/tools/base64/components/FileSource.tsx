import { FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { formatBytes } from '@/lib/bytes';
import { formatMediaType } from '../lib/files';
import type { BinarySource } from '../lib/files';

/** The loaded file, standing in for the text box while one is attached. */
export const FileSource = ({ file, onClear }: { file: BinarySource; onClear: () => void }) => {
  const url = useObjectUrl(file.bytes, file.type);
  const isImage = file.type.startsWith('image/');

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-4 text-center">
      {isImage && url ? (
        <img
          src={url}
          alt={file.name}
          className="border-border max-h-[min(18rem,40vh)] max-w-full rounded-sm border object-contain"
        />
      ) : (
        <FileUp size={28} aria-hidden className="text-fg-subtle" />
      )}

      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-fg max-w-full truncate font-mono text-xs">{file.name}</p>
        <p className="text-2xs text-fg-subtle">
          {formatMediaType(file.type)} · <span data-numeric>{formatBytes(file.size)}</span>
        </p>
      </div>

      <Button variant="subtle" onClick={onClear}>
        <X size={12} aria-hidden />
        Remove
      </Button>
    </div>
  );
};
