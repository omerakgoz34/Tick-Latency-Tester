export type Sample = {
  dt: number;
  rtt: number;
  ok: boolean;
};

export type Quality = "idle" | "good" | "warn" | "bad";

export type UdpState = "pending" | "live" | "blocked";

export type Frame = {
  type: "frame";
  session: number;
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
  baseline: number | null;
  sent: number;
  lost: number;
  skipped: number;
  slips: number;
  scored: number;
  achievedHz: number;
  stability: number | null;
  quality: Quality;
  samples: Sample[];
};

export type InMsg =
  | { type: "start"; session: number; url: string; durationMs: number }
  | { type: "stop" }
  | { type: "pause" }
  | { type: "resume" };
