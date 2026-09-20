import { KeyRound } from 'lucide-react';
import type { ToolDefinition } from '../types';
import { looksLikeJwt } from './lib/decode-jwt';

export const jwtTool: ToolDefinition = {
  id: 'jwt',
  path: '/jwt',
  name: 'JWT',
  summary: 'Inspect a token’s header, payload and claims',
  icon: KeyRound,
  keywords: ['jwt', 'token', 'json web token', 'claims', 'bearer', 'decode', 'jws'],
  aliases: ['token'],
  detect: (input) =>
    looksLikeJwt(input) ? { confidence: 'exact', action: 'Inspect as a JWT' } : null,
};
