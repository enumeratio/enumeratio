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
  /** Width of the mesh lines between faces (default 0.5); a dense grid wants less. */
  edgeWidth?: number;
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

/** A point on the page, in viewBox units. */
type Pt = readonly [number, number];

/**
 * What a surface draws, before it is drawn: the axes, the depth-sorted faces with their
 * fills, the chrome. `surfacesSvg` serialises it; `drawSurfaceScene` paints it on a
 * canvas, for a grid too dense to live in the DOM as polygons.
 */
export interface SurfaceScene {
  readonly width: number;
  readonly height: number;
  readonly axes?: {
    readonly floor: readonly Pt[];
    readonly edges: readonly (readonly [Pt, Pt])[];
    readonly ticks: readonly { at: Pt; anchor: "middle" | "end"; text: string }[];
  };
  /** The faces in painter's order, far to near: four `x,y` corners each, flat, and a
   * fill per face. Flat rather than an object per face because a dense grid has tens
   * of thousands, and the scene is rebuilt on every turn of the view. */
  readonly faces: { readonly count: number; readonly xy: Float64Array; readonly fill: string[] };
  /** Face opacity when surfaces overlay, else undefined. */
  readonly opacity?: number;
  readonly edgeWidth: number;
  readonly legend?: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly swatches: readonly { y: number; h: number; fill: string }[];
    readonly labels: readonly { y: number; text: string }[];
  };
  readonly title?: string;
  readonly readout?: { at: Pt; text: string };
}

const EMPTY = (W: number, H: number): SurfaceScene => ({
  width: W,
  height: H,
  faces: { count: 0, xy: new Float64Array(0), fill: [] },
  edgeWidth: 0.5,
});

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
  return surfaceSceneSvg(surfaceScene(grids, opts));
}

