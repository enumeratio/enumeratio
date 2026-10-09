// A vector field as a `GraphicsBox` (the wiki's Speculative-Box-Primitives, §6 slice 4): a field
// function in, arrows (`ArrowBox`) or streamlines (`LineBox` with an `ArrowBox` head) in data
// coordinates out, with the frame as options. Mirrors contour.ts's shape -- the element layer does
// the compute-engine work and hands this module a plain `(x, y) => [u, v]`. Both modes are pure and
// deterministic (fixed sample grid, fixed-step RK4, no randomness), so SSR and the browser draw the
// same picture. `renderPlot` draws the box.

import { arrow, type Box, graphics, line, type OptionValue, row, style, tag } from "@enumeratio/boxes";
import { plotArea } from "./plot-box.ts";
import { type ColorOptions, plotPalette, rampColor } from "./plot-color.ts";

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
  return [...back.toReversed(), { x: sx, y: sy }, ...fwd];
}

export interface VectorPlotOptions extends ColorOptions {
  width?: number;
  height?: number;
  /** Arrow grid (`vector`) or streamline seed grid (`stream`) resolution. */
  n?: number;
  /** `vector` (default) draws arrows; `stream` integrates streamlines. */
  type?: "vector" | "stream";
  /** Draw the axes with range labels (default true). */
  axes?: boolean;
  /** Streamline arc-length steps per direction (default 60). */
  steps?: number;
  xLabel?: string;
  yLabel?: string;
  title?: string;
}

const WIDTH = 340;
const HEIGHT = 200;
const ARROW_WIDTH = 1.2;
const STREAM_WIDTH = 1.1;
const STREAM_OPACITY = 0.8;
/** The shortest arrow drawn, in px: a shorter one is a smear, not a direction. */
const MIN_ARROW = 0.4;
/** An arrow's head is at most this many px (stored as a fraction of the plot width), and at most this fraction of its length. */
const HEAD_PX = 4;
const HEAD_FRACTION = 0.45;

const stroke = (color: string, width: number, opacity = 1): OptionValue => [[color, width, opacity, []]];

/**
 * Render `field` over `[x0, x1] × [y0, y1]` as a grid of arrows (Wolfram's `VectorPlot`) or as
 * streamlines seeded on that grid (`StreamPlot`), as a `GraphicsBox`. Arrow length and color both
 * scale with |F|; a streamline is colored by its seed's |F| and carries one mid-line head. A pure
 * function of its inputs -- same field, same box.
 */
export function vectorPlotBox(
  field: Field2d,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  opts: VectorPlotOptions = {},
): Box {
  const [W, H] = [opts.width ?? WIDTH, opts.height ?? HEIGHT];
  const kind = opts.type === "stream" ? "stream" : "vector";
  const { plotW, plotH } = plotArea(W, H, Boolean(opts.title));
  const options: Record<string, OptionValue> = {
    ImageSize: [W, H],
    Axes: opts.axes !== false,
    ScalingFunctions: ["linear", "linear"],
    ViewKind: "fixed",
    ...((opts.xLabel || opts.yLabel) && { AxesLabel: [opts.xLabel ?? null, opts.yLabel ?? null] }),
    ...(opts.title && { PlotLabel: opts.title }),
  };
  if (!(x1 > x0) || !(y1 > y0) || plotW <= 0 || plotH <= 0) return graphics(row([]), options);
  options["PlotRange"] = [
    [x0, x1],
    [y0, y1],
  ];
  // Data units per px, each way, so a length chosen in px lands the same on screen.
  const dx = (x1 - x0) / plotW;
  const dy = (y1 - y0) / plotH;

  const n = Math.max(2, Math.min(40, Math.round(opts.n ?? (kind === "stream" ? 9 : 14))));
  // Magnitude on the gradient: its first stop at |F| = 0, its last at the field's maximum.
  const palette = plotPalette(opts);
  const samples = sampleField(field, x0, x1, y0, y1, n, n);
  const maxMag = samples.reduce((m, s) => Math.max(m, s.mag), 0);

  const marks: Box[] = [];
  if (kind === "vector") {
    // Cap an arrow at ~90% of a cell so neighbours never overlap; scale the
    // rest linearly in |F| (Wolfram's default vector scaling).
    const maxLen = 0.9 * Math.min(plotW / n, plotH / n);
    for (const s of samples) {
      const t = maxMag > 0 ? s.mag / maxMag : 0;
      const len = maxLen * t;
      if (!(len > MIN_ARROW)) continue;
      // Centre the arrow on its sample point.
      const hx = ((s.u / s.mag) * len * dx) / 2;
      const hy = ((s.v / s.mag) * len * dy) / 2;
      const color = rampColor(palette, t);
      marks.push(
        style(
          tag(
            arrow({
              Points: [
                [s.x - hx, s.y - hy],
                [s.x + hx, s.y + hy],
              ],
              Arrowheads: Math.min(HEAD_PX, len * HEAD_FRACTION) / plotW,
            }),
            "Series",
          ),
          { EdgeForm: stroke(color, ARROW_WIDTH), FaceForm: color },
        ),
      );
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
      const t = maxMag > 0 ? s.mag / maxMag : 0;
      const color = rampColor(palette, t);
      const look = { EdgeForm: stroke(color, STREAM_WIDTH, STREAM_OPACITY), FaceForm: color };
      marks.push(style(tag(line({ Points: pts.map((p) => [p.x, p.y]) }), "Series"), look));
      // A single mid-line head shows the flow direction without clutter.
      const mid = Math.floor(pts.length / 2);
      if (mid >= 1) {
        const a = pts[mid - 1]!;
        const b = pts[mid]!;
        marks.push(
          style(
            tag(
              arrow({
                Points: [
                  [a.x, a.y],
                  [b.x, b.y],
                ],
                Arrowheads: HEAD_PX / plotW,
              }),
              "Series",
            ),
            { EdgeForm: stroke(color, STREAM_WIDTH), FaceForm: color },
          ),
        );
      }
    }
  }
  return graphics(row(marks), options);
}
