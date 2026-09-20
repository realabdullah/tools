import { describe, expect, it } from 'vitest';
import { evaluateValidity, parseTimeClaim } from '../lib/claims';

const NOW = new Date('2026-09-20T12:00:00.000Z');

describe('parseTimeClaim', () => {
  it('reads seconds since the epoch', () => {
    const claim = parseTimeClaim(1516239022, NOW);
    expect(claim?.iso).toBe('2018-01-18T01:30:22.000Z');
    expect(claim?.milliseconds).toBe(false);
  });

  it('reads numeric strings, which some issuers emit', () => {
    expect(parseTimeClaim('1516239022', NOW)?.iso).toBe('2018-01-18T01:30:22.000Z');
  });

  it('flags values that are really milliseconds', () => {
    const claim = parseTimeClaim(1_758_369_600_000, NOW);
    expect(claim?.milliseconds).toBe(true);
    expect(claim?.iso).toBe('2025-09-20T12:00:00.000Z');
  });

  it('ignores values that are not times', () => {
    expect(parseTimeClaim('soon', NOW)).toBeNull();
    expect(parseTimeClaim(null, NOW)).toBeNull();
    expect(parseTimeClaim(-5, NOW)).toBeNull();
  });

  it('describes the distance from now', () => {
    const inAnHour = Math.floor(NOW.getTime() / 1000) + 3600;
    expect(parseTimeClaim(inAnHour, NOW)?.relative).toMatch(/hour/);
  });
});

describe('evaluateValidity', () => {
  const seconds = (offset: number) => Math.floor(NOW.getTime() / 1000) + offset;

  it('reports an expired token', () => {
    expect(evaluateValidity({ exp: seconds(-60) }, NOW)).toMatchObject({ status: 'expired' });
  });

  it('reports a token that is not valid yet', () => {
    expect(evaluateValidity({ nbf: seconds(600) }, NOW)).toMatchObject({
      status: 'not-yet-valid',
    });
  });

  it('reports a live token', () => {
    expect(evaluateValidity({ exp: seconds(600) }, NOW)).toMatchObject({ status: 'valid' });
  });

  it('says so when there is no expiry claim at all', () => {
    expect(evaluateValidity({ sub: 'x' }, NOW)).toMatchObject({ status: 'unknown' });
  });

  it('has nothing to say about an unreadable payload', () => {
    expect(evaluateValidity(null, NOW)).toMatchObject({ status: 'unknown' });
  });
});