/** Project and sort: the scene `surfacesSvg` and `drawSurfaceScene` both draw. */
export function surfaceScene(grids: readonly Grid[], opts: Surface3dOptions = {}): SurfaceScene {
  const W = opts.width ?? 360;
  const H = opts.height ?? 260;
  const projectN = projector(W, H, opts.azimuth ?? 45, opts.elevation ?? 15, opts.zoom ?? 1);

  const grid = grids[0] ?? [];
  const ny = grid.length;
  const nx = ny > 0 ? grid[0].length : 0;
  if (nx < 2 || ny < 2) return EMPTY(W, H);

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
  if (finiteZ.length === 0) return EMPTY(W, H);
  let zmin = Math.min(...finiteZ);
  let zmax = Math.max(...finiteZ);
  if (zmin === zmax) {
    zmin -= 1;
    zmax += 1;
  }
  const pzOf = (z: number): number => (Z.fwd(z) - zmin) / (zmax - zmin);
  const xy = (p: Projected): Pt => [p[0], p[1]];

  // Boxed axes behind the surface: a floor rectangle plus the three edges from
  // the farthest floor corner (so they never cross the surface), labelled with
  // the coordinate ranges.
  let axes: SurfaceScene["axes"];
  if (opts.axes !== false) {
    const corners: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const [bx, by] = corners.reduce((far, c) =>
      projectN(c[0], c[1], 0)[2] < projectN(far[0], far[1], 0)[2] ? c : far,
    );
    const o = xy(projectN(bx, by, 0));
    // Each floor edge is labelled at its free end with that end's coordinate.
    const xEnd = opts.xs ? opts.xs[bx === 0 ? nx - 1 : 0] : 1 - bx;
    const yEnd = opts.ys ? opts.ys[by === 0 ? ny - 1 : 0] : 1 - by;
    axes = {
      floor: corners.map(([x, y]) => xy(projectN(x, y, 0))),
      edges: [
        [o, xy(projectN(1 - bx, by, 0))],
        [o, xy(projectN(bx, 1 - by, 0))],
        [o, xy(projectN(bx, by, 1))],
      ],
      ticks: [
        { at: xy(projectN(1 - bx, by, 0)), anchor: "middle", text: label(xEnd) },
        { at: xy(projectN(bx, 1 - by, 0)), anchor: "middle", text: label(yEnd) },
        { at: xy(projectN(bx, by, 1)), anchor: "end", text: label(Z.inv(zmax)) },
      ],
    };
  }

  // Project every vertex once (a face shares each of its corners with three others),
  // then gather the faces and sort them far-to-near on their mean view depth.
  const nv = nx * ny;
  const vx = new Float64Array(nv * grids.length);
  const vy = new Float64Array(nv * grids.length);
  const vd = new Float64Array(nv * grids.length);
  const vz = new Float64Array(nv * grids.length); // normalised height, NaN if not finite
  grids.forEach((g, si) => {
    for (let j = 0; j < ny; j++) {
      const py = pyOf(j);
      for (let i = 0; i < nx; i++) {
        const k = si * nv + j * nx + i;
        const z = Z.fwd(g[j][i]);
        if (!Number.isFinite(z)) {
          vz[k] = Number.NaN;
          continue;
        }
        const pz = (z - zmin) / (zmax - zmin);
        const [x, y, d] = projectN(pxOf(i), py, pz);
        vx[k] = x;
        vy[k] = y;
        vd[k] = d;
        vz[k] = pz;
      }
    }
  });

  // A face is its top-left vertex index; the four corners follow from the grid.
  const faceAt: number[] = [];
  const depth: number[] = [];
  for (let si = 0; si < grids.length; si++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = si * nv + j * nx + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = a + nx;
        const t = vz[a] + vz[b] + vz[c] + vz[d];
        if (Number.isNaN(t)) continue;
        faceAt.push(a);
        depth.push((vd[a] + vd[b] + vd[c] + vd[d]) / 4);
      }
    }
  }
  const order = Uint32Array.from(faceAt.keys()).sort((p, q) => depth[p] - depth[q]);

  const shade = (base: string, t: number): string =>
    `color-mix(in srgb, ${base} ${n2(22 + 60 * t)}%, ${BG})`;
  const fill = opts.fill ?? ((c) => shade(SURF[c.surface % SURF.length], c.t));
  const count = order.length;
  const corners = new Float64Array(count * 8);
  const fills: string[] = [];
  for (let n = 0; n < count; n++) {
    const a = faceAt[order[n]];
    const b = a + 1;
    const c = a + nx + 1;
    const d = a + nx;
    const o = n * 8;
    corners[o] = vx[a];
    corners[o + 1] = vy[a];
    corners[o + 2] = vx[b];
    corners[o + 3] = vy[b];
    corners[o + 4] = vx[c];
    corners[o + 5] = vy[c];
    corners[o + 6] = vx[d];
    corners[o + 7] = vy[d];
    const surface = Math.floor(a / nv);
    const local = a - surface * nv;
    fills[n] = fill({
      i: local % nx,
      j: Math.floor(local / nx),
      t: (vz[a] + vz[b] + vz[c] + vz[d]) / 4,
      surface,
    });
  }

  // A height color-scale key: swatches matching the surface shading, from zmax
  // (top) down to zmin, labelled with the raw z range.
  let legend: SurfaceScene["legend"];
  if (opts.colorLegend) {
    const bx = W - 14;
    const bw = 8;
    const top = 16;
    const bh = 76;
    const steps = 8;
    legend = {
      x: bx,
      y: top,
      w: bw,
      h: bh,
      swatches: Array.from({ length: steps }, (_, k) => ({
        y: top + (bh * k) / steps,
        h: bh / steps + 0.5,
        fill: shade(ACCENT, 1 - k / steps),
      })),
      labels: [
        { y: top + 4, text: label(Z.inv(zmax)) },
        { y: top + bh, text: label(Z.inv(zmin)) },
      ],
    };
  }

  // Hover readout: mark the projected grid vertex nearest the pointer and list
  // its data coordinates. Searches every surface's vertices.
  let readout: SurfaceScene["readout"];
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
      readout = {
        at: [best.px, best.py],
        text: `(${label(best.x)}, ${label(best.y)}, ${label(best.z)})`,
      };
    }
  }

  return {
    width: W,
    height: H,
    axes,
    faces: { count, xy: corners, fill: fills },
    // Overlaid surfaces get a touch of transparency so a lower one shows through.
    opacity: grids.length > 1 ? 0.85 : undefined,
    edgeWidth: opts.edgeWidth ?? 0.5,
    legend,
    title: opts.title || undefined,
    readout,
  };
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The scene as SVG, themed through CSS variables. */
export function surfaceSceneSvg(scene: SurfaceScene): string {
  const { width: W, height: H } = scene;
  const frame = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="surface plot">${body}</svg>`;
  const pts = (points: readonly Pt[]): string =>
    points.map(([x, y]) => `${n2(x)},${n2(y)}`).join(" ");

  let axesSvg = "";
  if (scene.axes) {
    const { floor, edges, ticks } = scene.axes;
    axesSvg += `<polygon points="${pts(floor)}" fill="none" stroke="${EDGE}" stroke-width="1" opacity="0.35"/>`;
    for (const [a, b] of edges) {
      axesSvg += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${EDGE}" stroke-width="1" opacity="0.5"/>`;
    }
    for (const t of ticks) {
      axesSvg += `<text x="${n2(t.at[0])}" y="${n2(t.at[1])}" text-anchor="${t.anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${t.text}</text>`;
    }
  }

  const opacity = scene.opacity === undefined ? "" : ` fill-opacity="${n2(scene.opacity)}"`;
  const edgeWidth = n2(scene.edgeWidth);
  const { count, xy, fill } = scene.faces;
  const faces: string[] = [];
  for (let n = 0; n < count; n++) {
    const o = n * 8;
    const points = `${n2(xy[o])},${n2(xy[o + 1])} ${n2(xy[o + 2])},${n2(xy[o + 3])} ${n2(xy[o + 4])},${n2(xy[o + 5])} ${n2(xy[o + 6])},${n2(xy[o + 7])}`;
    faces[n] =
      `<polygon points="${points}" fill="${fill[n]}"${opacity} stroke="${EDGE}" stroke-width="${edgeWidth}" stroke-linejoin="round"/>`;
  }
  const surface = faces.join("");

  let legend = "";
  if (scene.legend) {
    const { x, y, w, h, swatches, labels } = scene.legend;
    for (const sw of swatches) {
      legend += `<rect x="${n2(x)}" y="${n2(sw.y)}" width="${w}" height="${n2(sw.h)}" fill="${sw.fill}" stroke="none"/>`;
    }
    legend += `<rect x="${n2(x)}" y="${n2(y)}" width="${w}" height="${n2(h)}" fill="none" stroke="${EDGE}" stroke-width="0.5" opacity="0.5"/>`;
    for (const l of labels) {
      legend += `<text x="${n2(x - 2)}" y="${n2(l.y)}" text-anchor="end" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${l.text}</text>`;
    }
  }

  const titleSvg = scene.title
    ? `<text x="${n2(W / 2)}" y="13" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(scene.title)}</text>`
    : "";

  let readout = "";
  if (scene.readout) {
    const { at, text } = scene.readout;
    readout =
      `<circle cx="${n2(at[0])}" cy="${n2(at[1])}" r="3.5" fill="${BG}" stroke="${ACCENT}" stroke-width="2"/>` +
      `<text x="6" y="${n2(H - 6)}" font-size="10" font-family="ui-monospace, monospace" fill="${FG}" paint-order="stroke" stroke="${BG}" stroke-width="3" stroke-linejoin="round">${text}</text>`;
  }

  return frame(axesSvg + surface + legend + titleSvg + readout);
}

