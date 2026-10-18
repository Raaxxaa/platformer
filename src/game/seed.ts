// The debug URL may select a typed seed; ignored/empty parameters remain random runs (06 §7.1).
export function debugSeed(query: URLSearchParams): string | null {
  return query.get('debug') === '1' ? query.get('seed')?.toUpperCase() || null : null;
}
