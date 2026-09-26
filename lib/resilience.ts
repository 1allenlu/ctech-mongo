// Keeps the demo from hanging on stage: time limits and fallbacks.

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Runs `primary`; if it throws or takes longer than `ms`, returns `fallback()` instead.
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(primary(), ms, label);
  } catch (err) {
    console.warn(`[${label}] using fallback:`, err instanceof Error ? err.message : err);
    return fallback();
  }
}

// Adds a server-selection limit to a MongoDB URI unless it already has one, so an
// unreachable cluster fails in seconds instead of the driver's 30s default.
export function withServerSelectionTimeout(uri: string, ms: number): string {
  try {
    const url = new URL(uri.trim());
    if (!url.searchParams.has("serverSelectionTimeoutMS")) url.searchParams.set("serverSelectionTimeoutMS", String(ms));
    return url.toString();
  } catch {
    return uri;
  }
}
