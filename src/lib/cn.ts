type ClassValue = string | number | false | null | undefined;

/** Joins class names, dropping falsy branches. No merge logic — order wins. */
export const cn = (...values: ClassValue[]): string =>
  values.filter((value): value is string | number => Boolean(value)).join(' ');
