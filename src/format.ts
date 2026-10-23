export type Tone = "good" | "warn" | "bad" | "muted";

export function tone(n: number | null): Tone {
  if (n == null || !Number.isFinite(n)) return "muted";
  if (n < 40) return "good";
  if (n < 80) return "warn";
  return "bad";
}

export function ms(n: number | null, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return digits ? n.toFixed(digits) : String(Math.round(n));
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)}%`;
}

export function gamingScore(avg: number, jitter: number): number {
  if (!Number.isFinite(avg) || !Number.isFinite(jitter)) return 0;
  return (avg * jitter) / 100;
}

export function clock(value: number): string {
  const total = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${total}s`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
