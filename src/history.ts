const KEY = "tick-latency-runs";
const MAX = 8;

export type SavedRun = {
  at: number;
  code: string;
  city: string;
  seconds: number;
  avg: number;
  jitter: number;
  loss: number;
  p95: number;
  udp: number | null;
  stability: number | null;
};

export function loadRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRun[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.at === "number").slice(0, MAX);
  } catch {
    return [];
  }
}

export function clearRuns(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore private mode.
  }
}

export function saveRun(run: SavedRun): SavedRun[] {
  const next = [run, ...loadRuns()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode.
  }
  return next;
}
