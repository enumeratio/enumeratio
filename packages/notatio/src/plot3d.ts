// Pure 3-D surface geometry: a grid of z-values in, a themeable SVG surface out.
// An oblique projection with painter's-algorithm ordering and height shading --
// no WebGL, no dependency. The element layer (notatio-plot-3d) samples f(x, y);
// this stays testable. `grid[j][i]` is z at the (i-th x, j-th y) sample.
// Axes (a boxed frame with range labels) follow Wolfram's Axes; each axis can
// carry a scaling function (ScalingFunctions).

import { scale } from "./scales.ts";

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";
const EDGE = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
// Base colours for overlaid surfaces; the first is the accent (single-surface).
const SURF = [
  ACCENT,
  "var(--notatio-series-2, #2f7ed8)",
  "var(--notatio-series-3, #2ca02c)",
  "var(--notatio-series-4, #d62728)",
];

type Grid = readonly (readonly number[])[];

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const label = (v: number): string => {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  return abs >= 1000 || abs < 0.01 ? v.toExponential(1) : String(Math.round(v * 100) / 100);
};

export interface Surface3dOptions {
  width?: number;
  height?: number;
  /** Sample coordinates along each axis (length nx / ny); default 0…1. */
  xs?: readonly number[];
  ys?: readonly number[];
  /** Scaling function names (Wolfram ScalingFunctions). */
  xScale?: string;
  yScale?: string;
  zScale?: string;
  /** Draw the boxed axes with range labels (default true). */
  axes?: boolean;
  /** View direction: rotation about the z-axis, in degrees (default 45). */
  azimuth?: number;
  /** View tilt above the floor, in degrees, -90…90 (default 15). */
  elevation?: number;
  /** Magnification of the figure about its centre (default 1). */
  zoom?: number;
  /** A title centred at the top of the figure (PlotLabel). */
  title?: string;
  /** Draw a height color-scale legend (z range) at the right (default false). */
  colorLegend?: boolean;
  /** Pointer position in viewBox units; marks the nearest sample and reads out
   * its (x, y, z). */
  hover?: readonly [number, number];
  /** A fill per face, given its cell and normalised mean height; default the
   * height-shaded accent. */
  fill?: (face: { i: number; j: number; t: number; surface: number }) => string;
}

/** A projected point plus its distance toward the viewer (larger = nearer). */
type Projected = [number, number, number];

// A view rotated by `azimuth` about z, then tilted by `elevation` toward the
// viewer, and dropped orthographically onto the page. Constants are tuned so
// the unit cube sits comfortably in a 360×260 frame at the defaults.
function projector(
  W: number,
  H: number,
  azimuth: number,
  elevation: number,
  zoom: number,
): (px: number, py: number, pz: number) => Projected {
  const a = (azimuth * Math.PI) / 180;
  const e = (Math.max(-90, Math.min(90, elevation)) * Math.PI) / 180;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cosE = Math.cos(e);
  const sinE = Math.sin(e);
  const S = 181 * zoom;
  const L = 95 * zoom;
  const cx = W / 2;
  const cy = H / 2 + 0.03 * H;
  return (px, py, pz) => {
    const x = px - 0.5;
    const y = py - 0.5;
    const z = pz - 0.5;
    const u = x * cosA - y * sinA; // screen-right
    const v = x * sinA + y * cosA; // toward the viewer, on the floor
    return [cx + u * S, cy + v * S * sinE - z * L * cosE, v * cosE + z * sinE];
  };
}

/**
 * Render a height grid as an oblique-projected surface. Quads are filled with a
 * height-shaded accent and drawn back-to-front so nearer cells overlay farther
 * ones. Cells touching a non-finite sample are skipped (a hole in the surface).
 */
export function surfaceSvg(grid: Grid, opts: Surface3dOptions = {}): string {
  return surfacesSvg([grid], opts);
}

