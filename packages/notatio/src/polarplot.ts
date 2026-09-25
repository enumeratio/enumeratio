// Pure polar-plot geometry: (θ, r) samples in, an SVG string out. The element
// layer evaluates r(θ) with the compute engine and hands this module plain
// numbers, exactly as contour.ts takes an already-sampled grid. Equal aspect
// (a circle stays a circle) and no randomness, so the output is deterministic.

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

export interface PolarPoint {
  theta: number;
  r: number;
}

/** Polar → Cartesian. A negative `r` points the opposite way, as in Wolfram. */
export function polarToCartesian(theta: number, r: number): { x: number; y: number } {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/**
 * Sample `f` at `n` evenly spaced angles across `[t0, t1]` (both endpoints
 * included). Non-finite radii are kept as-is -- the renderer turns them into
 * gaps rather than dropping them, so a pole doesn't join two branches.
 */
export function samplePolar(f: (theta: number) => number, t0: number, t1: number, n: number): PolarPoint[] {
  const count = Math.max(2, Math.round(n));
  return Array.from({ length: count }, (_, i) => {
    const theta = t0 + ((t1 - t0) * i) / (count - 1);
    let r: number;
    try {
      r = f(theta);
    } catch {
      r = Number.NaN;
    }
    return { theta, r: typeof r === "number" ? r : Number.NaN };
  });
}

export interface PolarPlotOptions {
  width?: number;
  height?: number;
  /** Draw the polar grid: rings plus 30° spokes (default true). */
  axes?: boolean;
  /** Close the path back to its first point (default false). */
  closed?: boolean;
  /** Fill the enclosed region under the curve (default false). */
  filled?: boolean;
  /** Draw a dot at each sample -- the ListPolarPlot look (default false). */
  markers?: boolean;
  /** Explicit outer radius; otherwise the largest sampled |r|. */
  max?: number;
  title?: string;
}

const frame = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="polar plot">${body}</svg>`;

function titleSvg(w: number, title: string | undefined): string {
  return title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";
}

/** A "nice" ring radius: 1, 2 or 5 × a power of ten, at most `max`. */
function ringStep(max: number): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1;
  const raw = max / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

/**
 * Render polar `points` as a curve on a polar grid (Wolfram's `PolarPlot`, or
 * `ListPolarPlot` with `markers`). The plot area is square and centred, so
 * angles aren't sheared; non-finite radii break the path into subpaths.
 */
export function polarPlotSvg(points: readonly PolarPoint[], opts: PolarPlotOptions = {}): string {
  const W = opts.width ?? 260;
  const H = opts.height ?? 260;
  const pad = 14;
  const top = opts.title ? 26 : pad;

  const finite = points.filter((p) => Number.isFinite(p.r) && Number.isFinite(p.theta));
  const rMax = opts.max && opts.max > 0 ? opts.max : finite.reduce((m, p) => Math.max(m, Math.abs(p.r)), 0) || 1;

  const cx = W / 2;
  const cy = top + (H - top - pad) / 2;
  const R = Math.min(W / 2 - pad, (H - top - pad) / 2);
  if (finite.length === 0 || R <= 0) return frame(W, H, titleSvg(W, opts.title));

  const px = (theta: number, r: number): [number, number] => {
    const c = polarToCartesian(theta, r);
    // Screen y grows downward, so the mathematical +y axis points up.
    return [cx + (c.x / rMax) * R, cy - (c.y / rMax) * R];
  };

  let grid = "";
  if (opts.axes !== false) {
    const step = ringStep(rMax);
    for (let r = step; r <= rMax + step * 1e-9; r += step) {
      grid += `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2((r / rMax) * R)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.35"/>`;
    }
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const [ex, ey] = px(a, rMax);
      grid += `<line x1="${n2(cx)}" y1="${n2(cy)}" x2="${n2(ex)}" y2="${n2(ey)}" stroke="${AXIS}" stroke-width="1" opacity="0.2"/>`;
    }
    grid += `<text x="${n2(cx + R)}" y="${n2(cy - 4)}" text-anchor="end" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${label(rMax)}</text>`;
  }

  // Subpaths break wherever a sample is non-finite (a pole of r(θ)).
  const runs: PolarPoint[][] = [];
  let run: PolarPoint[] = [];
  for (const p of points) {
    if (Number.isFinite(p.r) && Number.isFinite(p.theta)) run.push(p);
    else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);

  const d = runs
    .map((seg) =>
      seg
        .map((p, i) => {
          const [x, y] = px(p.theta, p.r);
          return `${i === 0 ? "M" : "L"}${n2(x)},${n2(y)}`;
        })
        .join(" "),
    )
    .join(" ");

  let curve = "";
  if (d) {
    const closing = opts.closed || opts.filled ? " Z" : "";
    if (opts.filled) curve += `<path d="${d}${closing}" fill="${ACCENT}" opacity="0.18" stroke="none"/>`;
    curve += `<path d="${d}${closing}" fill="none" stroke="${ACCENT}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (opts.markers) {
    for (const p of finite) {
      const [x, y] = px(p.theta, p.r);
      curve += `<circle cx="${n2(x)}" cy="${n2(y)}" r="2.2" fill="${ACCENT}"/>`;
    }
  }

  return frame(W, H, grid + curve + titleSvg(W, opts.title));
}
