const store = new Map<string, { exp: number; val: any }>();

export async function cacheWrap<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.val;
  const val = await fn();
  store.set(key, { exp: now + ttlSec * 1000, val });
  return val;
}
