import { Braces } from 'lucide-react';
import type { ToolDefinition } from '../types';
import { locateSyntaxError } from './lib/parse';

export const jsonTool: ToolDefinition = {
  id: 'json',
  path: '/json',
  name: 'JSON',
  summary: 'Inspect, format, query and validate a document',
  icon: Braces,
  keywords: ['json', 'format', 'pretty', 'minify', 'validate', 'tree', 'query', 'path', 'jsonpath'],
  aliases: ['pretty', 'beautify'],
  defaultViewName: 'Inspect',
  views: [
    {
      id: 'json-compare',
      path: '/json/compare',
      name: 'Compare',
      summary: 'Diff two documents structurally',
      keywords: ['diff', 'compare', 'difference', 'changes', 'merge'],
    },
  ],
  detect: (input) => {
    const trimmed = input.trim();
    const opener = trimmed[0];
    if (opener !== '{' && opener !== '[') return null;

    // Broken JSON is exactly when this tool is most useful, so a document that
    // fails to parse still resolves here — it will be told what is wrong.
    return locateSyntaxError(trimmed) === null
      ? { confidence: 'exact', action: 'Inspect as JSON' }
      : { confidence: 'likely', action: 'Find the error in this JSON' };
  },
};
