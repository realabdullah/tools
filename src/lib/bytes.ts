const UNITS = ['B', 'KB', 'MB'] as const;

export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
};

export const byteLength = (text: string): number => new TextEncoder().encode(text).length;
