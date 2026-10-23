import { clearRuns, loadRuns, saveRun, type SavedRun } from "./history";
import { pauseLobby, resumeLobby, startLobby, stopLobby } from "./lobby";
import { regionUrl, type Region } from "./regions";
import { measureStun } from "./stun";
import type { Frame, Quality, Sample, UdpState } from "./types";

export type Snap = {
  running: boolean;
  arming: boolean;
  paused: boolean;
  elapsedMs: number;
  ema: number | null;
  last: number | null;
  jitter: number;
  lossWindow: number;
  lossSession: number;
  min: number | null;
  avg: number | null;
  max: number | null;
  p95: number | null;
  sent: number;
  lost: number;
  skipped: number;
  slips: number;
  scored: number;
  achievedHz: number;
  quality: Quality;
  stability: number | null;
  udp: number | null;
  udpState: UdpState;
  runs: SavedRun[];
};

const empty: Snap = {
  running: false,
  arming: false,
  paused: false,
  elapsedMs: 0,
  ema: null,
  last: null,
  jitter: 0,
  lossWindow: 0,
  lossSession: 0,
  min: null,
  avg: null,
  max: null,
  p95: null,
  sent: 0,
  lost: 0,
  skipped: 0,
  slips: 0,
  scored: 0,
  achievedHz: 0,
  quality: "idle",
  stability: null,
  udp: null,
  udpState: "pending",
  runs: [],
};

let snap: Snap = empty;
let points: Sample[] = [];
let session = 0;
let hidden = false;
let sessionOn = false;
let worker: Worker | null = null;
let udpTimer = 0;
let udpFails = 0;
let udpGen = 0;
let wake: WakeLockSentinel | null = null;
let region: Region | null = null;
const listeners = new Set<() => void>();

function publish(next: Snap) {
  snap = next;
  listeners.forEach((fn) => fn());
}

export function getSnap(): Snap {
  return snap;
}

export function getPoints(): Sample[] {
  return points;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function syncLobby() {
  if (sessionOn || hidden) pauseLobby();
  else resumeLobby();
}

function trim(elapsedMs: number) {
  const cutoff = elapsedMs - 12_000;
  if (cutoff <= 0 || !points.length || points[0].dt >= cutoff) return;
  let i = 0;
  while (i < points.length && points[i].dt < cutoff) i++;
  if (i > 0) points.splice(0, i);
}

function applyFrame(frame: Frame) {
  if (frame.session !== session) return;
  if (frame.samples.length) {
    points.push(...frame.samples);
    trim(frame.elapsedMs);
  }
  const stopped = sessionOn && !frame.running;
  publish({
    ...snap,
    running: frame.running,
    arming: frame.arming,
    paused: frame.paused,
    elapsedMs: frame.elapsedMs,
    ema: frame.ema,
    last: frame.last,
    jitter: frame.jitter,
    lossWindow: frame.lossWindow,
    lossSession: frame.lossSession,
    min: frame.min,
    avg: frame.avg,
    max: frame.max,
    p95: frame.p95,
    sent: frame.sent,
    lost: frame.lost,
    skipped: frame.skipped,
    slips: frame.slips,
    scored: frame.scored,
    achievedHz: frame.achievedHz,
    stability: frame.stability,
    quality: frame.quality,
  });
  if (stopped) finishSession();
}

function finishSession() {
  const scored = snap.scored;
  const avg = snap.avg;
  const had = sessionOn;
  sessionOn = false;
  syncLobby();
  void unlockScreen();
  if (!had || !region || scored < 16 || avg == null) return;
  const runs = saveRun({
    at: Date.now(),
    code: region.code,
    city: region.city,
    seconds: Math.max(1, Math.round(snap.elapsedMs / 1000)),
    avg,
    jitter: snap.jitter,
    loss: snap.lossSession,
    p95: snap.p95 ?? avg,
    udp: snap.udp,
    stability: snap.stability,
  });
  publish({ ...snap, runs, running: false, paused: false, arming: false, quality: "idle" });
}

async function lockScreen() {
  try {
    wake = await navigator.wakeLock?.request("screen");
  } catch {
    wake = null;
  }
}

async function unlockScreen() {
  try {
    await wake?.release();
  } catch {
    // Already released when the tab hid.
  }
  wake = null;
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./tick.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<Frame>) => applyFrame(ev.data);
  worker.onerror = () => {
    sessionOn = false;
    syncLobby();
    publish({ ...snap, running: false, arming: false, paused: false, quality: "idle" });
  };
  return worker;
}

export function startRange(next: Region, durationMs: number) {
  region = next;
  session += 1;
  sessionOn = true;
  points = [];
  syncLobby();
  void lockScreen();
  publish({
    ...snap,
    running: true,
    arming: true,
    paused: false,
    elapsedMs: 0,
    ema: null,
    last: null,
    jitter: 0,
    lossWindow: 0,
    lossSession: 0,
    min: null,
    avg: null,
    max: null,
    p95: null,
    sent: 0,
    lost: 0,
    skipped: 0,
    slips: 0,
    scored: 0,
    achievedHz: 0,
    quality: "idle",
    stability: null,
  });
  ensureWorker().postMessage({
    type: "start",
    session,
    url: regionUrl(next),
    durationMs,
  });
}

export function clearHistory(): void {
  clearRuns();
  publish({ ...snap, runs: [] });
}

export function stopRange() {
  worker?.postMessage({ type: "stop" });
}

function pauseSession() {
  if (!sessionOn) return;
  worker?.postMessage({ type: "pause" });
}

function resumeSession() {
  if (!sessionOn) return;
  worker?.postMessage({ type: "resume" });
  void lockScreen();
}

function loopUdp() {
  const token = udpGen;
  const server = udpFails >= 2 ? 1 : 0;
  measureStun(server)
    .then((ms) => {
      if (token !== udpGen) return;
      udpFails = 0;
      publish({ ...snap, udp: ms, udpState: "live" });
      udpTimer = window.setTimeout(loopUdp, 700);
    })
    .catch(() => {
      if (token !== udpGen) return;
      udpFails++;
      if (udpFails >= 3) publish({ ...snap, udpState: "blocked" });
      udpTimer = window.setTimeout(loopUdp, udpFails >= 3 ? 5000 : 1000);
    });
}

function startUdp() {
  if (udpTimer || hidden) return;
  udpGen++;
  loopUdp();
}

function stopUdp() {
  udpGen++;
  clearTimeout(udpTimer);
  udpTimer = 0;
}

function onVis() {
  hidden = document.hidden;
  if (hidden) {
    pauseSession();
    stopUdp();
  } else {
    resumeSession();
    startUdp();
  }
  syncLobby();
}

export function mountEngine(): () => void {
  snap = { ...empty, runs: loadRuns() };
  hidden = document.hidden;
  startLobby();
  if (!hidden) startUdp();
  syncLobby();
  publish(snap);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    stopLobby();
    stopUdp();
    worker?.postMessage({ type: "stop" });
    worker?.terminate();
    worker = null;
    sessionOn = false;
    void unlockScreen();
  };
}

export type { SavedRun };
