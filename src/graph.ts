import type { Sample } from "./types";

const WINDOW_MS = 10_000;

export function paintGraph(
  svg: SVGSVGElement,
  grid: SVGGElement,
  losses: SVGPathElement,
  trace: SVGPolylineElement,
  points: Sample[],
  elapsedMs: number,
  running: boolean,
) {
  const w = svg.clientWidth;
  const h = svg.clientHeight;
  if (w < 2 || h < 2) return;

  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const padL = 34;
  const padR = 8;
  const padT = 8;
  const padB = 8;
  const iw = Math.max(1, w - padL - padR);
  const ih = Math.max(1, h - padT - padB);
  const end = points.length ? Math.max(elapsedMs, points[points.length - 1].dt) : elapsedMs;
  const start = Math.max(0, (running ? elapsedMs : end) - WINDOW_MS);

  let maxR = 40;
  for (const point of points) {
    if (point.dt < start || !point.ok) continue;
    if (point.rtt > maxR) maxR = point.rtt;
  }
  maxR = Math.max(40, Math.ceil(maxR / 20) * 20);

  const steps = 4;
  let gridMarkup = "";
  for (let i = 0; i <= steps; i++) {
    const y = padT + (ih * i) / steps;
    const label = Math.round(maxR - (maxR * i) / steps);
    gridMarkup += `<line class="stroke-line" stroke-width="1" x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" />`;
    gridMarkup += `<text class="fill-muted font-sans text-[11px] select-none" x="2" y="${y + 3}">${label}</text>`;
  }
  grid.innerHTML = gridMarkup;

  let lossD = "";
  let coords = "";
  for (const point of points) {
    if (point.dt < start || point.dt > end) continue;
    const x = padL + ((point.dt - start) / WINDOW_MS) * iw;
    if (!point.ok) {
      lossD += `M${x.toFixed(1)} ${padT}V${(padT + ih).toFixed(1)}`;
      continue;
    }
    const y = padT + ih - (Math.min(point.rtt, maxR) / maxR) * ih;
    coords += `${x.toFixed(1)},${y.toFixed(1)} `;
  }
  losses.setAttribute("d", lossD);
  trace.setAttribute("points", coords);
}
