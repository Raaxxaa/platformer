// window.__game debug API and the ?debug=1 switch (00-README "Debug hook").
import type { CameraState } from '../core/camera.ts';
import type { PlayerBody } from '../core/player/body.ts';
import type { InputSpec, PlayerSim } from '../core/sim/playerSim.ts';

export interface GameDebugApi {
  ready: boolean;
  tick(): number;
  body(): PlayerBody;              // a copy
  camera(): CameraState;           // a copy
  setManual(on: boolean): void;    // manual: the scene stops stepping by itself and ignores devices
  step(n: number, spec?: InputSpec): void;  // run n ticks holding `spec` (pressed on the first tick only)
  teleport(x: number, y: number): void;     // fresh body with its feet at (x, y), camera snapped
}

declare global {
  interface Window { __game?: GameDebugApi }
}

/** Dev builds, or any build opened with ?debug=1. */
export function debugEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

export interface DebugHost {
  readonly sim: PlayerSim;
  setManual(on: boolean): void;
}

export function installDebugApi(host: DebugHost): void {
  window.__game = {
    ready: true,
    tick: () => host.sim.tick,
    body: () => structuredClone(host.sim.body),
    camera: () => structuredClone(host.sim.camera),
    setManual: (on) => host.setManual(on),
    step: (n, spec = {}) => { host.sim.stepSpec(spec, n); },
    teleport: (x, y) => host.sim.respawn({ x, y }),
  };
}
