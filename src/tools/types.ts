import type { LucideIcon } from 'lucide-react';

/**
 * How confident a tool is that a piece of input belongs to it.
 *
 * Kept as a small ordered union rather than a float: the ranking only ever
 * needs to answer "which capability goes first", and a named scale keeps
 * detectors from inventing incomparable numbers.
 */
export type Confidence = 'exact' | 'likely' | 'possible';

export const CONFIDENCE_ORDER: Record<Confidence, number> = {
  exact: 3,
  likely: 2,
  possible: 1,
};

export type Detection = {
  confidence: Confidence;
  /** What this tool would do with the input, phrased as an action. */
  action: string;
};

/**
 * Every capability's path segment, as a closed union.
 *
 * This is what lets `to={`/${tool.slug}`}` typecheck against the router's
 * route tree: adding a workspace means adding its slug here, its route in the
 * router, and its definition to the registry — the compiler enforces all three.
 */
export type ToolSlug = 'jwt' | 'base64';

export type ToolDefinition = {
  id: string;
  /** Path segment. `/jwt`, `/base64`. Also the route id. */
  slug: ToolSlug;
  name: string;
  /** One line. Shown in the command palette and on the root surface. */
  summary: string;
  icon: LucideIcon;
  keywords: readonly string[];
  aliases?: readonly string[];
  /**
   * The intent seam. Given raw pasted/typed text, decide whether this tool is
   * the right destination. Pure and cheap — it runs on every keystroke at `/`.
   * Returning `null` means "not mine".
   */
  detect?: (input: string) => Detection | null;
};

export type ToolMatch = { tool: ToolDefinition; detection: Detection };