/** As `surfaceSvg`, but paints several grids on a shared z-scale, each in its
 * own colour, with cells depth-sorted across all surfaces so they interleave
 * correctly. All grids must share the sample coordinates (`xs` / `ys`). */
export function surfacesSvg(grids: readonly Grid[], opts: Surface3dOptions = {}): string {
  const W = opts.width ?? 360;
  const H = opts.height ?? 260;
  const projectN = projector(W, H, opts.azimuth ?? 45, opts.elevation ?? 15, opts.zoom ?? 1);
  const frame = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="surface plot">${body}</svg>`;

  const grid = grids[0] ?? [];
  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 2 || ny < 2) return frame("");

  const X = scale(opts.xScale);
  const Y = scale(opts.yScale);
  const Z = scale(opts.zScale);

  // Normalized axis positions from the (optionally scaled) sample coordinates.
  const axisPos = (
    coords: readonly number[] | undefined,
    count: number,
    s: typeof X,
  ): ((k: number) => number) => {
    const t = Array.from({ length: count }, (_, k) => s.fwd(coords ? coords[k] : k / (count - 1)));
    const finite = t.filter(Number.isFinite);
    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    return (k) => (t[k] - lo) / (hi - lo || 1);
  };
  const pxOf = axisPos(opts.xs, nx, X);
  const pyOf = axisPos(opts.ys, ny, Y);

  // Shared z-range across every surface, so overlays are directly comparable.
  const finiteZ = grids
    .flatMap((g) => g.flat())
    .map((z) => Z.fwd(z))
    .filter(Number.isFinite);
  if (finiteZ.length === 0) return frame("");
  let zmin = Math.min(...finiteZ);
  let zmax = Math.max(...finiteZ);
  if (zmin === zmax) {
    zmin -= 1;
    zmax += 1;
  }
  const pzOf = (z: number): number => (Z.fwd(z) - zmin) / (zmax - zmin);

  // Boxed axes behind the surface: a floor rectangle plus the three edges from
  // the farthest floor corner (so they never cross the surface), labelled with
  // the coordinate ranges.
  let axesSvg = "";
  if (opts.axes !== false) {
    const corners: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const floor = corners
      .map(([x, y]) => projectN(x, y, 0))
      .map(([x, y]) => `${n2(x)},${n2(y)}`)
      .join(" ");
    const edge = (a: Projected, b: Projected): string =>
      `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${EDGE}" stroke-width="1" opacity="0.5"/>`;
    const [bx, by] = corners.reduce((far, c) =>
      projectN(c[0], c[1], 0)[2] < projectN(far[0], far[1], 0)[2] ? c : far,
    );
    const o = projectN(bx, by, 0);
    axesSvg += `<polygon points="${floor}" fill="none" stroke="${EDGE}" stroke-width="1" opacity="0.35"/>`;
    axesSvg +=
      edge(o, projectN(1 - bx, by, 0)) +
      edge(o, projectN(bx, 1 - by, 0)) +
      edge(o, projectN(bx, by, 1));
    const tick = (p: Projected, anchor: string, s: string): string =>
      `<text x="${n2(p[0])}" y="${n2(p[1])}" text-anchor="${anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${s}</text>`;
    // Each floor edge is labelled at its free end with that end's coordinate.
    const xEnd = opts.xs ? opts.xs[bx === 0 ? nx - 1 : 0] : 1 - bx;
    const yEnd = opts.ys ? opts.ys[by === 0 ? ny - 1 : 0] : 1 - by;
    axesSvg +=
      tick(projectN(1 - bx, by, 0), "middle", label(xEnd)) +
      tick(projectN(bx, 1 - by, 0), "middle", label(yEnd)) +
      tick(projectN(bx, by, 1), "end", label(Z.inv(zmax)));
  }

  interface Cell {
    depth: number;
    poly: string;
    t: number;
    surface: number;
    i: number;
    j: number;
  }
  const cells: Cell[] = [];
  grids.forEach((g, si) => {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const zs = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]];
        if (!zs.every((z) => Number.isFinite(Z.fwd(z)))) continue;
        const corners: Projected[] = [
          projectN(pxOf(i), pyOf(j), pzOf(zs[0])),
          projectN(pxOf(i + 1), pyOf(j), pzOf(zs[1])),
          projectN(pxOf(i + 1), pyOf(j + 1), pzOf(zs[2])),
          projectN(pxOf(i), pyOf(j + 1), pzOf(zs[3])),
        ];
        const avgPz = (pzOf(zs[0]) + pzOf(zs[1]) + pzOf(zs[2]) + pzOf(zs[3])) / 4;
        cells.push({
          // Painter's order: sort far-to-near on the cell's mean view depth.
          depth: corners.reduce((sum, c) => sum + c[2], 0) / 4,
          t: avgPz,
          surface: si,
          i,
          j,
          poly: corners.map(([x, y]) => `${n2(x)},${n2(y)}`).join(" "),
        });
      }
    }
  });
  cells.sort((a, b) => a.depth - b.depth);

  const shade = (base: string, t: number): string =>
    `color-mix(in srgb, ${base} ${n2(22 + 60 * t)}%, ${BG})`;
  // Overlaid surfaces get a touch of transparency so a lower one shows through.
  const opacity = grids.length > 1 ? ' fill-opacity="0.85"' : "";
  const fill = opts.fill ?? ((c) => shade(SURF[c.surface % SURF.length], c.t));
  const surface = cells
    .map(
      (c) =>
        `<polygon points="${c.poly}" fill="${fill(c)}"${opacity} stroke="${EDGE}" stroke-width="0.5" stroke-linejoin="round"/>`,
    )
    .join("");

  // A height color-scale key: swatches matching the surface shading, from zmax
  // (top) down to zmin, labelled with the raw z range.
  let legend = "";
  if (opts.colorLegend) {
    const bx = W - 14;
    const bw = 8;
    const top = 16;
    const bh = 76;
    const steps = 8;
    for (let k = 0; k < steps; k++) {
      const t = 1 - k / steps;
      legend += `<rect x="${n2(bx)}" y="${n2(top + (bh * k) / steps)}" width="${bw}" height="${n2(bh / steps + 0.5)}" fill="${shade(ACCENT, t)}" stroke="none"/>`;
    }
    const zlab = (v: number, y: number): string =>
      `<text x="${n2(bx - 2)}" y="${n2(y)}" text-anchor="end" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${label(Z.inv(v))}</text>`;
    legend +=
      `<rect x="${n2(bx)}" y="${n2(top)}" width="${bw}" height="${n2(bh)}" fill="none" stroke="${EDGE}" stroke-width="0.5" opacity="0.5"/>` +
      zlab(zmax, top + 4) +
      zlab(zmin, top + bh);
  }

  let titleSvg = "";
  if (opts.title) {
    const esc = (s: string): string =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    titleSvg = `<text x="${n2(W / 2)}" y="13" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(opts.title)}</text>`;
  }

  // Hover readout: mark the projected grid vertex nearest the pointer and list
  // its data coordinates. Searches every surface's vertices.
  let readout = "";
  if (opts.hover) {
    const [hx, hy] = opts.hover;
    let best: { d: number; px: number; py: number; x: number; y: number; z: number } | undefined;
    grids.forEach((g) => {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const z = g[j][i];
          if (!Number.isFinite(Z.fwd(z))) continue;
          const [px, py] = projectN(pxOf(i), pyOf(j), pzOf(z));
          const d = Math.hypot(px - hx, py - hy);
          if (!best || d < best.d)
            best = {
              d,
              px,
              py,
              x: opts.xs ? opts.xs[i] : i / (nx - 1),
              y: opts.ys ? opts.ys[j] : j / (ny - 1),
              z,
            };
        }
      }
    });
    if (best && best.d < 40) {
      readout +=
        `<circle cx="${n2(best.px)}" cy="${n2(best.py)}" r="3.5" fill="${BG}" stroke="${ACCENT}" stroke-width="2"/>` +
        `<text x="6" y="${n2(H - 6)}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" paint-order="stroke" stroke="${BG}" stroke-width="3" stroke-linejoin="round">(${label(best.x)}, ${label(best.y)}, ${label(best.z)})</text>`;
    }
  }

  return frame(axesSvg + surface + legend + titleSvg + readout);
}

