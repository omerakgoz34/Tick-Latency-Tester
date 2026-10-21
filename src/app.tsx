/** @jsxImportSource preact */
import { useEffect, useRef, useState } from "preact/hooks";
import { PreviewHostBridge } from "./bridge";
import {
  getPoints,
  getSnap,
  mountEngine,
  startRange,
  stopRange,
  subscribe,
  type Snap,
} from "./engine";
import { clock, ms, pct, tone } from "./format";
import { paintGraph } from "./graph";
import { getLobby, subscribeLobby, type EdgeState } from "./lobby";
import { REGIONS, AREAS, type Region } from "./regions";
import { MOVE_BYTES, BUSY_BYTES } from "./probe";
import { TICK_HZ, ticksFor } from "./tick";

const REGION_KEY = "tick-latency-region";
const APP_VERSION = "v0.1.1";

const MODES = [
  { id: "15", label: "15s", ms: 15_000 },
  { id: "30", label: "30s", ms: 30_000 },
  { id: "60", label: "60s", ms: 60_000 },
  { id: "live", label: "Live", ms: 0 },
] as const;

function readRegion(): string | null {
  try {
    const id = localStorage.getItem(REGION_KEY);
    return REGIONS.some((region) => region.id === id) ? id : null;
  } catch {
    return null;
  }
}

function bestId(rows: Record<string, EdgeState>): string | null {
  let best: { id: string; rtt: number } | null = null;
  for (const region of REGIONS) {
    const row = rows[region.id];
    if (!row || row.rtt == null) continue;
    if (!best || row.rtt < best.rtt) best = { id: region.id, rtt: row.rtt };
  }
  return best?.id ?? null;
}

function when(at: number): string {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Graph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gridRef = useRef<SVGGElement>(null);
  const lossRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const grid = gridRef.current;
    const losses = lossRef.current;
    const trace = lineRef.current;
    if (!svg || !grid || !losses || !trace) return;
    let raf = 0;
    let alive = true;
    const draw = () => {
      const current = getSnap();
      paintGraph(svg, grid, losses, trace, getPoints(), current.elapsedMs, current.running);
    };
    const loop = () => {
      raf = 0;
      if (!alive) return;
      draw();
      if (getSnap().running) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kick();
    const unsub = subscribe(() => {
      if (getSnap().running) kick();
      else draw();
    });
    const observer = new ResizeObserver(draw);
    observer.observe(svg);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      unsub();
    };
  }, []);

  return (
    <svg ref={svgRef} class="graph" role="img" aria-label="Ping over the last 10 seconds">
      <g ref={gridRef} />
      <path ref={lossRef} class="losses" />
      <polyline ref={lineRef} class="trace" />
    </svg>
  );
}

