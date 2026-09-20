import { base64Tool } from './base64/definition';
import { jsonTool } from './json/definition';
import { jwtTool } from './jwt/definition';
import {
  CONFIDENCE_ORDER,
  viewsOf,
  type ToolDefinition,
  type ToolMatch,
  type ToolView,
} from './types';

/**
 * Every capability, declared once. Routing, the command palette and intent
 * detection all read from here, so adding a workspace is a one-line change
 * plus a lazy route.
 */
export const tools: readonly ToolDefinition[] = [jsonTool, jwtTool, base64Tool];

/** The tool that owns a pathname, including any of its nested views. */
export const toolByPath = (pathname: string): ToolDefinition | undefined =>
  tools.find((tool) =>
    viewsOf(tool).some((view) => view.path === pathname || pathname.startsWith(`${view.path}/`)),
  );

export const viewByPath = (pathname: string): ToolView | undefined => {
  const tool = toolByPath(pathname);
  if (!tool) return undefined;
  // Longest match wins, so /json/compare does not resolve to /json.
  return [...viewsOf(tool)]
    .sort((a, b) => b.path.length - a.path.length)
    .find((view) => pathname === view.path || pathname.startsWith(`${view.path}/`));
};

/** Substring search over names, summaries, keywords, aliases and views. */
export const searchTools = (query: string): readonly ToolDefinition[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return tools;

  return tools.filter((tool) => {
    const haystack = [
      tool.name,
      tool.path,
      tool.summary,
      ...tool.keywords,
      ...(tool.aliases ?? []),
      ...(tool.views ?? []).flatMap((view) => [view.name, view.summary, ...view.keywords]),
    ];
    return haystack.some((entry) => entry.toLowerCase().includes(needle));
  });
};

/** Views matching a query, across every tool — what the palette lists. */
export const searchViews = (query: string): readonly { tool: ToolDefinition; view: ToolView }[] => {
  const needle = query.trim().toLowerCase();

  return searchTools(query).flatMap((tool) =>
    viewsOf(tool)
      .filter((view) => {
        if (!needle) return true;
        // A tool matched by its own name should list all of its views.
        const toolMatches = [tool.name, ...tool.keywords, ...(tool.aliases ?? [])].some((entry) =>
          entry.toLowerCase().includes(needle),
        );
        if (toolMatches) return true;
        return [view.name, view.summary, ...view.keywords].some((entry) =>
          entry.toLowerCase().includes(needle),
        );
      })
      .map((view) => ({ tool, view })),
  );
};

const MAX_DETECTION_INPUT = 200_000;

/**
 * Asks every tool what it would make of `input`, best match first.
 * Long input is sampled rather than skipped: detectors only need the shape.
 */
export const detectTools = (input: string): readonly ToolMatch[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const sample =
    trimmed.length > MAX_DETECTION_INPUT ? trimmed.slice(0, MAX_DETECTION_INPUT) : trimmed;

  return tools
    .flatMap((tool) => {
      const detection = tool.detect?.(sample);
      return detection ? [{ tool, detection }] : [];
    })
    .sort(
      (a, b) => CONFIDENCE_ORDER[b.detection.confidence] - CONFIDENCE_ORDER[a.detection.confidence],
    );
};
