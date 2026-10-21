export const TICK_HZ = 128;
export const TICK_MS = 1000 / TICK_HZ;
const WARMUP_OK = 4;

export { WARMUP_OK };

export function ticksFor(ms: number): number {
  return ms / TICK_MS;
}

// Keep about one RTT of probes in flight. Extra ticks are skipped, not queued.
export function inFlightCap(ema: number | null): number {
  if (ema == null) return 8;
  return Math.min(24, Math.max(4, Math.ceil(ema / TICK_MS) + 3));
}

export function probeTimeout(ema: number | null): number {
  if (ema == null) return 1200;
  return Math.min(3000, Math.max(800, ema * 8));
}