export function App() {
  const [snap, setSnap] = useState<Snap>(getSnap);
  const [lobby, setLobby] = useState(getLobby);
  const [regionId, setRegionId] = useState<string | null>(readRegion);
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("15");

  useEffect(() => {
    const unsub = subscribe(() => setSnap(getSnap()));
    const unsubLobby = subscribeLobby(() => setLobby(getLobby()));
    const stop = mountEngine();
    setSnap(getSnap());
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") stopRange();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unsub();
      unsubLobby();
      stop();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (regionId) return;
    const id = bestId(lobby);
    if (id) setRegionId(id);
  }, [lobby, regionId]);

  useEffect(() => {
    if (!regionId) return;
    try {
      localStorage.setItem(REGION_KEY, regionId);
    } catch {
      // Ignore private mode.
    }
  }, [regionId]);

  const region = REGIONS.find((item) => item.id === regionId) ?? null;
  const best = bestId(lobby);
  const shown = snap.arming || snap.ema == null ? snap.last : snap.ema;
  const pingTone = tone(shown);
  const recent = getPoints().slice(-48);
  const cells = recent.length
    ? recent
    : Array.from({ length: 48 }, () => null);
  const skipDenom = snap.sent + snap.skipped;
  const skipRate = skipDenom ? snap.skipped / skipDenom : 0;
  const duration = MODES.find((item) => item.id === mode)?.ms ?? 15_000;
  const icon = `${import.meta.env.BASE_URL}favicon.svg`;

  return (
    <div class="shell">
      <PreviewHostBridge />
      <header class="topbar">
        <div class="brand">
          <img src={icon} alt="" width="36" height="36" />
          <div>
            <p class="kicker">128-tick netcode</p>
            <p class="brand-name">
              <b>TICK</b> LATENCY TESTER
            </p>
            <p class="version">{APP_VERSION}</p>
          </div>
        </div>
        <div class="udp-chip">
          <span>UDP PATH</span>
          <strong class={`tone-${snap.udpState === "blocked" ? "bad" : tone(snap.udp)}`}>
            {snap.udpState === "blocked" ? "Blocked" : snap.udp == null ? "…" : `${ms(snap.udp)} ms`}
          </strong>
        </div>
      </header>
      <div class="layout">
        <aside class="servers">
          <p class="servers-note">Public city edges. Not game servers.</p>
          {AREAS.map((area) => (
            <section key={area}>
              <h2 class="area">{area}</h2>
              {REGIONS.filter((item) => item.area === area).map((item) => (
                <EdgeButton
                  key={item.id}
                  region={item}
                  row={lobby[item.id]}
                  selected={item.id === regionId}
                  best={item.id === best}
                  locked={snap.running}
                  onPick={setRegionId}
                />
              ))}
            </section>
          ))}
        </aside>
        <main class="stage">
          <div class="stage-head">
            <h1>{region ? `${region.code}  ${region.city}` : "Pick a city"}</h1>
            <p>
              {snap.running ? clock(snap.elapsedMs) : `${TICK_HZ} hertz target`}
              {" · "}
              7.8 ms tick
            </p>
          </div>
          {snap.running && snap.paused && <p class="banner banner-warn">PAUSED</p>}
          {snap.running && !snap.paused && snap.arming && <p class="banner">ARMING LINK</p>}
          {snap.running && !snap.paused && !snap.arming && snap.quality === "bad" && (
            <p class="banner banner-bad" role="status">
              NETWORK PROBLEM
            </p>
          )}
          {snap.running && !snap.paused && !snap.arming && snap.quality === "warn" && (
            <p class="banner banner-warn" role="status">
              UNSTABLE
            </p>
          )}
          <div class="hero">
            <div>
              <p class={`ping tone-${pingTone}`}>
                {ms(shown)}
                <span class="ping-unit">ms</span>
              </p>
              <p class="ping-sub">
                {shown == null ? "Waiting for the first tick" : `${ticksFor(shown).toFixed(1)} server ticks`}
                {snap.last != null && snap.ema != null ? ` · last ${ms(snap.last)}` : ""}
              </p>
            </div>
            <div class="stats">
              <div class="stat">
                <b class={snap.scored ? `tone-${snap.jitter < 8 ? "good" : snap.jitter < 20 ? "warn" : "bad"}` : "tone-muted"}>{snap.scored ? ms(snap.jitter, 1) : "—"}</b>
                <span>Jitter</span>
              </div>
              <div class="stat">
                <b class={snap.lossWindow >= 4 ? "tone-bad" : snap.lossWindow >= 1 ? "tone-warn" : "tone-good"}>
                  {snap.scored ? pct(snap.lossWindow) : "—"}
                </b>
                <span>Loss, 2 seconds</span>
              </div>
              <div class="stat">
                <b>{snap.p95 == null ? "—" : ms(snap.p95)}</b>
                <span>95th percentile</span>
              </div>
            </div>
          </div>
          <div class="graph-wrap">
            <Graph />
            {snap.sent === 0 && <p class="graph-empty">Tick stream appears here</p>}
          </div>
          <div class="strip" aria-hidden="true">
            {cells.map((point, index) => (
              <span key={index} class={point == null ? "" : point.ok ? "ok" : "loss"} />
            ))}
          </div>
          <p class="meta">
            <span>Minimum {ms(snap.min)}</span>
            <span>Average {ms(snap.avg)}</span>
            <span>Maximum {ms(snap.max)}</span>
            <span>Session loss {snap.scored ? pct(snap.lossSession) : "—"}</span>
            <span>
              {snap.achievedHz}/{TICK_HZ} hertz
            </span>
            <span>
              {MOVE_BYTES}–{BUSY_BYTES} bytes
            </span>
          </p>
          {skipRate > 0.12 && snap.sent > 30 && (
            <p class="note">
              Some ticks were skipped so a slow reply would not queue locally and inflate the ping.
            </p>
          )}
          <div class="controls">
            {snap.running ? (
              <button type="button" class="stop" onClick={stopRange}>
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                class="go"
                disabled={!region}
                onClick={() => region && startRange(region, duration)}
              >
                <span>Start range</span>
              </button>
            )}
            <div class="seg" role="group" aria-label="Duration">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={mode === item.id}
                  disabled={snap.running}
                  onClick={() => setMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {snap.runs.length > 0 && (
            <section>
              <p class="runs-label">LAST RANGES</p>
              <ol class="runs">
                {snap.runs.map((run) => (
                  <li key={run.at}>
                    <span>{run.code}</span>
                    <span>{ms(run.avg)} ms</span>
                    <span>Jitter {ms(run.jitter, 1)}</span>
                    <span>Loss {pct(run.loss)}</span>
                    <span>
                      {run.seconds}s · {when(run.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <details class="how">
            <summary>How this measures</summary>
            <p>
              A 128-tick shooter sends a packet every 7.8 ms and times the round trip. This does
              that on a warm HTTPS/2 connection. Most ticks upload {MOVE_BYTES} bytes. Every eighth
              tick uploads {BUSY_BYTES} bytes, closer to a busy client update than an empty check.
              Handshake samples are thrown out. The reply stays short. The edge does not send a
              world snapshot back.
            </p>
            <p>
              Jitter is the RFC 3550 average. Loss is a probe that was sent and did not return.
              Stopping the test does not count as loss. If the link cannot hold that many probes in
              flight, extra ticks are skipped instead of queued.
            </p>
            <p>
              UDP PATH is a STUN datagram to the nearest public relay. That number is closer to
              in-game ping. The city list is a cloud edge in that city, not a game server. A real
              match can be lower where the game peers off the public internet.
            </p>
            <p>A live range is a few megabytes a minute. The screen stays awake while it runs.</p>
          </details>
        </main>
      </div>
    </div>
  );
}

function EdgeButton({
  region,
  row,
  selected,
  best,
  locked,
  onPick,
}: {
  region: Region;
  row: EdgeState | undefined;
  selected: boolean;
  best: boolean;
  locked: boolean;
  onPick: (id: string) => void;
}) {
  const offline = (row?.fails ?? 0) >= 2 && row?.rtt == null;
  const value = row?.rtt ?? null;
  return (
    <button
      type="button"
      class={selected ? "edge is-on" : "edge"}
      aria-pressed={selected}
      disabled={locked}
      onClick={() => onPick(region.id)}
    >
      <span class="edge-code">{region.code}</span>
      <span class="edge-city">
        {region.city}
        {best && <em>Best</em>}
      </span>
      <span class={`edge-ping tone-${tone(value)}`}>
        {offline ? "Off" : value == null ? "···" : ms(value)}
      </span>
    </button>
  );
}
