/**
 * Single source of truth for how long a login stays valid.
 *
 * A cafe till is often left logged in all day, so the ceiling is generous, but
 * it is a hard cap: no deployment can extend a session beyond it. Shorter
 * values are still allowed through SESSION_TTL_SECONDS for tighter setups.
 */

/** Longest any login may stay valid: 15 hours. */
export const MAX_SESSION_TTL_SECONDS = 15 * 60 * 60;

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Session lifetime in milliseconds, clamped to MAX_SESSION_TTL_SECONDS. */
export function sessionTtlMs(): number {
  const configured = Number(process.env.SESSION_TTL_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TTL_SECONDS;
  return Math.min(seconds, MAX_SESSION_TTL_SECONDS) * 1000;
}
