// The debug URL may select a typed seed; ignored/empty parameters remain random runs (06 §7.1).
export function debugSeed(query: URLSearchParams): string | null {
  return query.get('debug') === '1' ? query.get('seed')?.toUpperCase() || null : null;
}
import { RANDOM_SEED } from '../data/run.ts';
export function randomSeed(): string {
  const bytes = new Uint8Array(RANDOM_SEED.length); crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => RANDOM_SEED.alphabet[b % RANDOM_SEED.alphabet.length]).join('');
}
