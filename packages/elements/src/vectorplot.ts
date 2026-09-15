// Pure vector-field geometry: a field function in, arrows or streamlines out as
// an SVG string. Mirrors contour.ts's shape -- the element layer does the
// compute-engine work and hands this module a plain `(x, y) => [u, v]`. Both
// modes are pure and deterministic (fixed sample grid, fixed-step RK4, no
// randomness), so SSR and the browser render byte-identical output.

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
// Cool end of the magnitude ramp, matching contour.ts's filled bands.
const RAMP_LO = "var(--notatio-series-2, #2f7ed8)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function label(x: number): string {
  if (!Number.isFinite(x)) return "";
  if (x === 0) return "0";
  const abs = Math.abs(x);
  return abs >= 1000 || abs < 0.01 ? x.toExponential(1) : String(Math.round(x * 100) / 100);
}

/** FNV-1a, for clip-path ids that are a pure function of the render inputs. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** A planar vector field, in data coordinates. Returning a non-finite
 * component marks the point as a singularity (arrow/streamline stops there). */
export type Field2d = (x: number, y: number) => readonly [number, number];

export interface VectorSample {
  x: number;
  y: number;
  u: number;
  v: number;
  /** Euclidean magnitude, precomputed. */
  mag: number;
}

/**
 * Sample `field` at the centres of an `nx` × `ny` grid of cells covering
 * `[x0, x1] × [y0, y1]`. Cell centres (rather than the corners `Plot3D` uses)
 * keep every arrow fully inside the frame. Non-finite samples are dropped.
 */
export function sampleField(
  field: Field2d,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  nx: number,
  ny: number,
): VectorSample[] {
  const out: VectorSample[] = [];
  if (nx < 1 || ny < 1) return out;
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + dx * (i + 0.5);
      const y = y0 + dy * (j + 0.5);
      let u = Number.NaN;
      let v = Number.NaN;
      try {
        [u, v] = field(x, y);
      } catch {
        continue;
      }
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      out.push({ x, y, u, v, mag: Math.hypot(u, v) });
    }
  }
  return out;
}

/**
 * The SVG path of an arrow from `(x1, y1)` to `(x2, y2)` in screen space: the
 * shaft plus a two-stroke head. `head` is the head's length in px; the barbs
 * open at ~25°. A degenerate (zero-length) arrow yields an empty path.
 */
export function arrowPath(x1: number, y1: number, x2: number, y2: number, head = 4): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return "";
  const h = Math.min(head, len);
  const ux = dx / len;
  const uy = dy / len;
  // Barb direction: rotate the reversed unit vector by ±25°.
  const c = Math.cos(0.4363);
  const s = Math.sin(0.4363);
  const bx = -ux * h;
  const by = -uy * h;
  const lx = x2 + (bx * c - by * s);
  const ly = y2 + (bx * s + by * c);
  const rx = x2 + (bx * c + by * s);
  const ry = y2 + (-bx * s + by * c);
  return (
    `M${n2(x1)},${n2(y1)} L${n2(x2)},${n2(y2)}` +
    ` M${n2(lx)},${n2(ly)} L${n2(x2)},${n2(y2)} L${n2(rx)},${n2(ry)}`
  );
}

export interface StreamlineOptions {
  /** Arc-length step, in data units. */
  step: number;
  /** Maximum steps taken in each direction (default 60). */
  maxSteps?: number;
  /** Integrate backwards from the seed as well (default true). */
  bidirectional?: boolean;
}

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** One classical RK4 step of the *normalised* field, so `h` is arc length and
 * a fast region doesn't outrun a slow one. Returns undefined at a singularity
 * or a stagnation point (|F| = 0), which ends the streamline. */
