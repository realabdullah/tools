import { base64Tool } from './base64/definition';
import { jwtTool } from './jwt/definition';
import { CONFIDENCE_ORDER, type ToolDefinition, type ToolMatch } from './types';

/**
 * Every capability, declared once. Routing, the command palette and intent
 * detection all read from here, so adding a workspace is a one-line change
 * plus a lazy route.
 */
export const tools: readonly ToolDefinition[] = [jwtTool, base64Tool];

export const toolBySlug = (slug: string): ToolDefinition | undefined =>
  tools.find((tool) => tool.slug === slug);

/** Substring search over name, slug, keywords and aliases. */
export const searchTools = (query: string): readonly ToolDefinition[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return tools;

  return tools.filter((tool) => {
    const haystack = [
      tool.name,
      tool.slug,
      tool.summary,
      ...tool.keywords,
      ...(tool.aliases ?? []),
    ];
    return haystack.some((entry) => entry.toLowerCase().includes(needle));
  });
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
