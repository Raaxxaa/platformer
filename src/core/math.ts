/** Moves `v` toward `target` by at most `delta` without passing it. */
export function approach(v: number, target: number, delta: number): number {
  return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
}

export function clampAbs(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}

/** Round half up (02 §3.1 step 7): Math.floor(x + 0.5), with a tiny epsilon against float error. */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9);
}
