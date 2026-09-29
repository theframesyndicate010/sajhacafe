import { MAX_SESSION_TTL_SECONDS, sessionTtlMs } from '../src/auth/session-ttl';

describe('session lifetime', () => {
  const original = process.env.SESSION_TTL_SECONDS;

  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_TTL_SECONDS;
    else process.env.SESSION_TTL_SECONDS = original;
  });

  it('caps every login at 15 hours even when configured longer', () => {
    process.env.SESSION_TTL_SECONDS = String(MAX_SESSION_TTL_SECONDS * 10);
    expect(sessionTtlMs()).toBe(15 * 60 * 60 * 1000);
  });

  it('keeps a shorter configured lifetime', () => {
    process.env.SESSION_TTL_SECONDS = '3600';
    expect(sessionTtlMs()).toBe(60 * 60 * 1000);
  });

  it('accepts exactly 15 hours', () => {
    process.env.SESSION_TTL_SECONDS = String(MAX_SESSION_TTL_SECONDS);
    expect(sessionTtlMs()).toBe(15 * 60 * 60 * 1000);
  });

  it('falls back to 8 hours when unset or nonsense', () => {
    delete process.env.SESSION_TTL_SECONDS;
    expect(sessionTtlMs()).toBe(8 * 60 * 60 * 1000);

    process.env.SESSION_TTL_SECONDS = 'not-a-number';
    expect(sessionTtlMs()).toBe(8 * 60 * 60 * 1000);

    process.env.SESSION_TTL_SECONDS = '-5';
    expect(sessionTtlMs()).toBe(8 * 60 * 60 * 1000);
  });
});
