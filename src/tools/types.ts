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
 * Every route a capability owns, as a closed union.
 *
 * This is what lets `to={tool.path}` typecheck against the router's route
 * tree: a new workspace is added here, in the registry and in the router, and
 * the compiler will not let you forget one of the three.
 */
export type ToolPath = '/jwt' | '/base64' | '/json' | '/json/compare';

/**
 * A second way of working with the same material.
 *
 * Views exist so that a capability stays one environment instead of
 * fragmenting into unrelated pages: comparing JSON is still JSON.
 */
export type ToolView = {
  id: string;
  path: ToolPath;
  /** Short, and read after the tool name: "JSON · Compare". */
  name: string;
  summary: string;
  keywords: readonly string[];
};

export type ToolDefinition = {
  id: string;
  /** The default view's route. */
  path: ToolPath;
  name: string;
  /** One line. Shown in the command palette and on the root surface. */
  summary: string;
  icon: LucideIcon;
  keywords: readonly string[];
  aliases?: readonly string[];
  /** Additional views. The default view is the tool itself and is not listed. */
  views?: readonly ToolView[];
  /**
   * What the default view is called *alongside* its siblings — "Inspect"
   * rather than "JSON", which the breadcrumb already says. Only meaningful
   * for a tool that has more than one view.
   */
  defaultViewName?: string;
  /**
   * The intent seam. Given raw pasted/typed text, decide whether this tool is
   * the right destination. Pure and cheap — it runs on every keystroke at `/`.
   * Returning `null` means "not mine".
   */
  detect?: (input: string) => Detection | null;
};

export type ToolMatch = { tool: ToolDefinition; detection: Detection };

/** The tool's own default view, in the same shape as its other views. */
export const defaultView = (tool: ToolDefinition): ToolView => ({
  id: tool.id,
  path: tool.path,
  name: tool.defaultViewName ?? tool.name,
  summary: tool.summary,
  keywords: tool.keywords,
});

/** Every view a tool offers, default first. */
export const viewsOf = (tool: ToolDefinition): readonly ToolView[] => [
  defaultView(tool),
  ...(tool.views ?? []),
];