function rk4(field: Field2d, x: number, y: number, h: number): [number, number] | undefined {
  const dir = (px: number, py: number): [number, number] | undefined => {
    let u: number;
    let v: number;
    try {
      [u, v] = field(px, py);
    } catch {
      return undefined;
    }
    const m = Math.hypot(u, v);
    if (!Number.isFinite(m) || m === 0) return undefined;
    return [u / m, v / m];
  };
  const k1 = dir(x, y);
  if (!k1) return undefined;
  const k2 = dir(x + (h / 2) * k1[0], y + (h / 2) * k1[1]);
  if (!k2) return undefined;
  const k3 = dir(x + (h / 2) * k2[0], y + (h / 2) * k2[1]);
  if (!k3) return undefined;
  const k4 = dir(x + h * k3[0], y + h * k3[1]);
  if (!k4) return undefined;
  const nx = x + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  const ny = y + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  return Number.isFinite(nx) && Number.isFinite(ny) ? [nx, ny] : undefined;
}

/**
 * Trace the streamline of `field` through `(sx, sy)` by fixed-step RK4 on the
 * normalised field, clipped to `bounds`. Deterministic: no adaptive stepping,
 * no randomness -- the same seed always yields the same polyline. Points come
 * back in flow order (upstream tail first when bidirectional).
 */
export function streamline(
  field: Field2d,
  sx: number,
  sy: number,
  bounds: Bounds,
  opts: StreamlineOptions,
): { x: number; y: number }[] {
  const maxSteps = Math.max(1, Math.round(opts.maxSteps ?? 60));
  const inside = (x: number, y: number): boolean =>
    x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
  if (!inside(sx, sy)) return [];

  const march = (h: number): { x: number; y: number }[] => {
    const pts: { x: number; y: number }[] = [];
    let x = sx;
    let y = sy;
    for (let k = 0; k < maxSteps; k++) {
      const next = rk4(field, x, y, h);
      if (!next) break;
      [x, y] = next;
      if (!inside(x, y)) break;
      pts.push({ x, y });
    }
    return pts;
  };

  const fwd = march(opts.step);
  const back = opts.bidirectional === false ? [] : march(-opts.step);
  return [...back.reverse(), { x: sx, y: sy }, ...fwd];
}

