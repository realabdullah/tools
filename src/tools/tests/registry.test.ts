import { describe, expect, it } from 'vitest';
import { encodeText } from '../base64/lib/base64';
import { detectTools, searchTools, searchViews, toolByPath, tools, viewByPath } from '../registry';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

describe('registry', () => {
  it('exposes every tool by its path', () => {
    for (const tool of tools) expect(toolByPath(tool.path)).toBe(tool);
    expect(toolByPath('/nope')).toBeUndefined();
  });

  it('resolves a nested view to its tool, longest match first', () => {
    expect(toolByPath('/json/compare')?.id).toBe('json');
    expect(viewByPath('/json/compare')?.id).toBe('json-compare');
    expect(viewByPath('/json')?.id).toBe('json');
  });

  it('lists a tool’s views for the palette', () => {
    // A term that only a view knows about surfaces just that view.
    expect(searchViews('diff').map(({ view }) => view.id)).toEqual(['json-compare']);

    // Matching the tool itself offers every one of its views. "json" also
    // reaches JWT, whose keywords include "json web token" — as it should.
    const forJson = searchViews('json');
    expect(forJson.filter(({ tool }) => tool.id === 'json').map(({ view }) => view.id)).toEqual([
      'json',
      'json-compare',
    ]);
    expect(forJson.some(({ tool }) => tool.id === 'jwt')).toBe(true);
  });

  it('searches names, aliases and keywords', () => {
    expect(searchTools('token').map((tool) => tool.id)).toContain('jwt');
    expect(searchTools('atob').map((tool) => tool.id)).toEqual(['base64']);
    expect(searchTools('')).toEqual(tools);
    expect(searchTools('zzz')).toEqual([]);
  });
});

describe('intent detection', () => {
  it('puts JWT first for a token', () => {
    expect(detectTools(JWT)[0]?.tool.id).toBe('jwt');
  });

  it('offers decoding for Base64 that decodes to text', () => {
    const match = detectTools(encodeText('hello from the terminal'))[0];
    expect(match?.tool.id).toBe('base64');
    expect(match?.detection.action).toBe('Decode from Base64');
  });

  it('offers encoding for ordinary prose', () => {
    const match = detectTools('just some words')[0];
    expect(match?.tool.id).toBe('base64');
    expect(match?.detection.action).toBe('Encode to Base64');
  });

  it('has nothing to say about empty input', () => {
    expect(detectTools('   ')).toEqual([]);
  });
});
