import { probeOnce } from "./probe";
import { REGIONS, regionUrl, type Region } from "./regions";

export type EdgeState = {
  rtt: number | null;
  fails: number;
  seen: number;
};

type Mutable = Record<string, EdgeState>;

const rows: Mutable = {};
for (const region of REGIONS) {
  rows[region.id] = { rtt: null, fails: 0, seen: 0 };
}

let snap: Mutable = { ...rows };
const listeners = new Set<() => void>();
const warmed = new Set<string>();
const skip = new Map<string, number>();

let stopped = true;
let paused = false;
let cursor = 0;
let active = 0;
let timer = 0;
let touchTimer = 0;
let dirty = false;
let abort = new AbortController();

function publish() {
  snap = { ...rows };
  listeners.forEach((fn) => fn());
}

function touch() {
  dirty = true;
  if (touchTimer) return;
  touchTimer = window.setTimeout(() => {
    touchTimer = 0;
    if (!dirty) return;
    dirty = false;
    publish();
  }, 200);
}

export function getLobby(): Mutable {
  return snap;
}

export function subscribeLobby(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function shouldSkip(id: string, fails: number): boolean {
  if (fails < 2) return false;
  const n = (skip.get(id) ?? 0) + 1;
  skip.set(id, n);
  return n % 8 !== 0;
}

function nextRegion(): Region | null {
  for (let n = 0; n < REGIONS.length; n++) {
    const region = REGIONS[cursor % REGIONS.length];
    cursor++;
    if (shouldSkip(region.id, rows[region.id].fails)) continue;
    return region;
  }
  return null;
}

function launch(region: Region) {
  active++;
  const parent = abort.signal;
  probeOnce(regionUrl(region), 2500, parent).then((res) => {
    active--;
    if (stopped || parent.aborted) return;
    const prev = rows[region.id];
    if (res.ok) {
      if (!warmed.has(region.id)) {
        warmed.add(region.id);
        return;
      }
      skip.set(region.id, 0);
      rows[region.id] = { rtt: res.rtt, fails: 0, seen: prev.seen + 1 };
    } else if (!res.discard) {
      rows[region.id] = { rtt: prev.rtt, fails: prev.fails + 1, seen: prev.seen };
    }
    touch();
  });
}

function pump() {
  if (stopped) return;
  if (!paused && active < 3) {
    const region = nextRegion();
    if (region) launch(region);
  }
  timer = window.setTimeout(pump, 140);
}

export function startLobby() {
  if (!stopped) return;
  stopped = false;
  paused = false;
  abort = new AbortController();
  pump();
}

export function pauseLobby() {
  paused = true;
}

export function resumeLobby() {
  if (stopped) {
    startLobby();
    return;
  }
  paused = false;
}

export function stopLobby() {
  stopped = true;
  paused = true;
  clearTimeout(timer);
  abort.abort();
}