// --- parametric curves in space ------------------------------------------------------

/** A point in space. */
export type Triple = readonly [number, number, number];

export interface Curve3dOptions extends Surface3dOptions {
  /** Stroke width of the curve itself, in viewBox units. */
  stroke?: number;
  /** Close the curve back to its first point (a knot is a loop). */
  closed?: boolean;
  /** Draw the torus the curve lies on, faintly, behind it. */
  torus?: { major: number; minor: number } | undefined;
  /** Mark one point of the curve, given as a fraction of the way along it.
   *
   *  Drawn last and at full strength rather than depth-sorted into the knot: it is a tracer
   *  the eye is meant to follow, and one that vanished behind the strand it is travelling
   *  along would be no use at all. */
  marker?: number | undefined;
}

/** The bounding box of a point set, as the ranges each axis spans. */
function bounds(points: readonly Triple[]): [number, number][] {
  const box: [number, number][] = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      const v = p[i];
      if (!Number.isFinite(v)) continue;
      if (v < box[i][0]) box[i][0] = v;
      if (v > box[i][1]) box[i][1] = v;
    }
  }
  return box;
}

/**
 * Render a parametric curve in space.
 *
 * Segments are drawn back to front, each one laid down twice: a thick stroke in the
 * background colour, then the curve itself. That casing is what makes a crossing read
 * as a crossing — the nearer strand erases the farther one where they meet, which is
 * exactly the over/under information a knot diagram is *for*. Without it a knot is an
 * unreadable tangle of lines.
 *
 * The curve is scaled into the unit cube first, so the same camera serves it as serves
 * a surface, and the two can share a scene.
 */
