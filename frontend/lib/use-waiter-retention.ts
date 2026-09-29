"use client";

import { useEffect, useState } from "react";

const WAITER_RETENTION_MS = 18 * 60 * 60 * 1000;

export function useWaiterRecentEntries<T extends { createdAt?: string | Date }>(entries: T[]) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const nextExpiry = entries.reduce((earliest, entry) => {
      if (!entry.createdAt) return earliest;
      const createdAt = new Date(entry.createdAt).getTime();
      const expiresAt = createdAt + WAITER_RETENTION_MS;
      return Number.isFinite(expiresAt) && expiresAt > now ? Math.min(earliest, expiresAt) : earliest;
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, nextExpiry - now));
    return () => window.clearTimeout(timer);
  }, [entries, now]);

  const cutoff = now - WAITER_RETENTION_MS;
  return entries.filter((entry) => {
    if (!entry.createdAt) return false;
    const createdAt = new Date(entry.createdAt).getTime();
    return Number.isFinite(createdAt) && createdAt > cutoff;
  });
}
