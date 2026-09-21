import { KeyRound } from 'lucide-react';
import type { ToolDefinition } from '../types';
import { looksLikeJwt } from './lib/decode-jwt';

export const jwtTool: ToolDefinition = {
  id: 'jwt',
  path: '/jwt',
  name: 'JWT',
  summary: 'Decode a token and verify its signature',
  icon: KeyRound,
  keywords: [
    'jwt',
    'token',
    'json web token',
    'claims',
    'bearer',
    'decode',
    'verify',
    'signature',
    'jws',
  ],
  aliases: ['token'],
  defaultViewName: 'Inspect',
  views: [
    {
      id: 'jwt-build',
      path: '/jwt/build',
      name: 'Build',
      summary: 'Compose and sign a token',
      keywords: ['sign', 'encode', 'build', 'create', 'generate', 'issue'],
    },
  ],
  detect: (input) =>
    looksLikeJwt(input) ? { confidence: 'exact', action: 'Inspect as a JWT' } : null,
};
