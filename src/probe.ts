export type ProbeResult =
  | { ok: true; rtt: number }
  | { ok: false; rtt: number; discard: boolean };

export const MOVE_BYTES = 156;
export const BUSY_BYTES = 384;

const ALPHA = "abcdefghijklmnop";

function fill(size: number): string {
  let out = "";
  let x = (0x6d2b79f5 + size) >>> 0;
  for (let i = 0; i < size; i++) {
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
    out += ALPHA[x & 15];
  }
  return out;
}

const MOVE_BODY = fill(MOVE_BYTES);
const BUSY_BODY = fill(BUSY_BYTES);

export function tickBody(sent: number): string {
  return sent % 8 === 0 ? BUSY_BODY : MOVE_BODY;
}

export function probeOnce(
  url: string,
  timeoutMs: number,
  parent: AbortSignal,
  body?: string,
): Promise<ProbeResult> {
  if (parent.aborted) {
    return Promise.resolve({ ok: false, rtt: 0, discard: true });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onParent = () => ctrl.abort();
  parent.addEventListener("abort", onParent, { once: true });
  const t0 = performance.now();

  return fetch(url, {
    method: body ? "POST" : "GET",
    mode: "no-cors",
    cache: "no-store",
    credentials: "omit",
    redirect: "follow",
    headers: body ? { "content-type": "text/plain" } : undefined,
    body,
    signal: ctrl.signal,
  })
    .then(() => ({ ok: true as const, rtt: performance.now() - t0 }))
    .catch(() => ({
      ok: false as const,
      rtt: performance.now() - t0,
      discard: parent.aborted,
    }))
    .finally(() => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onParent);
    });
}
