import { describe, expect, it } from 'vitest';
import { parseJson } from '../lib/parse';
import { repairJson } from '../lib/repair';

/** Repairing must always produce something the parser accepts. */
const repaired = (source: string) => {
  const result = repairJson(source);
  const parsed = parseJson(result.text);
  expect(parsed.ok, `repaired output did not parse: ${result.text}`).toBe(true);
  return { ...result, value: parsed.ok ? parsed.value : null };
};

describe('repairJson', () => {
  it('leaves valid JSON exactly as it was', () => {
    const source = '{\n  "a": 1,\n  "b": [true, null]\n}';
    const result = repairJson(source);
    expect(result.repairs).toEqual([]);
    expect(result.text).toBe(source);
  });

  it('removes trailing commas', () => {
    expect(repaired('{"a": 1,}').value).toEqual({ a: 1 });
    expect(repaired('[1, 2, ]').value).toEqual([1, 2]);
    expect(repaired('{"a": [1,],}').value).toEqual({ a: [1] });
  });

  it('converts single-quoted strings', () => {
    expect(repaired("{'a': 'hello'}").value).toEqual({ a: 'hello' });
  });

  it('quotes bare property names', () => {
    expect(repaired('{a: 1, b_2: "x", $c: 3}').value).toEqual({ a: 1, b_2: 'x', $c: 3 });
  });

  it('strips comments of both kinds', () => {
    const source = '{\n  // a note\n  "a": 1, /* inline */ "b": 2\n}';
    expect(repaired(source).value).toEqual({ a: 1, b: 2 });
  });

  it('translates literals from other languages', () => {
    expect(repaired('{"a": True, "b": False, "c": None}').value).toEqual({
      a: true,
      b: false,
      c: null,
    });
    expect(repaired('{"a": undefined, "b": NaN}').value).toEqual({ a: null, b: null });
  });

  it('normalises numbers JSON does not allow', () => {
    expect(repaired('{"a": +1, "b": .5}').value).toEqual({ a: 1, b: 0.5 });
  });

  it('closes containers that were cut off', () => {
    expect(repaired('{"a": {"b": [1, 2').value).toEqual({ a: { b: [1, 2] } });
  });

  it('inserts separators that were missing', () => {
    expect(repaired('{"a": 1 "b": 2}').value).toEqual({ a: 1, b: 2 });
    expect(repaired('[1 2]').value).toEqual([1, 2]);
  });

  it('straightens curly quotes', () => {
    expect(repaired('{“a”: “b”}').value).toEqual({ a: 'b' });
  });

  it('quotes a bare value, which is usually a missing quote', () => {
    expect(repaired('{"status": pending}').value).toEqual({ status: 'pending' });
  });

  it('handles a document broken in several ways at once', () => {
    const source = `{
      // config
      name: 'billing',
      replicas: 2,
      hosts: ['a.example.com', 'b.example.com',],
      limits: {rps: 100, burst: None},
    }`;
    expect(repaired(source).value).toEqual({
      name: 'billing',
      replicas: 2,
      hosts: ['a.example.com', 'b.example.com'],
      limits: { rps: 100, burst: null },
    });
  });

  it('preserves escapes and Unicode inside strings', () => {
    expect(repaired('{a: "line\\nbreak", b: "Ada Løvelace 🧮"}').value).toEqual({
      a: 'line\nbreak',
      b: 'Ada Løvelace 🧮',
    });
  });

  it('keeps a double quote that was escaped inside single quotes', () => {
    expect(repaired(`{'a': 'he said "hi"'}`).value).toEqual({ a: 'he said "hi"' });
  });

  it('reports what it did, without repeating itself', () => {
    const result = repairJson("{a: 1, b: 'x',}");
    const kinds = result.repairs.map((repair) => repair.kind);
    expect(kinds).toContain('unquoted-key');
    expect(kinds).toContain('single-quotes');
    expect(kinds).toContain('trailing-comma');
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('has nothing to say about empty input', () => {
    expect(repairJson('   ')).toEqual({ text: '   ', repairs: [] });
  });
});
