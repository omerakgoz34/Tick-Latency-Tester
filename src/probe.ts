export type ProbeResult =
  | { ok: true; rtt: number }
  | { ok: false; rtt: number; discard: boolean };

export function probeOnce(
  url: string,
  timeoutMs: number,
  parent: AbortSignal,
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
    method: "GET",
    mode: "no-cors",
    cache: "no-store",
    credentials: "omit",
    redirect: "follow",
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
