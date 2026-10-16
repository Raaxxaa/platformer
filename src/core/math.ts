/** Moves `v` toward `target` by at most `delta` without passing it. */
export function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export function clampAbs(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}
