// A pure orthographic 3-D projection, shared by the list-plot and bar-chart
// renderers. World coordinates are the unit cube [0,1]³ (each renderer
// normalises its own data into it); the camera is parameterised by an azimuth
// (rotation about z) and an elevation (tilt above the floor), and the figure is
// scaled to fit its frame. No perspective: depth is only the distance along the
// view direction, used for painter's-algorithm ordering and depth cueing.
//
// Everything here is a pure function of its arguments -- no randomness, no DOM
// measurement -- so a figure renders byte-identically under SSR and in the
// browser.

const EDGE = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Axis-range label formatting, matching the 2-D plotters. */
export function axisLabel(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  return abs >= 1000 || abs < 0.01 ? v.toExponential(1) : String(Math.round(v * 100) / 100);
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** A projected point: viewBox coordinates plus its view depth (larger = nearer). */
export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

export interface CameraOptions {
  width?: number;
  height?: number;
  /** Rotation about the z-axis, in degrees (default 30). */
  azimuth?: number;
  /** Tilt above the floor, in degrees, clamped to -89…89 (default 25). */
  elevation?: number;
  /** Magnification about the figure's centre (default 1). */
  zoom?: number;
  /** Frame padding in viewBox units, before zoom (default 24). */
  padding?: number;
}

export interface Camera {
  readonly width: number;
  readonly height: number;
  /** Frame units per unit-cube unit, `zoom` included — what a figure needs to work out how far
   *  to zoom for its own content to fill the frame rather than the cube that bounds it. */
  readonly scale: number;
  /** The frame padding this camera was built with, in viewBox units. */
  readonly padding: number;
  /** Project a unit-cube point to the frame. */
  project: (p: Point3) => ScreenPoint;
  /** `project` with loose arguments, for hot loops. */
  at: (x: number, y: number, z: number) => ScreenPoint;
}

/**
 * Build a camera that fits the whole unit cube inside `width` × `height`.
 *
 * The view rotates the cube by `azimuth` about z, tilts it by `elevation`, and
 * drops it flat onto the page. The scale is derived from the projected extent
 * of the cube's eight corners rather than a magic constant, so the figure fills
 * its frame at any view angle and both axes keep the same scale (no shear).
 */
export function camera(opts: CameraOptions = {}): Camera {
  const W = opts.width ?? 360;
  const H = opts.height ?? 260;
  const pad = opts.padding ?? 24;
  const zoom = opts.zoom && opts.zoom > 0 ? opts.zoom : 1;
  const a = ((opts.azimuth ?? 30) * Math.PI) / 180;
  const e = (Math.max(-89, Math.min(89, opts.elevation ?? 25)) * Math.PI) / 180;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cosE = Math.cos(e);
  const sinE = Math.sin(e);

  // Unrotated view coordinates of a cube-centred point: `u` runs along the
  // screen's x-axis, `w` along its y-axis (down), `depth` toward the viewer.
  const raw = (x: number, y: number, z: number): [number, number, number] => {
    const cx = x - 0.5;
    const cy = y - 0.5;
    const cz = z - 0.5;
    const u = cx * cosA - cy * sinA;
    const v = cx * sinA + cy * cosA;
    return [u, v * sinE - cz * cosE, v * cosE + cz * sinE];
  };

  // Fit: the projected bounding box of the cube's corners, scaled uniformly.
  let uLo = Number.POSITIVE_INFINITY;
  let uHi = Number.NEGATIVE_INFINITY;
  let wLo = Number.POSITIVE_INFINITY;
  let wHi = Number.NEGATIVE_INFINITY;
  for (const cx of [0, 1])
    for (const cy of [0, 1])
      for (const cz of [0, 1]) {
        const [u, w] = raw(cx, cy, cz);
        uLo = Math.min(uLo, u);
        uHi = Math.max(uHi, u);
        wLo = Math.min(wLo, w);
        wHi = Math.max(wHi, w);
      }
  const spanU = uHi - uLo || 1;
  const spanW = wHi - wLo || 1;
  const scale = Math.min(Math.max(W - 2 * pad, 1) / spanU, Math.max(H - 2 * pad, 1) / spanW) * zoom;
  const midU = (uLo + uHi) / 2;
  const midW = (wLo + wHi) / 2;

  const at = (x: number, y: number, z: number): ScreenPoint => {
    const [u, w, depth] = raw(x, y, z);
    return { x: W / 2 + (u - midU) * scale, y: H / 2 + (w - midW) * scale, depth };
  };

  return { width: W, height: H, scale, padding: pad, project: (p) => at(p.x, p.y, p.z), at };
}

/**
 * The direction the viewer looks FROM, in the cube's own coordinates — the camera's `depth`
 * axis written as a vector.
 *
 * A figure that wants to turn something towards the viewer needs this, because the camera is
 * the only thing that knows where the viewer is; the geometry it turns does not.
 */
export function viewDirection(opts: CameraOptions = {}): [number, number, number] {
  const a = ((opts.azimuth ?? 30) * Math.PI) / 180;
  const e = (Math.max(-89, Math.min(89, opts.elevation ?? 25)) * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

/** `[lo, hi]` → a map onto `[0, 1]`. A degenerate range maps everything to ½,
 * so a flat field sits in the middle of the cube instead of at a face. */
export function unitScale(lo: number, hi: number): (v: number) => number {
  if (!(hi > lo)) return () => 0.5;
  return (v) => (v - lo) / (hi - lo);
}

export interface AxisBoxOptions {
  /** End-of-axis labels, drawn at each floor edge's free end. */
  xEnd?: number;
  yEnd?: number;
  zEnd?: number;
  /** Draw the floor outline (default true). */
  floor?: boolean;
}

/** The floor corner farthest from the viewer -- where the three axis edges meet
 * so they stay behind the data. */
export function farCorner(cam: Camera): [number, number] {
  const corners: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  return corners.reduce((far, c) =>
    cam.at(c[0], c[1], 0).depth < cam.at(far[0], far[1], 0).depth ? c : far,
  );
}

/**
 * The projected axis box drawn behind the data: the floor outline plus the
 * three edges rising from the farthest floor corner, each labelled at its free
 * end. Deliberately sparse (Wolfram's `Axes`, not `Boxed`) so the mesh or the
 * bars stay legible through it.
 */
export function axisBoxSvg(cam: Camera, opts: AxisBoxOptions = {}): string {
  const [bx, by] = farCorner(cam);
  const o = cam.at(bx, by, 0);
  const line = (a: ScreenPoint, b: ScreenPoint, opacity: number): string =>
    `<line x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}" stroke="${EDGE}" stroke-width="1" opacity="${opacity}"/>`;

  let out = "";
  if (opts.floor !== false) {
    const pts = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
      .map(([x, y]) => cam.at(x, y, 0))
      .map((p) => `${n2(p.x)},${n2(p.y)}`)
      .join(" ");
    out += `<polygon points="${pts}" fill="none" stroke="${EDGE}" stroke-width="1" opacity="0.35"/>`;
  }
  out +=
    line(o, cam.at(1 - bx, by, 0), 0.5) +
    line(o, cam.at(bx, 1 - by, 0), 0.5) +
    line(o, cam.at(bx, by, 1), 0.5);

  const tick = (p: ScreenPoint, anchor: string, text: string): string =>
    text
      ? `<text x="${n2(p.x)}" y="${n2(p.y)}" text-anchor="${anchor}" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.6">${esc(text)}</text>`
      : "";
  out +=
    tick(cam.at(1 - bx, by, 0), "middle", opts.xEnd === undefined ? "" : axisLabel(opts.xEnd)) +
    tick(cam.at(bx, 1 - by, 0), "middle", opts.yEnd === undefined ? "" : axisLabel(opts.yEnd)) +
    tick(cam.at(bx, by, 1), "end", opts.zEnd === undefined ? "" : axisLabel(opts.zEnd));
  return out;
}

/** A centred figure title, matching the 2-D plotters' chrome. */
export function titleSvg(width: number, title: string | undefined): string {
  return title
    ? `<text x="${n2(width / 2)}" y="13" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";
}

/** An `<svg>` wrapper with a `viewBox` and no fixed width, as every other
 * renderer in this package emits. */
export function frameSvg(width: number, height: number, aria: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}">${body}</svg>`;
}
