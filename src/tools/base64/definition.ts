import { ArrowLeftRight } from 'lucide-react';
import type { ToolDefinition } from '../types';
import { decodeText, looksLikeBase64 } from './lib/base64';

export const base64Tool: ToolDefinition = {
  id: 'base64',
  slug: 'base64',
  name: 'Base64',
  summary: 'Encode and decode, both directions at once',
  icon: ArrowLeftRight,
  keywords: ['base64', 'base64url', 'encode', 'decode', 'btoa', 'atob', 'utf-8'],
  aliases: ['b64', 'atob', 'btoa'],
  detect: (input) => {
    // Anything typed can be *encoded*, so Base64 always has an answer. It only
    // claims priority when the input decodes to readable text.
    if (looksLikeBase64(input) && decodeText(input).ok) {
      return { confidence: 'likely', action: 'Decode from Base64' };
    }
    return { confidence: 'possible', action: 'Encode to Base64' };
  },
};
