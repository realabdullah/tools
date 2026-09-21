import { decodeToBytes, encodeBytes, type Base64Variant } from './base64';

/**
 * Files, which is half of what Base64 is for.
 *
 * Encoding an image into a data URI, or pulling a PDF back out of a payload,
 * are the cases a text box cannot serve. Everything happens in the tab: the
 * file is read with FileReader and never uploaded.
 */

export type BinarySource = {
  name: string;
  /** The type the browser reported, or a guess from the extension. */
  type: string;
  size: number;
  bytes: Uint8Array<ArrayBuffer>;
};

export const readFile = async (file: File): Promise<BinarySource> => ({
  name: file.name,
  type: file.type || 'application/octet-stream',
  size: file.size,
  bytes: new Uint8Array(await file.arrayBuffer()),
});

/** Wraps Base64 at a fixed width, as MIME requires and PEM blocks use. */
export const wrapLines = (value: string, width: number): string => {
  if (width <= 0 || value.length <= width) return value;

  const lines: string[] = [];
  for (let index = 0; index < value.length; index += width) {
    lines.push(value.slice(index, index + width));
  }
  return lines.join('\n');
};

export const toDataUri = (source: BinarySource, variant: Base64Variant = 'standard'): string =>
  `data:${source.type};base64,${encodeBytes(source.bytes, variant)}`;

export type DataUri = { mediaType: string; base64: string };

const DATA_URI = /^data:([^;,]*)((?:;[^;,]+)*),(.*)$/s;

/** Splits a data URI so the payload can be decoded on its own. */
export const parseDataUri = (value: string): DataUri | null => {
  const match = DATA_URI.exec(value.trim());
  if (!match) return null;

  const parameters = match[2] ?? '';
  if (!parameters.includes(';base64')) return null;

  return { mediaType: match[1] || 'application/octet-stream', base64: match[3] ?? '' };
};

export type DecodedFile = { bytes: Uint8Array<ArrayBuffer>; mediaType: string };

/** Base64, or a whole data URI, back into bytes ready to be saved. */
export const decodeToFile = (value: string): DecodedFile | null => {
  const uri = parseDataUri(value);
  const payload = uri?.base64 ?? value;

  const decoded = decodeToBytes(payload);
  if (!decoded.ok) return null;

  return { bytes: decoded.bytes, mediaType: uri?.mediaType ?? 'application/octet-stream' };
};

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/zip': 'zip',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
};

export const extensionFor = (mediaType: string): string =>
  EXTENSIONS[mediaType.toLowerCase()] ?? 'bin';

/**
 * Sniffs a media type from the bytes themselves.
 *
 * Decoded Base64 carries no filename, so the only honest way to offer a
 * sensible download is to look at what the bytes start with.
 */
export const sniffMediaType = (bytes: Uint8Array): string | null => {
  const starts = (...signature: number[]): boolean =>
    signature.every((byte, index) => bytes[index] === byte);

  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (starts(0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
  // RIFF is a container; the format lives four bytes further in.
  if (starts(0x52, 0x49, 0x46, 0x46)) {
    const isWebp = [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[8 + index] === byte);
    if (isWebp) return 'image/webp';
  }
  return null;
};

/** Hands the bytes to the browser as a download. */
export const downloadBytes = (
  bytes: Uint8Array<ArrayBuffer>,
  mediaType: string,
  name: string,
): void => {
  const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

export const formatMediaType = (mediaType: string): string =>
  mediaType.replace('application/', '').replace('image/', '');