export interface VectorPlotOptions {
  width?: number;
  height?: number;
  /** Arrow grid (`vector`) or streamline seed grid (`stream`) resolution. */
  n?: number;
  /** `vector` (default) draws arrows; `stream` integrates streamlines. */
  type?: "vector" | "stream";
  /** Draw the axis frame with range labels (default true). */
  axes?: boolean;
  /** Streamline arc-length steps per direction (default 60). */
  steps?: number;
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

const frame = (w: number, h: number, kind: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${kind} plot">${body}</svg>`;

function titleSvg(w: number, title: string | undefined): string {
  return title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";
}

/** Magnitude ramp: cool at |F| = 0, accent at the field's maximum. */
const ramp = (t: number): string =>
  `color-mix(in srgb, ${ACCENT} ${n2(Math.max(0, Math.min(1, t)) * 100)}%, ${RAMP_LO})`;

/**
 * Render `field` over `[x0, x1] × [y0, y1]` as a grid of arrows (Wolfram's
 * `VectorPlot`) or as streamlines seeded on that grid (`StreamPlot`). Arrow
 * length and colour both scale with |F|; streamlines are coloured by their
 * mean |F|. A pure function of its inputs -- same field, same SVG.
 */
export function vectorPlotSvg(
  field: Field2d,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  opts: VectorPlotOptions = {},
): string {
  const W = opts.width ?? 340;
  const H = opts.height ?? 200;
  const kind = opts.type === "stream" ? "stream" : "vector";
  const mL = 38;
  const mR = 10;
  const mT = opts.title ? 26 : 12;
  const mB = 22;
  const plotW = W - mL - mR;
  const plotH = H - mT - mB;

  if (!(x1 > x0) || !(y1 > y0) || plotW <= 0 || plotH <= 0)
    return frame(W, H, kind, titleSvg(W, opts.title));

  const sx = (x: number): number => mL + ((x - x0) / (x1 - x0)) * plotW;
  const sy = (y: number): number => mT + ((y1 - y) / (y1 - y0)) * plotH;

  const n = Math.max(2, Math.min(40, Math.round(opts.n ?? (kind === "stream" ? 9 : 14))));
  const samples = sampleField(field, x0, x1, y0, y1, n, n);
  const maxMag = samples.reduce((m, s) => Math.max(m, s.mag), 0);

  let body = "";
  if (kind === "vector") {
    // Cap an arrow at ~90% of a cell so neighbours never overlap; scale the
    // rest linearly in |F| (Wolfram's default vector scaling).
    const cellW = plotW / n;
    const cellH = plotH / n;
    const maxLen = 0.9 * Math.min(cellW, cellH);
    for (const s of samples) {
      const t = maxMag > 0 ? s.mag / maxMag : 0;
      const len = maxLen * t;
      if (!(len > 0.4)) continue;
      const dirX = s.u / s.mag;
      const dirY = s.v / s.mag;
      const cx = sx(s.x);
      const cy = sy(s.y);
      // Centre the arrow on its sample point; y is flipped for screen space.
      const hx = (dirX * len) / 2;
      const hy = (-dirY * len) / 2;
      const d = arrowPath(cx - hx, cy - hy, cx + hx, cy + hy, Math.min(4, len * 0.45));
      if (!d) continue;
      body += `<path d="${d}" fill="none" stroke="${ramp(t)}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  } else {
    const step = Math.min(x1 - x0, y1 - y0) / (n * 2);
    const bounds = { x0, x1, y0, y1 };
    for (const s of samples) {
      const pts = streamline(field, s.x, s.y, bounds, {
        step,
        maxSteps: Math.max(2, Math.round(opts.steps ?? 60)),
      });
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${n2(sx(p.x))},${n2(sy(p.y))}`).join(" ");
      const t = maxMag > 0 ? s.mag / maxMag : 0;
      body += `<path d="${d}" fill="none" stroke="${ramp(t)}" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`;
      // A single mid-line head shows the flow direction without clutter.
      const mid = Math.floor(pts.length / 2);
      if (mid >= 1) {
        const a = pts[mid - 1];
        const b = pts[mid];
        const ah = arrowPath(sx(a.x), sy(a.y), sx(b.x), sy(b.y), 4);
        if (ah)
          body += `<path d="${ah}" fill="none" stroke="${ramp(t)}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
  }

  let chrome = "";
  if (opts.axes !== false) {
    chrome += `<rect x="${n2(mL)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}" fill="none" stroke="${AXIS}" stroke-width="1" opacity="0.5"/>`;
    const text = (x: number, y: number, anchor: string, s: string): string =>
      `<text x="${n2(x)}" y="${n2(y)}" text-anchor="${anchor}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    chrome +=
      text(mL, H - 6, "start", label(x0)) +
      text(W - mR, H - 6, "end", label(x1)) +
      text(mL - 4, mT + 6, "end", label(y1)) +
      text(mL - 4, H - mB, "end", label(y0));
    if (opts.xLabel)
      chrome += `<text x="${n2(W - mR)}" y="${n2(mT + 10)}" text-anchor="end" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.xLabel)}</text>`;
    if (opts.yLabel)
      chrome += `<text x="${n2(mL + 4)}" y="${n2(mT + 10)}" text-anchor="start" font-size="10" font-style="italic" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(opts.yLabel)}</text>`;
  }

  const clipId = `nvector-${fnv1a(`${kind}:${n}:${x0},${x1},${y0},${y1}:${W}x${H}:${n2(maxMag)}:${samples.length}`)}`;
  const clip = `<clipPath id="${clipId}"><rect x="${n2(mL)}" y="${n2(mT)}" width="${n2(plotW)}" height="${n2(plotH)}"/></clipPath>`;
  return frame(
    W,
    H,
    kind,
    `${clip}<g clip-path="url(#${clipId})">${body}</g>${chrome}${titleSvg(W, opts.title)}`,
  );
}