/** Concrete colours for a canvas, which cannot read CSS variables. */
export interface SurfacePaint {
  readonly fg: string;
  readonly bg: string;
  readonly edge: string;
  readonly accent: string;
}

/**
 * Paint the scene on a 2-D canvas, in the scene's own units -- the caller scales the
 * context for the canvas size and the device pixel ratio. Twenty-five thousand faces as
 * DOM polygons is a second of parsing and layout on every turn of the view; as canvas
 * fills it is a few milliseconds. Face fills must be concrete colours here: the default
 * accent shading is a `color-mix` over CSS variables and will not paint.
 */
export function drawSurfaceScene(
  ctx: CanvasRenderingContext2D,
  scene: SurfaceScene,
  paint: SurfacePaint,
): void {
  const { width: W, height: H } = scene;
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = "round";

  const poly = (points: readonly Pt[]): void => {
    ctx.beginPath();
    points.forEach(([x, y], k) => (k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  };

  if (scene.axes) {
    const { floor, edges, ticks } = scene.axes;
    ctx.strokeStyle = paint.edge;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    poly(floor);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = paint.fg;
    ctx.font = "9px ui-monospace, monospace";
    for (const t of ticks) {
      ctx.textAlign = t.anchor === "end" ? "right" : "center";
      ctx.fillText(t.text, t.at[0], t.at[1]);
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = paint.edge;
  ctx.lineWidth = scene.edgeWidth;
  const stroke = scene.edgeWidth > 0;
  if (scene.opacity !== undefined) ctx.globalAlpha = scene.opacity;
  const { count, xy, fill } = scene.faces;
  for (let n = 0; n < count; n++) {
    const o = n * 8;
    ctx.beginPath();
    ctx.moveTo(xy[o], xy[o + 1]);
    ctx.lineTo(xy[o + 2], xy[o + 3]);
    ctx.lineTo(xy[o + 4], xy[o + 5]);
    ctx.lineTo(xy[o + 6], xy[o + 7]);
    ctx.closePath();
    ctx.fillStyle = fill[n];
    ctx.fill();
    if (stroke) ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (scene.legend) {
    const { x, y, w, h, swatches, labels } = scene.legend;
    for (const sw of swatches) {
      ctx.fillStyle = sw.fill;
      ctx.fillRect(x, sw.y, w, sw.h);
    }
    ctx.strokeStyle = paint.edge;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = paint.fg;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "right";
    for (const l of labels) ctx.fillText(l.text, x - 2, l.y);
    ctx.globalAlpha = 1;
  }

  if (scene.title) {
    ctx.fillStyle = paint.fg;
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(scene.title, W / 2, 13);
  }

  if (scene.readout) {
    const { at, text } = scene.readout;
    ctx.beginPath();
    ctx.arc(at[0], at[1], 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = paint.bg;
    ctx.fill();
    ctx.strokeStyle = paint.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.lineWidth = 3;
    ctx.strokeStyle = paint.bg;
    ctx.strokeText(text, 6, H - 6);
    ctx.fillStyle = paint.fg;
    ctx.fillText(text, 6, H - 6);
  }
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
  // picture is just a dynamic module -- but it must stay in the background, since the knot is
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