export function curve3dSvg(points: readonly Triple[], opts: Curve3dOptions = {}): string {
  const W = opts.width ?? 360;
  const H = opts.height ?? 260;
  const stroke = opts.stroke ?? 2.4;
  const usable = points.filter((p) => p.every((v) => Number.isFinite(v)));
  if (usable.length < 2)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"></svg>`;

  const loop = opts.closed === false ? usable : [...usable, usable[0]];
  const box = bounds(usable);
  // One scale for every axis, so the shape is not distorted into its own box.
  const spans = box.map(([lo, hi]) => hi - lo);
  const span = Math.max(...spans, 1e-9);
  const mid = box.map(([lo, hi]) => (lo + hi) / 2);
  const unit = (p: Triple): Triple => [
    (p[0] - mid[0]) / span + 0.5,
    (p[1] - mid[1]) / span + 0.5,
    (p[2] - mid[2]) / span + 0.5,
  ];

  const project = projector(W, H, opts.azimuth ?? 45, opts.elevation ?? 15, opts.zoom ?? 1);
  const screen = loop.map((p) => {
    const u = unit(p);
    return project(u[0], u[1], u[2]);
  });

  // Drawn as depth-sorted *arcs*, not segments. Casing a single segment at a time eats
  // the curve: a segment's casing covers its own neighbours, which are adjacent by
  // construction, so consecutive strokes erase each other and almost nothing survives.
  // An arc is cased once along its whole length, so the only place a casing interrupts
  // anything is where a different arc passes in front — which is a crossing, which is
  // exactly what should interrupt.
  const arcs = Math.max(16, Math.min(64, Math.round(screen.length / 16)));
  const per = Math.ceil((screen.length - 1) / arcs);
  const runs: { pts: Projected[]; depth: number; t: number }[] = [];
  for (let i = 0; i < screen.length - 1; i += per) {
    // One point of overlap, so consecutive arcs meet with no seam.
    const pts = screen.slice(i, Math.min(screen.length, i + per + 1));
    if (pts.length < 2) continue;
    runs.push({
      pts,
      depth: pts.reduce((acc, q) => acc + q[2], 0) / pts.length,
      t: i / (screen.length - 1),
    });
  }
  runs.sort((a, b) => a.depth - b.depth);

  const path = (pts: readonly Projected[]) =>
    pts.map((q, i) => `${i === 0 ? "M" : "L"}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join("");

  const parts: string[] = [];

  // The surface the curve lies on, if it has one, drawn faintly behind everything. A
  // torus knot is *about* being a line on a doughnut, and without the doughnut the
  // picture is just a tangle -- but it must stay in the background, since the knot is
  // what is being shown.
  if (opts.torus) {
    const { major, minor } = opts.torus;
    const rings = 28;
    const around = 40;
    const faces: { d: string; depth: number }[] = [];
    const at = (u: number, v: number): Triple => {
      const r = major + minor * Math.cos(v);
      return [r * Math.cos(u), r * Math.sin(u), -minor * Math.sin(v)];
    };
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < around; j++) {
        const u0 = (2 * Math.PI * i) / rings;
        const u1 = (2 * Math.PI * (i + 1)) / rings;
        const v0 = (2 * Math.PI * j) / around;
        const v1 = (2 * Math.PI * (j + 1)) / around;
        const quad = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)].map((q) => {
          const w = unit(q);
          return project(w[0], w[1], w[2]);
        });
        faces.push({
          d: `${quad.map((q, k) => `${k === 0 ? "M" : "L"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join("")}Z`,
          depth: quad.reduce((acc, q) => acc + q[2], 0) / 4,
        });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      parts.push(
        `<path d="${face.d}" fill="currentColor" fill-opacity="0.045" stroke="currentColor" stroke-opacity="0.05" stroke-width="0.3"/>`,
      );
    }
  }

  for (const run of runs) {
    // The casing stops short of the arc's own ends. Reaching them would rub out the
    // neighbouring arc at a join -- where the curve is continuous and nothing should
    // be occluding anything -- and the knot would come out dashed. Inset, the casing
    // can only interrupt an arc that is genuinely passing in front.
    const inset = run.pts.slice(1, -1);
    if (inset.length >= 2) {
      parts.push(
        `<path d="${path(inset)}" stroke="var(--notatio-bg, #fff)" stroke-width="${(stroke * 3).toFixed(2)}" stroke-linecap="butt" stroke-linejoin="round" fill="none"/>`,
      );
    }
    // Hue runs along the parameter, so you can follow a strand through a crossing.
    const hue = Math.round(run.t * 300);
    parts.push(
      `<path d="${path(run.pts)}" stroke="hsl(${hue} 70% 45%)" stroke-width="${stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    );
  }
  if (opts.marker !== undefined && Number.isFinite(opts.marker)) {
    const phase = ((opts.marker % 1) + 1) % 1;
    // `screen` closes the loop, so the last point repeats the first; index into the OPEN
    // curve or a marker at phase 1 lands a sample early.
    const open = screen.length - 1;
    const here = screen[Math.round(phase * open) % open]!;
    const [x, y] = [here[0].toFixed(2), here[1].toFixed(2)];
    parts.push(
      `<circle cx="${x}" cy="${y}" r="${(stroke * 2.1).toFixed(2)}" fill="var(--notatio-bg, #fff)"/>`,
      `<circle class="notatio-curve-marker" cx="${x}" cy="${y}" r="${(stroke * 1.5).toFixed(2)}" ` +
        `fill="var(--notatio-accent, #b8860b)"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="curve in space">${parts.join("")}</svg>`;
}
